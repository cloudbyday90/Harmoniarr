/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool, buildConnectionConfig, buildPoolConfig } from '/app/server-dist/database.js';
import { attachPoolAdmissionLimit, getPoolAdmissionState } from '/app/server-dist/database-pool-admission-service.js';
import { startSessionLookup } from '/app/server-dist/session-lookup-owner-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('bounded pool admission and session authorization refuse exhaustion, drain cancellation and preserve current authority', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '1'; process.env.HARMONIARR_PG_POOL_MAX_PENDING = '2';
  process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500'; process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig());
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  let requestSignal;
  const client = createSessionHttpClient('http://127.0.0.1:3000', { fetchFn: (url, options) => fetch(url, {
    ...options, signal: requestSignal ? AbortSignal.any([options.signal, requestSignal]) : options.signal,
  }) });
  const path = '/api/v1/auth/sessions', results = []; let runtime, held;
  async function until(check) {
    const expires = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'native observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect();
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'bounded-session-admin', password: 'BoundedSessionFixture123!' } })).response.status, 201);
    assert.equal((await client.requestJson(path)).response.status, 200); results.push('ordinary-authorized-read');

    held = await pool.connect();
    const first = pool.connect(), second = new Promise((resolve, reject) => { pool.connect((error, value) => error ? reject(error) : resolve(value)); });
    const outcomes = Promise.allSettled([first, second]);
    assert.deepEqual(getPoolAdmissionState(pool), { maxPendingCheckouts: 2, pendingCheckouts: 2 });
    await assert.rejects(pool.query('SELECT 1'), { code: 'database_pool_busy' });
    const refused = await outcomes; assert.ok(refused.every(row => row.status === 'rejected'));
    assert.equal(pool.waitingCount, 0); assert.equal(getPoolAdmissionState(pool).pendingCheckouts, 0);
    results.push('promise-callback-query-admission-and-queue-expiry');
    const unavailable = await client.requestJson(path);
    assert.equal(unavailable.response.status, 503); assert.equal(unavailable.payload.error.code, 'session_lookup_unavailable');
    assert.doesNotMatch(JSON.stringify(unavailable.payload), /SELECT|refresh_tokens|password|token_hash/u);
    held.release(); held = null; assert.equal((await client.requestJson(path)).response.status, 200);
    results.push('exhausted-http-refusal-and-explicit-retry');

    await observer.query('BEGIN'); await observer.query('LOCK TABLE public.refresh_tokens IN ACCESS EXCLUSIVE MODE');
    const pidBefore = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const locked = await client.requestJson(path); assert.equal(locked.response.status, 503);
    assert.equal(locked.payload.error.code, 'session_lookup_unavailable'); await observer.query('ROLLBACK');
    const settings = (await pool.query("SELECT pg_backend_pid() AS pid,current_setting('statement_timeout') AS statement,current_setting('transaction_read_only') AS readonly")).rows[0];
    assert.deepEqual(settings, { pid: pidBefore, statement: '0', readonly: 'off' });
    assert.equal((await client.requestJson(path)).response.status, 200); results.push('real-lock-timeout-rollback-and-setting-restoration');

    const abortPid = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await observer.query('BEGIN'); await observer.query('LOCK TABLE public.refresh_tokens IN ACCESS EXCLUSIVE MODE');
    const httpController = new AbortController(); requestSignal = httpController.signal;
    const disconnected = assert.rejects(client.requestJson(path), { name: 'AbortError' });
    await withWorkerTaskCleanup(async () => {
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock') AS waiting", [abortPid])).rows[0].waiting);
      httpController.abort(); await disconnected;
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [abortPid])).rows[0].present);
      assert.ok(pool.totalCount <= 1); results.push('http-disconnect-cancels-held-session-backend');
    }, async () => { httpController.abort(); requestSignal = undefined; await disconnected; await observer.query('ROLLBACK'); });
    assert.equal((await client.requestJson(path)).response.status, 200);

    await observer.query("UPDATE app_users SET role='requester' WHERE username='bounded-session-admin'");
    assert.equal((await client.requestJson('/api/v1/system/diagnostics/schema-state')).response.status, 403);
    await observer.query("UPDATE app_users SET role='admin' WHERE username='bounded-session-admin'");
    results.push('fresh-role-read-no-authorization-cache');

    for (const reason of ['cancel', 'deadline']) {
      const controller = new AbortController(), started = Promise.withResolvers(); let pid;
      const task = startSessionLookup(async connection => {
        pid = (await connection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const query = connection.query('SELECT pg_sleep(30)'); started.resolve(); return query;
      }, { signal: controller.signal, timeoutMs: reason === 'deadline' ? 1_000 : 8_000 });
      const rejected = assert.rejects(task.result, { status: 503, code: 'session_lookup_unavailable' });
      await Promise.race([started.promise, task.result]);
      await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
      if (reason === 'cancel') controller.abort();
      await rejected; assert.equal(await task.drained, true);
      await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present);
      assert.ok(pool.totalCount <= 1);
      assert.notEqual((await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, pid);
      assert.equal((await client.requestJson(path)).response.status, 200);
      results.push(reason + '-active-query-backend-retired-and-retry');
    }

    const sockets = new Set(), blackhole = createServer(socket => { sockets.add(socket); socket.resume(); socket.once('close', () => sockets.delete(socket)); });
    await new Promise(resolve => { blackhole.listen(0, '127.0.0.1', resolve); });
    const cold = attachPoolAdmissionLimit(new pg.Pool(buildPoolConfig({ PGHOST: '127.0.0.1', PGPORT: String(blackhole.address().port), PGUSER: 'fixture', PGDATABASE: 'fixture', HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS: '100' })));
    cold.on('error', () => {});
    await withWorkerTaskCleanup(async () => {
      await assert.rejects(cold.connect()); assert.equal(cold.totalCount, 0); assert.equal(cold.waitingCount, 0);
      results.push('cold-startup-timeout-and-client-retirement');
    }, async () => { await cold.end(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => { blackhole.close(resolve); }); assert.equal(sockets.size, 0); });
    await pool.query("UPDATE refresh_tokens SET is_revoked=true,revoked_reason='operator' WHERE app_user_id=(SELECT id FROM app_users WHERE username='bounded-session-admin')");
    assert.equal((await client.requestJson(path)).response.status, 401); results.push('revoked-session-refused');
  }, async () => {
    if (held) held.release(true);
    await withWorkerTaskCleanup(async () => { try { await observer.query('ROLLBACK'); } finally { await observer.end(); } }, async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, boundedPending: 2, poolMax: 1, noQueuedRefusal: true, noAuthorityAfterTimeout: true, actualBackendRetirement: true }));
});
