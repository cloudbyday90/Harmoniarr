/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { readMigrationStatus } from '/app/server-dist/schema-migration-status-service.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createReadinessDiagnosticsFixture, readinessFixtureLockNamespace } from '../../testing/server/readiness-diagnostics-fixture.js';

await requireDeploymentMemoryProfile();
test('packaged readiness failures retain safe attributed proof without leaking internals or abandoning admitted queries', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const anchor = await mkdtemp('/app/data/readiness-diagnostics-'), pool = getPool();
  const fixture = createReadinessDiagnosticsFixture({ pool, anchor });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createSystemModule: fixture.buildSystemModule });
  let runtime, holder, waiter, drain, admitted;
  const baseUrl = 'http://127.0.0.1:3000', client = createSessionHttpClient(baseUrl);
  async function health() { const response = await fetch(baseUrl + '/healthz'); return { response, body: await response.json() }; }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: true, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    let result = await health(); assert.equal(result.response.status, 200); assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(result.body).sort(), ['appPort', 'ok', 'pendingMigrations', 'service', 'startedAt']);
    const reader = await pool.connect();
    try {
      await reader.query('BEGIN READ ONLY');
      const migrations = await readMigrationStatus({ queryable: reader });
      assert.equal(migrations.applied, 115); assert.equal(migrations.pending.length, 0);
    } finally { try { await reader.query('ROLLBACK'); } finally { reader.release(); } }
    for (let batch = 0; batch < 5; batch++) {
      const checks = await Promise.all(Array.from({ length: 10 }, health));
      assert.ok(checks.every(check => check.response.status === 200 && check.body.pendingMigrations === 0));
    }
    assert.equal((await client.requestJson('/api/v1/system/diagnostics/recovery-state')).response.status, 401);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'readiness-admin', password: 'ReadinessFixture123!' } })).response.status, 201);
    const cases = [];
    for (const [mode, stage, code, status] of [['missing_file', 'package_metadata', 'ENOENT', 500], ['query_error', 'active_jobs', '42P01', 500],
      ['query_cancelled', 'database_query', '57014', 500], ['connection_refused', 'database_query', 'ECONNREFUSED', 503]]) {
      fixture.setMode(mode); result = await health(); assert.equal(result.response.status, status);
      assert.equal(result.response.headers.get('cache-control'), 'no-store'); assert.equal(result.body.error.code, 'health_check_failed');
      const snapshot = fixture.diagnostics.getSnapshot(), record = snapshot.recentFailures[0];
      assert.equal(record.reference, result.body.error.reference); assert.equal(record.stage, stage); assert.equal(record.code, code);
      assert.equal(fixture.completed.at(-1).failure, fixture.failures.at(-1));
      assert.doesNotMatch(JSON.stringify([result.body, snapshot, fixture.lines]), /private|secret|SELECT|pg_sleep|127\.0\.0\.1|\/app/u);
      cases.push({ mode, stage, code, status });
    }
    fixture.setMode('query_error'); fixture.setSinkThrows(true); result = await health(); assert.equal(result.response.status, 500);
    assert.equal(fixture.completed.at(-1).failure, fixture.failures.at(-1)); fixture.setSinkThrows(false);
    for (let i = 0; i < 30; i++) await health();
    assert.equal(fixture.diagnostics.getSnapshot().recentFailures.length, 16); assert.ok(fixture.lines.length <= 5);
    fixture.setMode('healthy'); assert.equal((await health()).response.status, 200);
    const admin = await client.requestJson('/api/v1/system/diagnostics/recovery-state');
    assert.equal(admin.response.status, 200); assert.equal(admin.response.headers.get('cache-control'), 'no-store');
    assert.equal(admin.payload.readiness.lastCheck.outcome, 'healthy'); assert.equal(admin.payload.readiness.recentFailures.length, 16);
    assert.doesNotMatch(JSON.stringify(admin.payload.readiness), /private|secret|SELECT|\/app/u);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='readiness-admin'");
    assert.equal((await client.requestJson('/api/v1/system/diagnostics/recovery-state')).response.status, 403);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='readiness-admin'");

    holder = await pool.connect(); waiter = await pool.connect(); fixture.setWaiter(waiter);
    await holder.query('SELECT pg_advisory_lock($1::int,1)', [readinessFixtureLockNamespace]); fixture.setMode('database_wait');
    const abort = new AbortController(); admitted = fetch(baseUrl + '/healthz', { signal: abort.signal }).then(() => null, error => error);
    const deadline = Date.now() + 5000;
    for (;;) {
      const row = (await pool.query('SELECT wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1', [waiter.processID])).rows[0];
      if (row?.wait_event_type === 'Lock' && row.blockers.includes(holder.processID)) break;
      assert.ok(Date.now() < deadline); await new Promise(resolve => { setTimeout(resolve, 10); });
    }
    abort.abort(); await admitted;
    let closed = false; drain = app.systemModule.healthReadinessService.close().then(() => { closed = true; });
    await Promise.resolve(); assert.equal(closed, false);
    await holder.query('SELECT pg_advisory_unlock($1::int,1)', [readinessFixtureLockNamespace]); await drain;
    assert.equal(closed, true); assert.equal((await health()).response.status, 503);
    t.diagnostic(JSON.stringify({ cases, historyLimit: 16, genericNoStoreResponses: true, originalErrorsPreserved: true,
      safeAdministratorHistory: true, administratorOnly: true, logFailureContained: true, disconnectedQueryDrained: true, closedAdmission: true,
      migrationStatusReadOnlyTransaction: true, concurrentHealthyChecks: 50 }));
  }, async () => {
    if (holder) { await holder.query('SELECT pg_advisory_unlock_all()'); holder.release(); }
    if (drain) await drain;
    if (waiter) { await waiter.query('SELECT pg_advisory_unlock_all()'); waiter.release(); }
    if (admitted) await admitted;
    if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
      runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); });
      await drainApplicationWorkerOwners(app); await closePool();
    } }); else await closePool();
    await rm(anchor, { recursive: true, force: true });
  });
});
