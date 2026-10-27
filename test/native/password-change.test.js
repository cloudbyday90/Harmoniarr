/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { issueSession, rotateSession, handleLoginFailure, loginUser } from '/app/server-dist/auth.js';
import { hashPassword, verifyPassword, hashToken } from '/app/server-dist/security.js';
import { createPasswordChangeService } from '/app/server-dist/password-change-service.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { createSessionIssuanceService } from '/app/server-dist/session-issuance-service.js';
import { handleSessionReplay } from '/app/server-dist/session-replay-service.js';
import { findRefreshTokenSession } from '/app/server-dist/auth-session-store.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { recordAuditEvent } from '/app/server-dist/audit.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

const profile = await requireDeploymentMemoryProfile();
test('password change atomically replaces credentials, revokes sessions and audits under current authority', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500'; process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], releases = new Set(), active = new Set();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl), password = 'PasswordChangeNativeFixture123!', next = 'ReplacementNativePassword456!';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-password-change' };
  let runtime, userId, originalHash;
  const service = options => createPasswordChangeService(options);
  const seed = () => issueSession({ userId, requestMetadata: metadata });
  const identity = token => ({ appUserId: userId, refreshTokenId: token.refreshTokenId, tokenFamilyId: token.tokenFamilyId, refreshToken: token.refreshToken });
  const input = token => ({ currentPassword: password, newPassword: next, session: identity(token), requestMetadata: metadata });
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const state = async () => (await observer.query(`SELECT password_hash, password_changed_at::text AS epoch, must_change_password,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1 AND NOT is_revoked) AS active,
    (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$1 AND event_type='password_changed') AS audits
    FROM app_users WHERE id=$1`, [userId])).rows[0];
  async function reset(epoch = '2026-01-01 00:00:00.000100+00') {
    await observer.query(`UPDATE app_users SET password_hash=$2, password_changed_at=$3, is_disabled=FALSE,
      must_change_password=FALSE, role='admin', failed_login_count=0, locked_until=NULL WHERE id=$1`, [userId, originalHash, epoch]);
    await observer.query("UPDATE refresh_tokens SET is_revoked=TRUE,revoked_reason='fixture_reset' WHERE app_user_id=$1 AND NOT is_revoked", [userId]);
  }
  function gate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, hashPasswordFn: async value => {
      const hash = await hashPassword(value); ready.resolve(); await release.promise; return hash;
    } };
  }
  function transactionGate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      try { const result = await work(client, check); ready.resolve(); await release.promise; check(); return result; }
      catch (error) { ready.reject(error); throw error; }
    }) };
  }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const waiting = async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%WHERE id = ANY%') AS waiting")).rows[0].waiting;
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_change_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='password_changed' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_change_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_change_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_change_audit ON audit_events; DROP FUNCTION public.fixture_change_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'change-admin', password } })).response.status, 201);
    const original = (await observer.query("SELECT id,password_hash FROM app_users WHERE username='change-admin'")).rows[0];
    userId = original.id; originalHash = original.password_hash;
    for (const epoch of ['2026-01-01 00:00:00.000100+00', null]) {
      await reset(epoch); const parent = await seed(), other = await seed();
      await observer.query('UPDATE app_users SET must_change_password=TRUE WHERE id=$1', [userId]);
      const before = await state(), held = gate(), pending = track(service(held).changePassword(input(parent))); await held.ready;
      assert.equal(pool.idleCount, pool.totalCount); assert.deepEqual(await state(), before); held.open();
      const changed = await pending, after = await state();
      assert.equal(await verifyPassword(next, after.password_hash), true); assert.equal(await verifyPassword(password, after.password_hash), false);
      assert.notEqual(after.epoch, before.epoch); assert.equal(after.must_change_password, false);
      assert.equal(after.active, 1); assert.equal(after.tokens, before.tokens + 1); assert.equal(after.audits, before.audits + 1);
      for (const token of [parent, other]) {
        const row = await findRefreshTokenSession(pool, hashToken(token.refreshToken)); assert.equal(row.is_revoked, true); assert.equal(row.revoked_reason, 'password_changed');
      }
      assert.notEqual(changed.issuedSession.tokenFamilyId, parent.tokenFamilyId); assert.equal(changed.issuedSession.user.mustChangePassword, false);
      await rotateSession(identity(changed.issuedSession), metadata);
      const audit = (await observer.query("SELECT details FROM audit_events WHERE actor_user_id=$1 AND event_type='password_changed' ORDER BY occurred_at DESC LIMIT 1", [userId])).rows[0];
      assert.deepEqual(audit.details, { revokedSessionCount: 2 });
      assert.doesNotMatch(JSON.stringify(changed.user), /password_hash|scrypt|credential_epoch/u);
      results.push(epoch === null ? 'null-epoch-change-and-usable-replacement' : 'forced-change-full-atomic-revocation-and-hashing-outside-checkout');
    }

    await reset(); const checkedOutParent = await seed(), holders = []; let verified = 0;
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 4; index++) holders.push(await pool.connect());
      await assert.rejects(service({ verifyPasswordFn: async () => { verified++; return true; } }).changePassword(input(checkedOutParent)), { status: 503, code: 'auth_lookup_unavailable' });
      assert.equal(verified, 0);
    }, () => { for (const client of holders) client.release(); });
    results.push('bounded-preliminary-read-exhaustion-precedes-password-work');

    for (const kind of ['credential-cas', 'partial-revocation']) {
      await reset(); const parent = await seed(), other = await seed(), before = await state();
      const table = kind === 'credential-cas' ? 'app_users' : 'refresh_tokens';
      const condition = kind === 'credential-cas' ? 'NEW.password_hash IS DISTINCT FROM OLD.password_hash'
        : `NEW.revoked_reason='password_changed' AND OLD.id='${other.refreshTokenId}'::uuid`;
      await observer.query(`CREATE FUNCTION public.fixture_change_suppression() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF ${condition} THEN RETURN NULL; END IF; RETURN NEW; END $$;
        CREATE TRIGGER fixture_change_suppression BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION public.fixture_change_suppression()`);
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(service().changePassword(input(parent)), { status: 503 }); assert.deepEqual(await state(), before);
      }, () => observer.query(`DROP TRIGGER fixture_change_suppression ON ${table}; DROP FUNCTION public.fixture_change_suppression()`));
      results.push('suppressed-' + kind + '-rolls-back-before-replacement');
    }

    await reset(); const source = await seed(), wrongBefore = await state();
    for (const value of [{ currentPassword: password + 'wrong' }, { newPassword: password }]) {
      await assert.rejects(service().changePassword({ ...input(source), ...value })); assert.deepEqual(await state(), wrongBefore);
    }
    results.push('wrong-current-and-unchanged-new-password-refuse-without-writes');
    for (const value of [null, originalHash.replace('p=5', 'p=1')]) {
      await assert.rejects(service({ hashPasswordFn: async () => value }).changePassword(input(source)), { status: 503 }); assert.deepEqual(await state(), wrongBefore);
    }
    results.push('invalid-prepared-material-refuses-without-writes');

    const otherHash = await hashPassword(password + 'changed');
    for (const kind of ['hash', 'microsecond-epoch', 'null-to-epoch', 'epoch-to-null', 'disabled', 'revoked', 'expired', 'token-mismatch']) {
      await reset(kind === 'null-to-epoch' ? null : undefined); const parent = await seed(), held = gate();
      const pending = track(service(held).changePassword({ ...input(parent), ...(kind === 'token-mismatch' ? { session: { ...identity(parent), refreshToken: 'mismatched-token' } } : {}) })); await held.ready;
      const changes = { hash: ['password_hash=$2', otherHash], 'microsecond-epoch': ["password_changed_at='2026-01-01 00:00:00.000200+00'"],
        'null-to-epoch': ["password_changed_at='2026-01-01'"], 'epoch-to-null': ['password_changed_at=NULL'], disabled: ['is_disabled=TRUE'] }[kind];
      if (changes) await observer.query(`UPDATE app_users SET ${changes[0]} WHERE id=$1`, changes.length === 2 ? [userId, changes[1]] : [userId]);
      if (kind === 'revoked') await observer.query('UPDATE refresh_tokens SET is_revoked=TRUE WHERE id=$1', [parent.refreshTokenId]);
      if (kind === 'expired') await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [parent.refreshTokenId]);
      const before = await state(); held.open(); await assert.rejects(pending, { status: 401 }); assert.deepEqual(await state(), before);
      results.push('prepared-change-refuses-' + kind);
    }

    await reset(); const first = await seed(), heldRole = gate(), roleResult = track(service(heldRole).changePassword(input(first))); await heldRole.ready;
    await observer.query("UPDATE app_users SET role='requester' WHERE id=$1", [userId]); heldRole.open();
    assert.equal((await roleResult).issuedSession.user.role, 'requester'); results.push('current-role-projected-after-preparation');

    await reset(); const contender = await seed(), left = gate(), right = gate(), beforeRace = await state();
    const racing = Promise.allSettled([track(service(left).changePassword(input(contender))), track(service(right).changePassword(input(contender)))]);
    await Promise.all([left.ready, right.ready]); left.open(); right.open(); const race = await racing;
    assert.equal(race.filter(row => row.status === 'fulfilled').length, 1); assert.equal(race.find(row => row.status === 'rejected').reason.status, 401);
    assert.equal((await state()).tokens, beforeRace.tokens + 1); assert.equal((await state()).audits, beforeRace.audits + 1); assert.equal((await state()).active, 1);
    results.push('simultaneous-changes-one-credential-and-one-replacement');

    await reset(); const rotating = await seed(), rotationGate = transactionGate();
    const rotated = track(createSessionIssuanceService(rotationGate).rotateSession(identity(rotating), metadata)); await rotationGate.ready;
    const changeAfterRotation = track(service().changePassword(input(rotating)));
    await until(waiting); rotationGate.open(); await rotated; const afterRotation = await state();
    await assert.rejects(changeAfterRotation, { status: 401 }); assert.deepEqual(await state(), afterRotation);
    results.push('rotation-first-account-wait-refuses-stale-initiating-session');

    await reset(); const changing = await seed(), changeGate = transactionGate(), beforeCommit = await state();
    const changed = track(service(changeGate).changePassword(input(changing))); await changeGate.ready;
    assert.deepEqual(await state(), beforeCommit);
    const lateRotation = track(rotateSession(identity(changing), metadata)); await until(waiting); changeGate.open(); await changed;
    await assert.rejects(lateRotation, { status: 401 }); assert.equal((await state()).active, 1);
    results.push('change-first-atomic-visibility-and-late-rotation-refusal');

    await reset(); const ancestor = await seed(), descendant = await rotateSession(identity(ancestor), metadata);
    const replayRow = await findRefreshTokenSession(pool, hashToken(ancestor.refreshToken)), replayGate = gate();
    const revokedByReplay = track(service(replayGate).changePassword(input(descendant))); await replayGate.ready;
    await handleSessionReplay({ row: replayRow, requestMetadata: metadata }); const replayState = await state(); replayGate.open();
    await assert.rejects(revokedByReplay, { status: 401 }); assert.deepEqual(await state(), replayState);
    results.push('replay-during-hashing-refuses-revoked-parent');
    await reset(); const prior = await seed(), child = await rotateSession(identity(prior), metadata);
    const oldReplay = await findRefreshTokenSession(pool, hashToken(prior.refreshToken));
    const replacement = await service().changePassword(input(child)); await handleSessionReplay({ row: oldReplay, requestMetadata: metadata });
    assert.equal((await findRefreshTokenSession(pool, hashToken(replacement.issuedSession.refreshToken))).is_revoked, false);
    results.push('old-family-replay-cannot-revoke-new-password-family');

    await reset(); const loginReady = Promise.withResolvers(), loginRelease = Promise.withResolvers(); releases.add(loginRelease);
    const staleLogin = track(createPasswordLoginService({ isBootstrapRequiredFn: async () => false, handleLoginFailureFn: handleLoginFailure,
      verifyPasswordFn: async (...args) => { const valid = await verifyPassword(...args); loginReady.resolve(); await loginRelease.promise; return valid; }
    }).loginUser({ username: 'change-admin', password, requestMetadata: metadata }));
    await loginReady.promise; const loginToken = await seed(); await service().changePassword(input(loginToken));
    const afterChange = await state(); loginRelease.resolve(); releases.delete(loginRelease);
    await assert.rejects(staleLogin, { status: 401 }); assert.deepEqual(await state(), afterChange);
    results.push('old-password-verification-cannot-publish-login-after-change');

    await reset(); await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username: 'change-admin', password } });
    const beforeHttp = await state(), cookieBefore = http.getCookieHeader();
    for (const headers of [{}, { 'x-csrf-token': 'invalid' }]) {
      const denied = await http.requestJson('/api/v1/auth/change-password', { method: 'POST', csrf: false, headers, json: { currentPassword: password, newPassword: next } });
      assert.equal(denied.response.status, 403); assert.equal(denied.response.headers.get('set-cookie'), null); assert.deepEqual(await state(), beforeHttp);
    }
    await auditTrigger("RAISE EXCEPTION 'fixture change audit failed';", async () => {
      const denied = await http.requestJson('/api/v1/auth/change-password', { method: 'POST', json: { currentPassword: password, newPassword: next } });
      assert.equal(denied.response.status, 503); assert.equal(denied.response.headers.get('set-cookie'), null);
      assert.doesNotMatch(JSON.stringify(denied.payload), /fixture change|scrypt|password_hash/u); assert.deepEqual(await state(), beforeHttp);
    });
    assert.equal(http.getCookieHeader(), cookieBefore); results.push('http-csrf-and-required-audit-rollback-refuse-cookies');
    const successHttp = await http.requestJson('/api/v1/auth/change-password', { method: 'POST', json: { currentPassword: password, newPassword: next } });
    assert.equal(successHttp.response.status, 200); assert.ok(successHttp.response.headers.get('set-cookie')); assert.notEqual(http.getCookieHeader(), cookieBefore);
    assert.equal((await http.requestJson('/api/v1/auth/refresh', { method: 'POST' })).response.status, 200);
    results.push('http-success-delivers-usable-new-session');

    await reset(); const expiring = await seed(), beforeExpiry = await state();
    await assert.rejects(service({ startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
      await client.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 second' WHERE id=$1", [expiring.refreshTokenId]); return work(client, check);
    }), recordAuditEventFn: async (...args) => { await recordAuditEvent(...args); await args[1].query('SELECT pg_sleep(1.1)'); } }).changePassword(input(expiring)), { status: 503 });
    assert.deepEqual(await state(), beforeExpiry); results.push('final-parent-expiry-rolls-back-all-change-writes');

    await reset(); const lost = await seed(), beforeLoss = await state(); let commits = 0, derivations = 0;
    const uncertain = service({ hashPasswordFn: async value => { derivations++; return hashPassword(value); },
      startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
        const client = await pool.connect(), query = client.query.bind(client);
        client.query = async (...args) => { const result = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost acknowledgement'); } return result; }; return client;
      } }) }) });
    await assert.rejects(uncertain.changePassword(input(lost)), { status: 503 }); assert.equal(commits, 1); assert.equal(derivations, 1);
    const afterLoss = await state(); assert.equal(afterLoss.active, 1); assert.equal(afterLoss.tokens, beforeLoss.tokens + 1); assert.equal(afterLoss.audits, beforeLoss.audits + 1);
    assert.equal(await verifyPassword(next, afterLoss.password_hash), true); await loginUser({ username: 'change-admin', password: next, requestMetadata: metadata });
    results.push('real-commit-controlled-ack-loss-no-retry-and-explicit-new-password-login');

    await reset(); const timedParent = await seed(); let task, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const before = await state();
      const timed = service({ startTransactionFn: work => { task = startSessionWriteTransaction(async (client, check) => {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check);
      }, { timeoutMs: 1_000 }); return task; } });
      const refused = assert.rejects(track(timed.changePassword(input(timedParent))), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(), before);
    }); results.push('deadline-rolls-back-and-awaits-actual-backend-retirement');
  }, async () => {
    for (const release of releases) release.resolve(); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, profile, exactCredentialEpoch: true, currentParentFenced: true, hashOutsideSql: true,
    allWritesAtomic: true, commitLossControlled: true, actualBackendRetirement: true }));
});
