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
import { registerMetadataRoutes } from '../../src/server/routes/metadata-routes.js';
import { registerDownloaderRoutes } from '../../src/server/routes/downloader-routes.js';
import { registerImportCandidateRoutes } from '../../src/server/routes/import-candidate-routes.js';
import { registerSlskdRoutes } from '../../src/server/routes/slskd-routes.js';
import { withServer } from '../../testing/server/http-test-helpers.js';

test('actual app and four route adapters select safe provider text and retain explicit local errors', async () => {
  let failure;
  const fail = async () => { throw failure; }, session = async () => ({ appUserId: 'operator', user: { role: 'admin' } });
  const guards = { requireSession: session, requireAdminSession: session };
  const { app, providerHttpService, plexHttpClient } = createApp({
    createDeploymentSecurityService: () => ({ getPolicy: async () => ({}) }),
    createPushModule: () => createPushModule({ pushNotificationService: {} }),
    registerMetadataRoutes: (target, dependencies) => registerMetadataRoutes(target, { ...dependencies, ...guards, searchMusicBrainzArtists: fail }),
    registerDownloaderRoutes: (target, dependencies) => registerDownloaderRoutes(target, { ...dependencies, ...guards, buildDownloaderQueue: fail }),
    registerImportCandidateRoutes: (target, dependencies) => registerImportCandidateRoutes(target, { ...dependencies, ...guards, buildImportCandidateExecutionRunDetail: fail }),
    registerSlskdRoutes: (target, dependencies) => registerSlskdRoutes(target, { ...dependencies, ...guards, getDownloads: fail }),
  });
  const metadataPath = '/api/v1/metadata/musicbrainz/artists/search?q=fixture';
  try {
    await withServer(app, async baseUrl => {
      async function check(path, status, code, message) {
        const response = await fetch(baseUrl + path), payload = await response.json();
        assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-secret'), null);
        assert.deepEqual(payload, { ok: false, error: { code, message } }); assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
      }
      for (const [path, code, status, message] of [
        [metadataPath, 'musicbrainz_misconfigured', 503, 'MusicBrainz configuration needs review'],
        [metadataPath, 'musicbrainz_request_failed', 502, 'MusicBrainz request failed. Review the request and try again.'],
        ['/api/v1/downloader/queue', 'slskd_request_failed', 502, 'Soulseek request failed. Try again.'],
        ['/api/v1/import-candidates/execution-runs/fixture', 'slskd_misconfigured', 503, 'Soulseek connection settings need review'],
        ['/api/v1/slskd/downloads', 'slskd_unauthorized', 503, 'Soulseek authentication failed'],
      ]) {
        failure = Object.assign(new Error('PRIVATE /data/key.pem upstream response'), { code, status: 200, headers: { 'X-Secret': 'PRIVATE' } });
        await check(path, status, code, message);
      }
      failure = Object.assign(new Error('PRIVATE'), { code: 'validation_error', status: 400, expose: true });
      await check(metadataPath, 500, 'internal_error', 'Unexpected server error');
      failure = createApiError(400, 'validation_error', 'query is required');
      await check(metadataPath, 400, 'validation_error', 'query is required');
      failure = createApiError(404, 'metadata_not_found', 'Artist was not found');
      await check(metadataPath, 404, 'metadata_not_found', 'Artist was not found');
      failure = Object.assign(new Error('PRIVATE database'), { code: 'ECONNRESET' });
      await check(metadataPath, 503, 'database_unavailable', 'Database is temporarily unavailable');
    });
  } finally { await providerHttpService.close(); await plexHttpClient.close(); }
});
