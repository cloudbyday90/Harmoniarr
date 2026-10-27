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
import { createAuthModule } from '/app/server-dist/auth-module.js';
import { isBootstrapRequired, handleLoginFailure } from '/app/server-dist/auth.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { readBootstrapRequired, readPasswordLoginUser, startAuthLookup } from '/app/server-dist/auth-lookup-service.js';
import { createPasswordLoginService } from '/app/server-dist/password-login-service.js';
import { verifyPassword } from '/app/server-dist/security.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('preliminary auth reads bound native work without abandoning security writes', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '2'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), results = [], active = new Set(), releases = new Set();
  let overrideLogin, runtime;
  function track(promise) { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; }
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createAuthModule: options => {
    const module = createAuthModule(options), normal = module.routeDependencies.loginUser;
    module.routeDependencies.loginUser = input => track((overrideLogin ?? normal)(input)); return module;
  } });
  const baseUrl = 'http://127.0.0.1:3000', http = createSessionHttpClient(baseUrl), username = 'auth-read-admin', password = 'AuthReadNativeFixture123!';
  const requestLogin = (signal, attemptedPassword = password) => fetch(baseUrl + '/api/v1/auth/login', { method: 'POST', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: attemptedPassword }) });
  const state = async () => (await observer.query(`SELECT
    (SELECT count(*)::int FROM refresh_tokens) AS tokens,
    (SELECT count(*)::int FROM audit_events WHERE event_type='login_succeeded') AS successes,
    (SELECT count(*)::int FROM audit_events WHERE event_type='login_failed') AS failures,
    (SELECT failed_login_count FROM app_users WHERE username=$1) AS failed_login_count`, [username])).rows[0];
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  const absent = async pid => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present;
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal(await isBootstrapRequired(), true); results.push('actual-empty-bootstrap-observation');
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username, password, email: 'auth-read@example.test' } })).response.status, 201);
    assert.equal(await readBootstrapRequired(), false);
    await observer.query("UPDATE app_users SET password_changed_at='2026-01-01 00:00:00.000100+00' WHERE username=$1", [username]);
    const byName = await readPasswordLoginUser(username), byEmail = await readPasswordLoginUser('auth-read@example.test');
    assert.equal(byName.id, byEmail.id); assert.match(byName.credential_epoch, /0001/u); assert.equal(await readPasswordLoginUser('unknown-user'), null);
    results.push('username-email-missing-and-exact-credential-facts');

    const beforeReadOnly = await state();
    await assert.rejects(startAuthLookup(client => client.query('UPDATE app_users SET failed_login_count=99')).result,
      error => error.code === 'auth_lookup_unavailable' && error.cause.code === '25006');
    assert.deepEqual(await state(), beforeReadOnly); results.push('read-only-owner-refuses-mutation');

    const held = [];
    await withWorkerTaskCleanup(async () => {
      for (let index = 0; index < 2; index++) held.push(await pool.connect());
      for (const read of [readBootstrapRequired, () => readPasswordLoginUser(username)]) await assert.rejects(read(), { status: 503, code: 'auth_lookup_unavailable' });
      for (const response of [await fetch(baseUrl + '/api/v1/bootstrap/status'), await requestLogin()]) {
        const body = await response.json(); assert.equal(response.status, 503); assert.equal(body.error.code, 'auth_lookup_unavailable'); assert.equal(response.headers.get('set-cookie'), null);
        assert.doesNotMatch(JSON.stringify(body), /SELECT|app_users|password_hash|credential_epoch/u);
      }
      assert.deepEqual(await state(), beforeReadOnly);
    }, () => { for (const client of held) client.release(); });
    results.push('pool-exhaustion-fails-bootstrap-and-login-without-security-writes');

    for (const [name, read] of [['bootstrap', readBootstrapRequired], ['credential', () => readPasswordLoginUser(username)]]) {
      const before = await state(); await observer.query('BEGIN'); await observer.query('LOCK TABLE public.app_users IN ACCESS EXCLUSIVE MODE');
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(read(), error => error.code === 'auth_lookup_unavailable' && error.cause.code === '55P03');
      }, () => observer.query('ROLLBACK'));
      assert.deepEqual(await state(), before); results.push(name + '-real-table-lock-timeout');
    }

    for (const phase of ['bootstrap-status', 'login-bootstrap', 'login-credential']) {
      const before = await state(), controller = new AbortController(); let pid;
      if (phase === 'login-credential') overrideLogin = createPasswordLoginService({ isBootstrapRequiredFn: async () => false, handleLoginFailureFn: handleLoginFailure }).loginUser;
      await observer.query('BEGIN'); await observer.query('LOCK TABLE public.app_users IN ACCESS EXCLUSIVE MODE');
      const pending = phase === 'bootstrap-status' ? fetch(baseUrl + '/api/v1/bootstrap/status', { signal: controller.signal }) : requestLogin(controller.signal);
      const disconnected = assert.rejects(pending, { name: 'AbortError' });
      await withWorkerTaskCleanup(async () => {
        await until(async () => { pid = (await observer.query("SELECT pid FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE '%FROM public.app_users%' LIMIT 1")).rows[0]?.pid; return Boolean(pid); });
        controller.abort(); await disconnected; await until(() => absent(pid));
      }, async () => { controller.abort(); await disconnected; overrideLogin = null; await observer.query('ROLLBACK'); });
      assert.deepEqual(await state(), before); results.push(phase + '-http-disconnect-retires-real-read-backend');
    }

    await assert.rejects(startAuthLookup(client => client.query('SELECT pg_sleep(30)')).result,
      error => error.code === 'auth_lookup_unavailable' && error.cause.code === '57014');
    results.push('real-read-statement-timeout');
    for (const reason of ['cancel', 'deadline']) {
      const controller = new AbortController(), started = Promise.withResolvers(); let pid;
      const task = startAuthLookup(async client => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const query = client.query('SELECT pg_sleep(30)'); started.resolve(); return query;
      }, { signal: controller.signal, timeoutMs: reason === 'deadline' ? 1_000 : 8_000 });
      const refused = assert.rejects(task.result, { status: 503, code: 'auth_lookup_unavailable' });
      await Promise.race([started.promise, task.result]);
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      if (reason === 'cancel') controller.abort();
      await refused; assert.equal(await task.drained, true); await until(() => absent(pid)); results.push(reason + '-native-read-drainage');
    }

    const late = await pool.connect(), latePid = (await late.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const arrival = Promise.withResolvers(); let entered = false;
    const lateTask = startAuthLookup(async () => { entered = true; }, { timeoutMs: 100, getPoolFn: () => ({ connect: () => arrival.promise }) });
    await withWorkerTaskCleanup(() => assert.rejects(lateTask.result, { code: 'auth_lookup_unavailable' }), async () => {
      arrival.resolve(late); assert.equal(await lateTask.drained, true);
    });
    assert.equal(entered, false); await until(() => absent(latePid));
    results.push('controlled-late-checkout-retires-actual-transport-without-work');

    for (const valid of [true, false]) {
      const ready = Promise.withResolvers(), release = Promise.withResolvers(), controller = new AbortController(), before = await state(); releases.add(release);
      let loginTask;
      const service = createPasswordLoginService({ isBootstrapRequiredFn: isBootstrapRequired, handleLoginFailureFn: handleLoginFailure,
        verifyPasswordFn: async (...args) => {
          assert.equal(pool.totalCount, pool.idleCount); assert.equal(pool.waitingCount, 0);
          const result = await verifyPassword(...args); assert.equal(result, valid); ready.resolve(); await release.promise; return result;
        } });
      overrideLogin = input => { loginTask = service.loginUser(input); return loginTask; };
      const request = requestLogin(controller.signal, valid ? password : 'WrongAuthReadPassword123!');
      const disconnected = assert.rejects(request, { name: 'AbortError' });
      await withWorkerTaskCleanup(async () => {
        await Promise.race([ready.promise, request.then(() => { throw new Error('Login finished before verification barrier'); })]);
        controller.abort(); await disconnected;
        const completed = valid ? loginTask : assert.rejects(loginTask, { status: 401 });
        release.resolve(); releases.delete(release); await completed;
        const after = await state();
        assert.equal(after.tokens, before.tokens + (valid ? 1 : 0)); assert.equal(after.successes, before.successes + (valid ? 1 : 0));
        assert.equal(after.failures, before.failures + (valid ? 0 : 1)); assert.equal(after.failed_login_count, valid ? 0 : 1);
      }, async () => { release.resolve(); releases.delete(release); overrideLogin = null; await disconnected; });
      results.push((valid ? 'successful' : 'failed') + '-verification-holds-no-checkout-and-security-write-survives-disconnect');
    }

    const settings = (await pool.query("SELECT current_setting('statement_timeout') AS statement,current_setting('transaction_read_only') AS readonly")).rows[0];
    assert.deepEqual(settings, { statement: '0', readonly: 'off' });
    assert.equal((await http.requestJson('/api/v1/auth/login', { method: 'POST', json: { username, password } })).response.status, 200);
    assert.equal((await http.requestJson('/api/v1/bootstrap/status')).payload.bootstrapRequired, false);
    results.push('ordinary-login-bootstrap-retry-and-clean-pool-settings');
  }, async () => {
    for (const release of releases) release.resolve();
    await observer.query('ROLLBACK').catch(() => {}); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => observer.end(), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, readOnly: true, noBootstrapOnReadFailure: true, actualBackendRetirement: true, hashingOutsideCheckout: true, securityWritesIndependent: true }));
});
