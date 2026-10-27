/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { createSystemModule } from '/app/server-dist/system-module.js';
import { createSchemaDiagnosticsService } from '/app/server-dist/schema-diagnostics-service.js';
import { createSchemaMaintenanceService } from '/app/server-dist/schema-maintenance-service.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { startDatabaseSchemaDriftInspection } from '/app/server-dist/schema-drift-service.js';
import { withDatabasePreparation } from '/app/server-dist/database-preparation-owner-service.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('automatic schema maintenance owns read-only checks while administrator HTTP only reads its latest summary', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), path = '/api/v1/system/diagnostics/schema-state', locks = createMaintenanceLockService();
  let mode = 'current', scans = 0, active = 0, peak = 0, runtime, renamed = false, maintenanceLock;
  let time = Date.now(), started = Promise.withResolvers(), release = Promise.withResolvers(), scanSignal;
  const diagnostics = createSchemaDiagnosticsService({ now: () => new Date(time), inspectFn: async ({ signal }) => {
    scans++; active++; peak = Math.max(peak, active); scanSignal = signal;
    try {
      if (mode === 'hold') { started.resolve(); await release.promise; }
      if (mode === 'error') throw new Error('private SQL credentials');
      const task = startDatabaseSchemaDriftInspection({ signal, respectMaintenance: true });
      return await withWorkerTaskCleanup(() => task.result, () => task.drained);
    } finally { active--; }
  } });
  const maintenance = createSchemaMaintenanceService({ diagnosticsService: diagnostics, now: () => time });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createSystemModule: options => createSystemModule({ ...options, schemaMaintenanceService: maintenance,
      musicBrainzSearchService: { checkProviderHealth: async () => ({ status: 'healthy' }) }, slskdService: { getConnectionStatus: async () => ({ status: 'unavailable' }) } }) });
  const client = createSessionHttpClient('http://127.0.0.1:3000'), read = () => client.requestJson(path);
  const fingerprint = async () => createHash('sha256').update(JSON.stringify({
    ledger: (await pool.query('SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows,
    catalog: (await pool.query("SELECT c.oid::text,c.xmin::text,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.oid")).rows,
    functions: (await pool.query("SELECT p.oid::text,p.xmin::text,md5(pg_get_functiondef(p.oid)) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid")).rows,
  })).digest('hex');
  async function check() {
    const before = await fingerprint(); time += 60 * 60 * 1000 + 1;
    await maintenance.tick(); assert.equal(await fingerprint(), before);
  }
  async function observed(state) {
    const count = scans, result = await read();
    assert.equal(result.response.status, 200); assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(result.payload.schemaDiagnostics.state, state); assert.equal(scans, count);
    assert.doesNotMatch(JSON.stringify(result.payload), /private|credentials|CREATE|functionDefinition|operation_runs_pending_dispatch_idx/u); return result;
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal(runtime.schemaMaintenanceService, maintenance);
    assert.equal((await read()).response.status, 401); assert.equal(scans, 0);
    maintenance.start(); await diagnostics.waitForDrain();
    await new Promise(resolve => { setImmediate(resolve); });
    assert.equal(maintenance.getSchemaDiagnostics().state, 'current'); assert.equal(scans, 1);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'schema-http-admin', password: 'SchemaHttpFixture123!' } })).response.status, 201);
    const current = await observed('current'); assert.equal(current.payload.schemaDiagnostics.anchors.checkedCount, 164);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='schema-http-admin'");
    const count = scans; assert.equal((await read()).response.status, 403); assert.equal(scans, count);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='schema-http-admin'");
    await pool.query('ALTER INDEX operation_runs_pending_dispatch_idx RENAME TO fixture_schema_http_missing_index'); renamed = true;
    await check(); assert.equal((await observed('attention')).payload.schemaDiagnostics.anchors.missingCount, 1);
    await pool.query('ALTER INDEX fixture_schema_http_missing_index RENAME TO operation_runs_pending_dispatch_idx'); renamed = false;
    await withDatabasePreparation({}, async () => { await check(); await observed('busy'); });
    maintenanceLock = await locks.acquireMaintenanceLock({ lockType: 'restore', reason: 'native schema maintenance fixture' });
    await check(); await observed('paused');
    await locks.releaseMaintenanceLock({ lockId: maintenanceLock.id }); maintenanceLock = null;
    await check(); await observed('current');
    const heldClient = await pool.connect();
    await withWorkerTaskCleanup(async () => {
      await heldClient.query('BEGIN'); await heldClient.query('LOCK TABLE public.maintenance_locks IN ACCESS EXCLUSIVE MODE');
      await check(); await observed('unavailable');
    }, async () => { try { await heldClient.query('ROLLBACK'); } finally { heldClient.release(); } });
    mode = 'error'; await check(); await observed('unavailable'); mode = 'current'; await check(); await observed('current');
    time += 60 * 60 * 1000 + 1; await observed('stale');
    mode = 'hold'; const pending = maintenance.tick(); await started.promise;
    await withWorkerTaskCleanup(async () => {
      const heldCalls = scans; await observed('running'); await maintenance.tick(); assert.equal(scans, heldCalls);
      assert.equal(scanSignal.aborted, false);
      await pool.query("UPDATE app_users SET role='requester' WHERE username='schema-http-admin'");
      assert.equal((await read()).response.status, 403); assert.equal(scanSignal.aborted, false);
    }, async () => { release.resolve(); await pending; });
    await pool.query("UPDATE app_users SET role='admin' WHERE username='schema-http-admin'");
    const burstCount = scans, burst = await Promise.all(Array.from({ length: 15 }, read));
    assert.ok(burst.some(result => result.response.status === 429)); assert.equal(scans, burstCount);
    for (const result of burst) assert.equal(result.response.headers.get('cache-control'), 'no-store');
    started = Promise.withResolvers(); release = Promise.withResolvers(); time += 60 * 60 * 1000 + 1;
    const held = maintenance.tick(); await started.promise;
    const closing = maintenance.stopAndDrain(); let drained = false; closing.then(() => { drained = true; });
    assert.equal(scanSignal.aborted, true); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(drained, false);
    release.resolve(); await held; await closing; assert.equal(peak, 1); assert.equal(active, 0);
    t.diagnostic(JSON.stringify({ automaticStartupCheck: true, httpReadsNeverScan: true, currentAdminRequired: true,
      realReader: true, checkedAnchors: 164, missingIndexObservedWithoutRepair: true, preparationBusy: true,
      recoveryMaintenancePaused: true, maintenanceAdmissionBounded: true, automaticRetry: true, staleIdentified: true, noStore: true, rateLimited: true,
      maxActiveScans: peak, shutdownCancellationAndDrainage: true, ledgerAndCatalogPreserved: true }));
  }, async () => {
    release.resolve();
    await withWorkerTaskCleanup(async () => {
      if (maintenanceLock) await locks.releaseMaintenanceLock({ lockId: maintenanceLock.id });
      if (renamed) await pool.query('ALTER INDEX fixture_schema_http_missing_index RENAME TO operation_runs_pending_dispatch_idx');
    }, async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
});
