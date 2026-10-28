/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createApiError } from '../../src/server/api-error.js';
import { createPushModule } from '../../src/server/push/push-module.js';
import { normalizeMetadataArtistReadView } from '../../src/server/metadata/metadata-artist-read-view.js';
import { normalizeOperatorArtistMonitoringPatch } from '../../src/server/metadata/operator-artist-monitoring-service.js';
import { decodeTimelineCursor } from '../../src/server/timeline-pagination.js';
import { normalizeStageSummaryLimit } from '../../src/server/import-candidates/import-candidate-stage-summary.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

test('actual app middleware bounds unexpected failures and preserves public validation, conflict and dependency errors', async () => {
  let fail = () => { throw new Error('PRIVATE-key /data/key.pem SELECT secret'); };
  const { app, providerHttpService, plexHttpClient } = createApp({
    createDeploymentSecurityService: () => ({ getPolicy: async () => ({}) }),
    createPushModule: () => createPushModule({ pushNotificationService: {} }),
    registerAuthRoutes: target => {
      target.get('/api/v1/test/error', async () => fail());
      target.post('/api/v1/test/error', async () => fail());
    },
  });
  try {
    await withServer(app, async baseUrl => {
      const request = async (status, code, message, options) => {
        const response = await fetch(baseUrl + '/api/v1/test/error', options);
        assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('x-secret'), null);
        const payload = await response.json(); assert.deepEqual(payload, { ok: false, error: { code, message } });
        assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
      };
      for (const error of [new Error('PRIVATE-key /data/key.pem SELECT secret'), Object.assign(new Error('PRIVATE-native'), { status: 404, code: 'validation_error', expose: true, headers: { 'X-Secret': 'PRIVATE' } }), { status: 799, code: 'PRIVATE', message: 'PRIVATE' }]) {
        fail = () => { throw error; }; await request(500, 'internal_error', 'Unexpected server error');
      }
      for (const [validate, message] of [[() => normalizeMetadataArtistReadView('other'), 'view must be full or summary'], [() => normalizeOperatorArtistMonitoringPatch({}), 'isMonitored must be a boolean'], [() => decodeTimelineCursor('not-json'), 'before must be a valid cursor'], [() => normalizeStageSummaryLimit(0), 'limit must be an integer between 1 and 1000']]) {
        fail = validate; await request(400, 'validation_error', message);
      }
      fail = () => { throw createApiError(409, 'conflict', 'Resource already exists'); }; await request(409, 'conflict', 'Resource already exists');
      fail = () => { throw Object.assign(new Error('PRIVATE connection'), { code: 'ECONNREFUSED' }); }; await request(503, 'database_unavailable', 'Database is temporarily unavailable');
      fail = () => { throw createApiError(503, 'auth_lookup_unavailable', 'Authentication lookup is temporarily unavailable'); }; await request(503, 'auth_lookup_unavailable', 'Authentication lookup is temporarily unavailable');
      await request(400, 'invalid_json', 'Request body must contain valid JSON', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"PRIVATE":' });
      await request(413, 'payload_too_large', 'Request body exceeds the supported size limit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'PRIVATE'.repeat(160_000) }) });
    });
  } finally { await providerHttpService.close(); await plexHttpClient.close(); }
});
