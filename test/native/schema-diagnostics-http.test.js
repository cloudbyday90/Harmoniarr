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
import { inspectDatabaseSchemaDrift } from '/app/server-dist/schema-drift-service.js';
import { withDatabasePreparation } from '/app/server-dist/database-preparation-owner-service.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('administrator HTTP schema diagnostics authorize twice, never repair, bound concurrent scans and return no-store summaries', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), path = '/api/v1/system/diagnostics/schema-state';
  const started = Promise.withResolvers(), release = Promise.withResolvers();
  let mode = 'current', scans = 0, active = 0, peak = 0, runtime, pending, renamed = false;
  const service = createSchemaDiagnosticsService({ inspectFn: async () => {
    scans++; active++; peak = Math.max(peak, active);
    try { if (mode === 'hold') { started.resolve(); await release.promise; } if (mode === 'error') throw new Error('private SQL credentials'); return await inspectDatabaseSchemaDrift(); }
    finally { active--; }
  } });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createSystemModule: options => createSystemModule({ ...options, schemaDiagnosticsService: service,
      musicBrainzSearchService: { checkProviderHealth: async () => ({ status: 'healthy' }) }, slskdService: { getConnectionStatus: async () => ({ status: 'unavailable' }) } }) });
  const client = createSessionHttpClient('http://127.0.0.1:3000');
  const read = () => client.requestJson(path);
  const fingerprint = async () => createHash('sha256').update(JSON.stringify({
    ledger: (await pool.query('SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows,
    catalog: (await pool.query("SELECT c.oid::text,c.xmin::text,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.oid")).rows,
    functions: (await pool.query("SELECT p.oid::text,p.xmin::text,md5(pg_get_functiondef(p.oid)) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid")).rows,
  })).digest('hex');
  async function observed(state) {
    const before = await fingerprint(), result = await read();
    assert.equal(result.response.status, 200); assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(result.payload.schemaDiagnostics.state, state); assert.equal(await fingerprint(), before);
    assert.doesNotMatch(JSON.stringify(result.payload), /private|credentials|CREATE|functionDefinition|operation_runs_pending_dispatch_idx/u); return result;
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    const unauth = await read(); assert.equal(unauth.response.status, 401); assert.equal(unauth.response.headers.get('cache-control'), 'no-store'); assert.equal(scans, 0);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'schema-http-admin', password: 'SchemaHttpFixture123!' } })).response.status, 201);
    const current = await observed('current'); assert.equal(current.payload.schemaDiagnostics.anchors.checkedCount, 164);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='schema-http-admin'");
    const beforeDenied = scans, denied = await read(); assert.equal(denied.response.status, 403); assert.equal(scans, beforeDenied);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='schema-http-admin'");
    await pool.query('ALTER INDEX operation_runs_pending_dispatch_idx RENAME TO fixture_schema_http_missing_index'); renamed = true;
    const changed = await observed('attention'); assert.equal(changed.payload.schemaDiagnostics.lineage.state, 'current'); assert.equal(changed.payload.schemaDiagnostics.anchors.missingCount, 1);
    await pool.query('ALTER INDEX fixture_schema_http_missing_index RENAME TO operation_runs_pending_dispatch_idx'); renamed = false;
    await withDatabasePreparation({}, async () => { await observed('busy'); });
    mode = 'error'; await observed('unavailable'); mode = 'current'; await observed('current');
    mode = 'hold'; pending = read(); await started.promise;
    const heldCalls = scans; await observed('busy'); assert.equal(scans, heldCalls);
    await pool.query("UPDATE app_users SET role='requester' WHERE username='schema-http-admin'");
    release.resolve(); const revoked = await pending; pending = null;
    assert.equal(revoked.response.status, 403); assert.equal(revoked.response.headers.get('cache-control'), 'no-store'); assert.equal(revoked.payload.schemaDiagnostics, undefined);
    await pool.query("UPDATE app_users SET role='admin' WHERE username='schema-http-admin'"); mode = 'current';
    const burst = await Promise.all(Array.from({ length: 15 }, read));
    assert.ok(burst.some(result => result.response.status === 429));
    for (const result of burst) assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(peak, 1); assert.equal(active, 0);
    t.diagnostic(JSON.stringify({ anonymousRefused: true, requesterRefusedBeforeScan: true, revocationRefusedAfterScan: true,
      realReader: true, checkedAnchors: 164, missingIndexObservedWithoutRepair: true, busyAndUnavailable: true,
      noStore: true, rateLimited: true, maxActiveScans: peak, noQueuedScan: true, ledgerAndCatalogPreserved: true }));
  }, async () => {
    release.resolve(); if (pending) await pending;
    await withWorkerTaskCleanup(async () => { if (renamed) await pool.query('ALTER INDEX fixture_schema_http_missing_index RENAME TO operation_runs_pending_dispatch_idx'); }, async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); });
          await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
});
