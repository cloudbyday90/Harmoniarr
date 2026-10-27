/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { loginUser, handleLoginFailure, rotateSession } from '/app/server-dist/auth.js';
import { hashPassword, verifyPassword, hashToken } from '/app/server-dist/security.js';
import { isCurrentPasswordHash } from '/app/server-dist/password-hash-policy.js';
import { findRefreshTokenSession } from '/app/server-dist/auth-session-store.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

const profile = await requireDeploymentMemoryProfile();
test('legacy password upgrades preserve epochs and atomically publish with the verified login', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], releases = new Set(), active = new Set();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl), password = 'LegacyUpgradeNativeFixture123!';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-password-upgrade' };
  const input = () => ({ username: 'upgrade-admin', password, requestMetadata: metadata });
  const service = options => createPasswordLoginService({ isBootstrapRequiredFn: async () => false, handleLoginFailureFn: handleLoginFailure, ...options });
  let runtime, userId, legacy;
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const state = async () => (await observer.query(`SELECT password_hash, password_changed_at::text AS epoch,
    failed_login_count, locked_until::text, last_login_at::text,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$1 AND event_type='login_succeeded') AS audits
    FROM app_users WHERE id=$1`, [userId])).rows[0];
  async function reset(epoch = '2026-01-01 00:00:00.000100+00') {
    await observer.query(`UPDATE app_users SET password_hash=$2, password_changed_at=$3, is_disabled=FALSE,
      locked_until=NULL, failed_login_count=3, last_login_at='2026-01-01', must_change_password=FALSE WHERE id=$1`, [userId, legacy, epoch]);
  }
  function hashGate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); },
      login: service({ hashPasswordFn: async value => {
        const replacement = await hashPassword(value); ready.resolve(); await release.promise; return replacement;
      } }).loginUser };
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: input().username, password } })).response.status, 201);
    const original = (await observer.query('SELECT id,password_hash FROM app_users WHERE username=$1', [input().username])).rows[0];
    userId = original.id; assert.equal(isCurrentPasswordHash(original.password_hash), true);
    const salt = '0123456789abcdef0123456789abcdef', key = await promisify(scrypt)(password, salt, 64);
    legacy = `scrypt$${salt}$${key.toString('hex')}`;
    assert.equal(await verifyPassword(password, legacy), true);
    results.push('new-bootstrap-profile-and-independent-real-legacy-oracle');

    for (const epoch of ['2026-01-01 00:00:00.000100+00', null]) {
      await reset(epoch);
      const old = await loginUser(input()); // Upgrade, then deliberately restore the legacy fixture only.
      await reset(epoch);
      const acceptedSession = { refreshTokenId: old.issuedSession.refreshTokenId, appUserId: userId,
        tokenFamilyId: old.issuedSession.tokenFamilyId, refreshToken: old.issuedSession.refreshToken };
      const before = await state(), gate = hashGate(), pending = track(gate.login(input()));
      await gate.ready;
      assert.equal(pool.idleCount, pool.totalCount); assert.deepEqual(await state(), before); gate.open();
      const success = await pending, after = await state();
      assert.equal(isCurrentPasswordHash(after.password_hash), true); assert.equal(await verifyPassword(password, after.password_hash), true);
      assert.equal(after.epoch, before.epoch); assert.equal(after.failed_login_count, 0);
      assert.equal(after.tokens, before.tokens + 1); assert.equal(after.audits, before.audits + 1);
      const audit = (await observer.query("SELECT details FROM audit_events WHERE actor_user_id=$1 AND event_type='login_succeeded' ORDER BY occurred_at DESC LIMIT 1", [userId])).rows[0];
      assert.deepEqual(audit.details, { passwordHashUpgraded: true, passwordHashProfile: 'scrypt-v2' });
      assert.doesNotMatch(JSON.stringify(success.user), /scrypt|password_hash|credential_epoch/u);
      assert.equal((await findRefreshTokenSession(pool, hashToken(old.issuedSession.refreshToken))).is_revoked, false);
      await rotateSession(acceptedSession, metadata);
      results.push(epoch === null ? 'null-epoch-upgrade-preserves-existing-session-rotation' : 'microsecond-epoch-upgrade-outside-sql-and-existing-session-rotation');
    }

    await reset(); let rehashes = 0;
    await assert.rejects(service({ hashPasswordFn: async () => { rehashes++; throw new Error('unexpected'); } }).loginUser({ ...input(), password: password + 'wrong' }), { status: 401 });
    assert.equal(rehashes, 0); assert.equal((await state()).password_hash, legacy);
    results.push('wrong-password-does-not-rehash');

    for (const value of [null, legacy, 'invalid']) {
      await reset(); const before = await state();
      await assert.rejects(service({ hashPasswordFn: async () => value }).loginUser(input()), { status: 503, code: 'password_work_unavailable' });
      assert.deepEqual(await state(), before);
    }
    results.push('invalid-prepared-material-refused-without-writes');

    const otherHash = await hashPassword(password + 'changed');
    for (const kind of ['hash', 'microsecond-epoch', 'null-to-epoch', 'epoch-to-null', 'disabled', 'lockout']) {
      await reset(kind === 'null-to-epoch' ? null : undefined);
      const gate = hashGate(), pending = track(gate.login(input())); await gate.ready;
      const changes = { hash: ['password_hash=$2', otherHash], 'microsecond-epoch': ["password_changed_at='2026-01-01 00:00:00.000200+00'"],
        'null-to-epoch': ["password_changed_at='2026-01-01'"], 'epoch-to-null': ['password_changed_at=NULL'],
        disabled: ['is_disabled=TRUE'], lockout: ["locked_until=clock_timestamp()+interval '15 minutes'"] }[kind];
      await observer.query(`UPDATE app_users SET ${changes[0]} WHERE id=$1`, changes.length === 2 ? [userId, changes[1]] : [userId]);
      const before = await state(); gate.open();
      await assert.rejects(pending, { status: kind === 'lockout' ? 423 : 401 }); assert.deepEqual(await state(), before);
      results.push('prepared-upgrade-refuses-' + kind);
    }

    await reset(); const left = hashGate(), right = hashGate(), beforeRace = await state();
    const contenders = Promise.allSettled([track(left.login(input())), track(right.login(input()))]);
    await Promise.all([left.ready, right.ready]); left.open(); right.open(); const race = await contenders;
    assert.equal(race.filter(row => row.status === 'fulfilled').length, 1);
    assert.equal(race.find(row => row.status === 'rejected').reason.status, 401);
    const raceState = await state(); assert.equal(raceState.failed_login_count, 0);
    assert.equal(raceState.tokens, beforeRace.tokens + 1); assert.equal(raceState.audits, beforeRace.audits + 1);
    assert.equal(isCurrentPasswordHash(raceState.password_hash), true); await loginUser(input());
    assert.equal((await state()).password_hash, raceState.password_hash);
    results.push('simultaneous-upgrades-one-winner-no-counter-penalty-explicit-retry');

    await reset();
    await observer.query(`CREATE FUNCTION public.fixture_upgrade_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='login_succeeded' THEN RAISE EXCEPTION 'fixture upgrade audit failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_upgrade_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_upgrade_audit()`);
    await withWorkerTaskCleanup(async () => {
      const before = await state();
      const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: input().username, password }) });
      assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
      assert.doesNotMatch(JSON.stringify(await response.json()), /fixture upgrade|scrypt|password_hash/u); assert.deepEqual(await state(), before);
    }, () => observer.query('DROP TRIGGER fixture_upgrade_audit ON audit_events; DROP FUNCTION public.fixture_upgrade_audit()'));
    results.push('required-audit-rollback-keeps-legacy-hash-and-refuses-http-cookies');

    await reset(); const beforeCommit = await state(), ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const held = service({ startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      try { const result = await work(client, check); ready.resolve(); await release.promise; return result; }
      catch (error) { ready.reject(error); throw error; }
    }) });
    const pending = track(held.loginUser(input())); await ready.promise;
    assert.deepEqual(await state(), beforeCommit); release.resolve(); releases.delete(release); await pending;
    const committed = await state(); assert.equal(isCurrentPasswordHash(committed.password_hash), true);
    assert.equal(committed.tokens, beforeCommit.tokens + 1); assert.equal(committed.audits, beforeCommit.audits + 1);
    results.push('hash-bookkeeping-session-audit-invisible-until-commit');

    await reset(); const beforeLoss = await state(); let commits = 0, derivations = 0;
    const uncertain = service({ hashPasswordFn: async value => { derivations++; return hashPassword(value); },
      startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
        const client = await pool.connect(), query = client.query.bind(client);
        client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost commit acknowledgement'); } return value; }; return client;
      } }) }) });
    await assert.rejects(uncertain.loginUser(input()), { status: 503 }); assert.equal(commits, 1); assert.equal(derivations, 1);
    const afterLoss = await state(); assert.equal(isCurrentPasswordHash(afterLoss.password_hash), true);
    assert.equal(afterLoss.tokens, beforeLoss.tokens + 1); assert.equal(afterLoss.audits, beforeLoss.audits + 1);
    results.push('real-commit-controlled-ack-loss-upgrades-once-without-retry');
  }, async () => {
    for (const release of releases) release.resolve(); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, profile, exactCredentialEpoch: true, hashOutsideSql: true, requiredAuditAtomic: true, commitLossControlled: true }));
});
