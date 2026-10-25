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
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { recordAuditEvent } from '../../src/server/audit.js';
import { getPool, closePool } from '../../src/server/database.js';
import { createSessionHttpClient } from '../../src/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

test('composed diagnostics and support download redact current saved roots without changing durable evidence', { timeout: 60_000 }, async t => {
  t.after(closePool);
  const application = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createSystemModule: options => createSystemModule({ ...options,
      dependencyHealthService: { getDependencyHealth: async () => [] } }),
  });
  const server = createServer(application.app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const client = createSessionHttpClient(`http://127.0.0.1:${server.address().port}`);
  const routes = ['/api/v1/system/diagnostics/recovery-state', '/api/v1/system/diagnostics/queue-state', '/api/v1/system/diagnostics/export'];
  const savePaths = music => client.requestJson('/api/v1/settings', { method: 'PUT', json: { paths: {
    music, downloads: '/private/downloads', staging: '/private/staging', transcodeTemp: '/private/transcode',
    downloadMappings: [{ slskdPrefix: 'Q:/Private Share', harmoniarrPrefix: '/private/downloads/remote' }],
  } } });
  try {
    for (const route of routes) assert.equal((await client.requestJson(route)).response.status, 401);
    assert.equal((await client.requestJson('/api/v1/bootstrap/admin', { method: 'POST',
      json: { username: 'redaction-admin', password: 'RedactionFixture123!' } })).response.status, 201);
    const saved = await savePaths('/private/音乐 Room'); assert.equal(saved.response.status, 200, JSON.stringify(saved.payload));
    const message = 'EIO reading "/private/音乐 Room/Ártist/Album Name/song.flac", retry /api/v1/system/overview';
    const store = createOperationRunStore({ operationType: 'backup_restore_apply' });
    const run = await store.createOperationRun({ status: 'failed', summary: { note: 'read /private/transcode/a',
      mapped: 'read "Q:/Private Share/Album Name/song"', publicUrl: 'https://example.org/private/音乐/a' } });
    await getPool().query('UPDATE operation_runs SET error_message = $1, finished_at = NOW() WHERE id = $2', [message, run.id]);
    await recordAuditEvent({ actorType: 'system', eventType: 'maintenance_lock_entered', summary: 'inspect /private/staging/a',
      details: { note: 'read /private/downloads/remote/a' } });
    for (const route of routes) {
      const result = await client.requestJson(route); assert.equal(result.response.status, 200);
      assert.equal(result.response.headers.get('cache-control'), 'no-store');
      const text = JSON.stringify(result.payload);
      assert.doesNotMatch(text, /音乐 Room|Album Name|Private Share|\/private\/(?:transcode|staging|downloads)/u);
      assert.match(text, /REDACTED_PATH/u); assert.ok(text.includes(run.id));
      assert.match(text, /\/api\/v1\/system\/overview/u);
      if (route.endsWith('/export')) assert.match(result.response.headers.get('content-disposition'), /^attachment;/u);
    }
    assert.equal((await getPool().query('SELECT error_message FROM operation_runs WHERE id = $1', [run.id])).rows[0].error_message, message);
    assert.equal((await savePaths('/private/replacement')).response.status, 200);
    const changed = await client.requestJson(routes[0]);
    assert.equal(changed.payload.recentFailedRuns.find(entry => entry.id === run.id).errorMessage, message);
    await getPool().query('UPDATE operation_runs SET error_message = $1 WHERE id = $2', ['EIO at /private/replacement/a', run.id]);
    const fresh = await client.requestJson(routes[0]);
    assert.equal(fresh.payload.recentFailedRuns.find(entry => entry.id === run.id).errorMessage, 'EIO at [REDACTED_PATH]');
    assert.equal((await client.requestJson('/api/v1/auth/logout', { method: 'POST', json: {} })).response.status, 200);
    t.diagnostic(JSON.stringify({ routes: 3, unauthorized: 3, savedSettings: true, currentRootAfterSave: true,
      durableMessageUnchanged: true, attachment: true, noStore: true, providersContacted: false }));
  } finally {
    await application.systemModule.runtimeResourceMonitor.stop(); server.closeIdleConnections();
    await new Promise(resolve => { server.close(resolve); });
  }
});
