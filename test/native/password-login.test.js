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
import { loginUser, handleLoginFailure } from '/app/server-dist/auth.js';
import { verifyPassword, hashPassword, hashToken } from '/app/server-dist/security.js';
import { findRefreshTokenSession } from '/app/server-dist/auth-session-store.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('password login binds verified credentials, bookkeeping, root issuance and required audit', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], active = new Set(), releases = new Set();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl);
  const password = 'PasswordLoginNativeFixture123!', metadata = { ipAddress: '127.0.0.1', userAgent: 'native-password-login' };
  const input = () => ({ username: 'password-admin', password, requestMetadata: metadata });
  let runtime, userId, originalHash;
  const service = options => createPasswordLoginService({ isBootstrapRequiredFn: async () => false, handleLoginFailureFn: handleLoginFailure, ...options });
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const waiting = async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%WHERE id = ANY%') AS waiting")).rows[0].waiting;
  const state = async () => (await observer.query(`SELECT failed_login_count, locked_until::text, last_login_at::text,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE actor_user_id=$1 AND event_type='login_succeeded') AS audits
    FROM app_users WHERE id=$1`, [userId])).rows[0];
  async function reset(epoch = '2026-01-01 00:00:00.000100+00') {
    await observer.query(`UPDATE app_users SET password_hash=$2, password_changed_at=$3, is_disabled=FALSE,
      locked_until=NULL, failed_login_count=3, last_login_at='2026-01-01', role='admin', must_change_password=FALSE WHERE id=$1`, [userId, originalHash, epoch]);
  }
  function verificationGate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); },
      login: service({ verifyPasswordFn: async (...args) => { const valid = await verifyPassword(...args); assert.equal(valid, true); ready.resolve(); await release.promise; return valid; } }).loginUser };
  }
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_login_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='login_succeeded' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_login_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_login_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_login_audit ON audit_events; DROP FUNCTION public.fixture_login_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: input().username, password, email: 'password@example.test' } })).response.status, 201);
    const original = (await observer.query("SELECT id,password_hash FROM app_users WHERE username='password-admin'")).rows[0];
    userId = original.id; originalHash = original.password_hash;
    await reset();
    const initial = await state();
    const success = await loginUser({ ...input(), username: 'PASSWORD@EXAMPLE.TEST' });
    const committed = await state();
    assert.equal(committed.tokens, initial.tokens + 1); assert.equal(committed.audits, initial.audits + 1); assert.equal(committed.failed_login_count, 0);
    assert.equal((await findRefreshTokenSession(pool, hashToken(success.issuedSession.refreshToken))).app_user_id, userId);
    assert.equal(success.user.last_login_at.getTime(), success.issuedSession.user.lastLoginAt.getTime());
    const audit = (await observer.query("SELECT details,ip_address,user_agent FROM audit_events WHERE actor_user_id=$1 AND event_type='login_succeeded' ORDER BY occurred_at DESC LIMIT 1", [userId])).rows[0];
    assert.equal(audit.details, null); assert.equal(audit.user_agent, metadata.userAgent);
    results.push('real-password-email-login-atomic-bookkeeping-session-audit');

    const otherHash = await hashPassword('ChangedNativePassword123!');
    for (const kind of ['hash', 'microsecond-epoch', 'null-to-epoch', 'epoch-to-null', 'disabled', 'lockout']) {
      await reset(kind === 'null-to-epoch' ? null : undefined);
      const gate = verificationGate(), pending = track(gate.login(input()));
      await gate.ready;
      const changes = { hash: ['password_hash=$2', otherHash], 'microsecond-epoch': ["password_changed_at='2026-01-01 00:00:00.000200+00'"],
        'null-to-epoch': ["password_changed_at='2026-01-01'"], 'epoch-to-null': ['password_changed_at=NULL'],
        disabled: ['is_disabled=TRUE'], lockout: ["locked_until=clock_timestamp()+interval '15 minutes'"] }[kind];
      await observer.query(`UPDATE app_users SET ${changes[0]} WHERE id=$1`, changes.length === 2 ? [userId, changes[1]] : [userId]);
      const before = await state(); gate.open();
      await assert.rejects(pending, { status: kind === 'lockout' ? 423 : 401 }); assert.deepEqual(await state(), before);
      results.push('verified-source-refuses-' + kind);
    }

    for (const kind of ['password', 'role']) {
      await reset(); await observer.query('BEGIN');
      await observer.query(`UPDATE app_users SET ${kind === 'password' ? 'password_hash=$2' : "role='requester',must_change_password=TRUE"} WHERE id=$1`, kind === 'password' ? [userId, otherHash] : [userId]);
      const before = await state(), pending = track(loginUser(input()));
      await withWorkerTaskCleanup(() => until(waiting), () => observer.query('COMMIT'));
      if (kind === 'password') { await assert.rejects(pending, { status: 401 }); assert.deepEqual(await state(), before); }
      else { const result = await pending; assert.equal(result.user.role, 'requester'); assert.equal(result.issuedSession.user.mustChangePassword, true); }
      results.push('fresh-' + kind + '-after-actual-account-writer-wait');
    }

    await reset(); const concurrentBefore = await state();
    const simultaneous = await Promise.all([track(loginUser(input())), track(loginUser(input()))]);
    assert.notEqual(simultaneous[0].issuedSession.tokenFamilyId, simultaneous[1].issuedSession.tokenFamilyId);
    assert.equal((await state()).tokens, concurrentBefore.tokens + 2); assert.equal((await state()).audits, concurrentBefore.audits + 2);
    results.push('concurrent-logins-serialize-without-shared-lock-upgrade');

    await reset(); const lockedBefore = await state(); await observer.query('BEGIN'); await observer.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [userId]);
    await withWorkerTaskCleanup(async () => { await assert.rejects(loginUser(input()), error => error.status === 503 && error.cause.code === '55P03'); }, () => observer.query('ROLLBACK'));
    assert.deepEqual(await state(), lockedBefore); results.push('account-lock-timeout-preserves-all-writes');

    await reset();
    await auditTrigger("RAISE EXCEPTION 'fixture required audit failure';", async () => {
      const before = await state();
      const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: input().username, password }) });
      assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null);
      const body = await response.json(); assert.equal(body.error.code, 'session_write_unavailable'); assert.doesNotMatch(JSON.stringify(body), /fixture required|password_hash|tokenHash/u);
      assert.deepEqual(await state(), before);
    }); results.push('required-audit-rollback-http-refuses-cookies-and-private-errors');

    await reset(); const heldBefore = await state(), ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    const held = service({ startTransactionFn: work => startSessionWriteTransaction(async (client, check) => { const result = await work(client, check); ready.resolve(); await release.promise; return result; }) });
    const heldResult = track(held.loginUser(input())); await ready.promise;
    assert.deepEqual(await state(), heldBefore); release.resolve(); releases.delete(release); await heldResult;
    assert.equal((await state()).tokens, heldBefore.tokens + 1); assert.equal((await state()).audits, heldBefore.audits + 1);
    results.push('all-login-writes-invisible-until-confirmed-commit');

    await reset(); const uncertainBefore = await state(); let commits = 0;
    const uncertain = service({ startTransactionFn: work => startSessionWriteTransaction(work, { getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost commit acknowledgement'); } return value; }; return client;
    } }) }) });
    await assert.rejects(uncertain.loginUser(input()), { status: 503 }); assert.equal(commits, 1);
    assert.equal((await state()).tokens, uncertainBefore.tokens + 1); assert.equal((await state()).audits, uncertainBefore.audits + 1);
    results.push('real-commit-controlled-ack-loss-refuses-publication-without-retry');

    await reset(); let task, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const before = await state();
      const timed = service({ startTransactionFn: work => { task = startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { timeoutMs: 1_000 }); return task; } });
      const refused = assert.rejects(track(timed.loginUser(input())), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(), before);
    }); results.push('deadline-waits-native-backend-retirement-and-rolls-back');
    await reset();
    const response = await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username: input().username, password } });
    assert.equal(response.response.status, 200); assert.ok(response.response.headers.get('set-cookie')); assert.equal(response.payload.user.role, 'admin');
    results.push('ordinary-http-login-delivers-cookies-after-success');
  }, async () => {
    for (const release of releases) release.resolve();
    await observer.query('ROLLBACK').catch(() => {}); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, exactCredentialEpoch: true, requiredAuditAtomic: true, commitLossControlled: true, actualBackendRetirement: true }));
});
