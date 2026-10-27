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
import { createLoginFailureService } from '/app/server-dist/login-failure-service.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { readPasswordLoginUser } from '/app/server-dist/auth-lookup-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('failed login owns current counters, lockout and required audit atomically', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], active = new Set(), releases = new Set();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl), username = 'failure-admin', password = 'FailureNativeFixture123!';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-login-failure' };
  let runtime, userId, originalHash;
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const source = () => readPasswordLoginUser(username);
  const fail = user => handleLoginFailure(user, metadata, username);
  const succeed = () => loginUser({ username, password, requestMetadata: metadata });
  const state = async () => (await observer.query(`SELECT failed_login_count, locked_until::text,
    (SELECT count(*)::int FROM audit_events WHERE event_type='login_failed') AS failures,
    (SELECT count(*)::int FROM refresh_tokens WHERE app_user_id=$1) AS tokens
    FROM app_users WHERE id=$1`, [userId])).rows[0];
  const outcome = async () => (await observer.query("SELECT details->>'outcome' AS outcome FROM audit_events WHERE event_type='login_failed' ORDER BY occurred_at DESC,id DESC LIMIT 1")).rows[0].outcome;
  async function reset(count = 0) { await observer.query(`UPDATE app_users SET password_hash=$2, password_changed_at='2026-01-01 00:00:00.000100+00',
    failed_login_count=$3, locked_until=NULL, is_disabled=FALSE WHERE id=$1`, [userId, originalHash, count]); }
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const waiting = async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%WHERE id = ANY%') AS waiting")).rows[0].waiting;
  function gate() {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release);
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); },
      startTransactionFn: work => startSessionWriteTransaction(async (client, check) => {
        const result = await work(client, check); ready.resolve(); await release.promise; check(); return result;
      }) };
  }
  async function auditTrigger(body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_failure_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.event_type='login_failed' THEN ${body} END IF; RETURN NEW; END $$;
      CREATE TRIGGER fixture_failure_audit BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION public.fixture_failure_audit()`);
    return withWorkerTaskCleanup(work, () => observer.query('DROP TRIGGER fixture_failure_audit ON audit_events; DROP FUNCTION public.fixture_failure_audit()'));
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username, password } })).response.status, 201);
    const original = (await observer.query('SELECT id,password_hash FROM app_users WHERE username=$1', [username])).rows[0]; userId = original.id; originalHash = original.password_hash;
    await reset(); const accepted = await source(), before = await state();
    await Promise.all(Array.from({ length: 6 }, () => track(fail(accepted))));
    const concurrent = await state(); assert.equal(concurrent.failed_login_count, 5); assert.equal(concurrent.failures, before.failures + 6);
    const transition = (await observer.query("SELECT count(*)::int AS count FROM audit_events WHERE event_type='login_failed' AND details->>'outcome'='locked'")).rows[0]; assert.equal(transition.count, 1);
    assert.equal(concurrent.tokens, before.tokens); results.push('six-concurrent-stale-snapshots-one-lockout-no-lost-counts');

    const locked = await state(); await fail(accepted);
    const afterLocked = await state(); assert.equal(afterLocked.locked_until, locked.locked_until); assert.equal(afterLocked.failed_login_count, 5); assert.equal(await outcome(), 'already_locked');
    results.push('active-lockout-deadline-is-not-extended');
    await observer.query("UPDATE app_users SET locked_until=clock_timestamp()-interval '1 second' WHERE id=$1", [userId]);
    await fail(await source());
    const remaining = (await observer.query('SELECT extract(epoch FROM locked_until-clock_timestamp()) AS remaining FROM app_users WHERE id=$1', [userId])).rows[0].remaining;
    assert.ok(Number(remaining) > 890 && Number(remaining) <= 900); assert.equal((await state()).failed_login_count, 5);
    results.push('expired-lockout-rearms-from-database-clock');
    await reset(2147483647); await fail(await source()); assert.equal((await state()).failed_login_count, 5);
    results.push('counter-saturates-without-integer-overflow');

    for (const kind of ['hash', 'microsecond-epoch', 'null-to-epoch', 'epoch-to-null']) {
      await reset(); if (kind === 'null-to-epoch') await observer.query('UPDATE app_users SET password_changed_at=NULL WHERE id=$1', [userId]);
      const old = await source();
      const change = { hash: "password_hash='changed-credential'", 'microsecond-epoch': "password_changed_at='2026-01-01 00:00:00.000200+00'", 'null-to-epoch': "password_changed_at='2026-01-01'", 'epoch-to-null': 'password_changed_at=NULL' }[kind];
      await observer.query(`UPDATE app_users SET ${change},failed_login_count=0 WHERE id=$1`, [userId]);
      await fail(old); assert.equal((await state()).failed_login_count, 0); assert.equal(await outcome(), 'stale_credentials'); results.push('stale-failure-refuses-' + kind);
    }
    await reset(); const available = await source(); await observer.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [userId]);
    await fail(available); assert.equal((await state()).failed_login_count, 0); assert.equal(await outcome(), 'account_unavailable');
    const deletedId = (await observer.query("INSERT INTO app_users(username,password_hash,role) VALUES ('failure-deleted','unused','requester') RETURNING id")).rows[0].id;
    await observer.query('DELETE FROM app_users WHERE id=$1', [deletedId]); await fail({ ...available, id: deletedId }); assert.equal(await outcome(), 'account_unavailable');
    await handleLoginFailure(null, metadata, 'unknown-listener'); assert.equal(await outcome(), 'unknown_account');
    results.push('disabled-deleted-and-unknown-attempts-audit-without-counter');

    for (const first of ['failure', 'success']) {
      await reset(3); const stale = await source(), held = gate(), old = await state();
      const firstResult = first === 'failure'
        ? track(createLoginFailureService({ startTransactionFn: held.startTransactionFn }).handleLoginFailure(stale, metadata, username))
        : track(createPasswordLoginService({ isBootstrapRequiredFn: async () => false, handleLoginFailureFn: handleLoginFailure, startTransactionFn: held.startTransactionFn }).loginUser({ username, password, requestMetadata: metadata }));
      await Promise.race([held.ready, firstResult]); assert.deepEqual(await state(), old);
      const secondResult = first === 'failure' ? track(succeed()) : track(fail(stale));
      await Promise.race([until(waiting), secondResult]); held.open(); await firstResult; await secondResult;
      assert.equal((await state()).failed_login_count, first === 'failure' ? 0 : 1);
      results.push(first + '-before-contender-uses-current-reset-and-commit-state');
    }

    await reset(3); const preReset = await source(); await observer.query('BEGIN');
    await observer.query("UPDATE app_users SET password_changed_at='2026-01-01 00:00:00.000200+00',failed_login_count=0 WHERE id=$1", [userId]);
    const pendingReset = track(fail(preReset));
    await withWorkerTaskCleanup(() => Promise.race([until(waiting), pendingReset]), () => observer.query('COMMIT'));
    await pendingReset; assert.equal((await state()).failed_login_count, 0); assert.equal(await outcome(), 'stale_credentials'); results.push('fresh-credential-state-after-actual-reset-writer-wait');

    for (const boundary of ['account', 'audit']) {
      await reset(4); const old = await source(), oldState = await state(); await observer.query('BEGIN');
      if (boundary === 'account') await observer.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [userId]);
      else await observer.query('LOCK TABLE audit_events IN ACCESS EXCLUSIVE MODE');
      await withWorkerTaskCleanup(async () => { await assert.rejects(fail(old), error => error.status === 503 && error.code === 'login_failure_unavailable' && error.cause.code === '55P03'); }, () => observer.query('ROLLBACK'));
      assert.deepEqual(await state(), oldState); results.push(boundary + '-lock-timeout-rolls-back-counter-and-audit');
    }

    await reset(4);
    await auditTrigger("RAISE EXCEPTION 'private fixture audit failure';", async () => {
      const old = await state();
      const response = await fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'IncorrectPassword123!' }) });
      const body = await response.json(); assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null); assert.equal(body.error.code, 'login_failure_unavailable');
      assert.doesNotMatch(JSON.stringify(body), /private fixture|password_hash|IncorrectPassword/u); assert.deepEqual(await state(), old);
    }); results.push('audit-failure-http-refuses-cookie-and-rolls-back-threshold');

    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const old = await state(); await assert.rejects(fail(await source()), error => error.status === 503 && error.cause.code === '57014'); assert.deepEqual(await state(), old);
    }); results.push('actual-audit-statement-timeout-rolls-back');
    let task, pid;
    await auditTrigger('PERFORM pg_sleep(30);', async () => {
      const old = await state();
      const timed = createLoginFailureService({ startTransactionFn: work => { task = startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { timeoutMs: 1_000, errorCode: 'login_failure_unavailable' }); return task; } });
      const refused = assert.rejects(track(timed.handleLoginFailure(await source(), metadata, username)), { status: 503 });
      await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      await refused; assert.equal(await task.drained, true); await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.deepEqual(await state(), old);
    }); results.push('owner-deadline-drains-real-backend-and-locks');

    const poolSource = await source(), poolBefore = await state(), heldClients = [];
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 4; index++) heldClients.push(await pool.connect());
      await assert.rejects(fail(poolSource), { status: 503, code: 'login_failure_unavailable' }); assert.deepEqual(await state(), poolBefore);
    }, () => { for (const client of heldClients) client.release(); }); results.push('pool-exhaustion-no-unowned-counter-or-audit-write');

    await reset(); const uncertainBefore = await state(); let commits = 0;
    const uncertain = createLoginFailureService({ startTransactionFn: work => startSessionWriteTransaction(work, { errorCode: 'login_failure_unavailable', getPoolFn: () => ({ async connect() {
      const client = await pool.connect(), query = client.query.bind(client);
      client.query = async (...args) => { const value = await query(...args); if (args[0] === 'COMMIT') { commits++; throw new Error('fixture lost commit acknowledgement'); } return value; }; return client;
    } }) }) });
    await assert.rejects(uncertain.handleLoginFailure(await source(), metadata, username), { status: 503 }); assert.equal(commits, 1);
    const uncertainAfter = await state(); assert.equal(uncertainAfter.failed_login_count, 1); assert.equal(uncertainAfter.failures, uncertainBefore.failures + 1);
    results.push('real-commit-controlled-ack-loss-does-not-retry-increment');

    await reset(4);
    const wrong = await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password: 'IncorrectPassword123!' } });
    assert.equal(wrong.response.status, 401); assert.equal(wrong.response.headers.get('set-cookie'), null);
    const lockedBefore = await state(); assert.equal(lockedBefore.failed_login_count, 5);
    const lockedHttp = await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password } });
    assert.equal(lockedHttp.response.status, 423); assert.equal(lockedHttp.response.headers.get('set-cookie'), null);
    assert.equal((await state()).locked_until, lockedBefore.locked_until); assert.equal((await state()).failures, lockedBefore.failures + 1);
    await reset(); assert.equal((await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password } })).response.status, 200);
    results.push('real-http-threshold-lockout-audit-and-success-after-reset');
  }, async () => {
    for (const release of releases) release.resolve();
    await observer.query('ROLLBACK').catch(() => {}); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, atomicFailureAudit: true, noLostCounts: true, activeDeadlinePreserved: true, credentialResetFenced: true, commitLossControlled: true, actualBackendRetirement: true }));
});
