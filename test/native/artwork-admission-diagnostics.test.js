/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createSystemModule } from '../../src/server/system-module.js';
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';
import { createArtworkPolicyService } from '../../src/server/artwork/artwork-policy-service.js';
import { createArtworkIngestionService } from '../../src/server/artwork/artwork-ingestion-service.js';
import { createArtworkIngestionAdmission } from '../../src/server/artwork/artwork-ingestion-admission.js';
import { initialArtworkMemoryReservation } from '../../src/server/artwork/artwork-memory-reservation.js';
import { createSessionHttpClient } from '../../src/shared/http-session-client.js';
import { getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('composed administrator diagnostics observe the actual held gate and cached process sample without launching work', { timeout: 60_000 }, async t => {
  t.after(closePool); let providerChecks = 0;
  const gate = createArtworkIngestionAdmission(); const release = Promise.withResolvers(); const tasks = [];
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createArtworkModule: options => {
      const policy = createArtworkPolicyService({ settingsService: options.settingsService });
      return createArtworkModule({ ...options, artworkPolicyService: policy,
        artworkIngestionService: createArtworkIngestionService({ artworkPolicyService: policy, artworkIngestionAdmission: gate }) });
    },
    createSystemModule: options => createSystemModule({ ...options, dependencyHealthService: { getDependencyHealth: async () => { providerChecks++; return []; } } }),
  });
  const server = createServer(application.app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createSessionHttpClient(`http://127.0.0.1:${server.address().port}`);
  try {
    assert.equal((await client.requestJson('/api/v1/system/diagnostics/queue-state')).response.status, 401);
    const bootstrap = await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'admission-admin', password: 'AdmissionFixture123!' } }); assert.equal(bootstrap.response.status, 201);
    const read = () => client.requestJson('/api/v1/system/diagnostics/queue-state');
    const waiting = await read(); assert.equal(waiting.payload.runtime.artworkAdmission.active, 0); assert.equal(waiting.payload.runtime.processMemory, null);
    await application.systemModule.runtimeResourceMonitor.tick();
    tasks.push(gate.run(async () => release.promise, { inputBytes: 800 })); tasks.push(gate.run(async () => {}, { inputBytes: 800, weight: 800 }));
    const active = await read(); assert.equal(active.response.headers.get('cache-control'), 'no-store');
    const snapshot = active.payload.runtime.artworkAdmission; assert.equal(snapshot.active, 1); assert.equal(snapshot.queued, 1); assert.equal(snapshot.queuedInputBytes, 800);
    assert.equal(snapshot.reservedBytes, initialArtworkMemoryReservation(800)); assert.equal(Object.keys(snapshot).length, 10);
    assert.ok(active.payload.runtime.processMemory.rssBytes > 0); assert.equal(providerChecks, 0);
    const overview = await client.requestJson('/api/v1/system/overview'); assert.equal(overview.response.status, 200); assert.equal(overview.response.headers.get('cache-control'), 'no-store');
    assert.equal(overview.payload.runtime.artworkAdmission.reservedBytes, snapshot.reservedBytes); assert.equal(providerChecks, 1);
    const exported = await client.requestJson('/api/v1/system/diagnostics/export'); assert.equal(exported.response.status, 200); assert.equal(exported.response.headers.get('cache-control'), 'no-store');
    assert.equal(exported.payload.diagnostics.overview.runtime.artworkAdmission.reservedBytes, snapshot.reservedBytes); assert.equal(providerChecks, 2);
    assert.equal((await getPool().query('SELECT count(*)::int AS count FROM artwork_assets')).rows[0].count, 0);
    release.resolve(); await Promise.all(tasks);
    const settled = await read(); assert.equal(settled.payload.runtime.artworkAdmission.reservedBytes, 0); assert.equal(settled.payload.runtime.artworkAdmission.queued, 0);
    assert.equal((await client.requestJson('/api/v1/auth/logout', { method: 'POST', json: {} })).response.status, 200);
    assert.equal(providerChecks, 2);
    t.diagnostic(JSON.stringify({ active: snapshot, cachedProcessSample: true, queueProviderChecks: 0, overviewAndExportProviderChecks: providerChecks, retired: settled.payload.runtime.artworkAdmission, nativeWorkLaunched: false, assetRows: 0 }));
  } finally {
    release.resolve(); await Promise.allSettled(tasks); await application.systemModule.runtimeResourceMonitor.stop();
    server.closeIdleConnections(); await new Promise(resolve => { server.close(resolve); });
  }
});
