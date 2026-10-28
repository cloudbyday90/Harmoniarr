/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { createApiError } from '/app/server-dist/api-error.js';
import { createMetadataModule } from '/app/server-dist/metadata/metadata-module.js';
import { createDownloaderModule } from '/app/server-dist/downloader/downloader-module.js';
import { createImportCandidateModule } from '/app/server-dist/import-candidates/import-candidate-module.js';
import { createSlskdModule } from '/app/server-dist/slskd/slskd-module.js';
import { createPushModule } from '/app/server-dist/push/push-module.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

async function terminateOwnedRead(pool) {
  const client = new pg.Client(buildConnectionConfig()); client.on('error', () => {});
  await client.connect(); const ended = new Promise(resolve => { client.once('end', resolve); });
  try {
    const pid = Number((await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    const observed = client.query('SELECT pg_sleep(30)').then(() => ({ succeeded: true }), error => ({ error }));
    let active = false;
    for (let count = 0; count < 500; count++) {
      const row = (await pool.query('SELECT state,query FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0];
      if (row?.state === 'active' && row.query === 'SELECT pg_sleep(30)') { active = true; break; }
      await delay(10);
    }
    assert.equal(active, true);
    assert.equal((await pool.query('SELECT pg_terminate_backend($1,5000) AS terminated', [pid])).rows[0].terminated, true);
    const outcome = await observed; assert.equal(outcome.error?.code, '57P01');
    await client.end(); await ended;
    assert.equal(Number((await pool.query('SELECT count(*) AS count FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].count), 0);
    return outcome.error;
  } finally { await client.end(); }
}

test('provider route catalogs bound four adapter families through actual app auth and PostgreSQL', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), results = [], faults = {}, calls = {};
  let runtime, privateReads = 0, nativeEndedAndAbsent = false;
  const paths = { metadata: '/api/v1/metadata/musicbrainz/artists/search?q=fixture', downloader: '/api/v1/downloader/queue', candidate: '/api/v1/import-candidates/execution-runs/fixture', soulseek: '/api/v1/slskd/downloads' };
  const observe = (scope, success = null) => async () => {
    calls[scope] = (calls[scope] ?? 0) + 1;
    if (faults[scope]) throw await faults[scope]();
    return success;
  };
  const wrap = (module, overrides) => ({ ...module, routeDependencies: { ...module.routeDependencies, ...overrides } });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createPushModule: () => createPushModule({ pushNotificationService: {} }),
    createMetadataModule: options => wrap(createMetadataModule(options), { searchMusicBrainzArtists: observe('metadata', { results: [] }) }),
    createDownloaderModule: options => wrap(createDownloaderModule(options), { buildDownloaderQueue: observe('downloader', { transfers: [] }), clearCompletedDownloaderTransfers: observe('mutation-downloader') }),
    createImportCandidateModule: options => wrap(createImportCandidateModule(options), { buildImportCandidateExecutionRunDetail: observe('candidate'), ingestSlskdSearchResponses: observe('mutation-candidate') }),
    createSlskdModule: options => wrap(createSlskdModule(options), { getDownloads: observe('soulseek', []), startSearch: observe('mutation-soulseek') }),
  });
  const http = createSessionHttpClient('http://127.0.0.1:3000');
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
    operations: (await pool.query('SELECT row_to_json(s) FROM operation_runs s ORDER BY id')).rows,
  });
  async function checked(path, status, code, message, options) {
    const before = await snapshot(), result = await http.requestJson(path, options);
    assert.equal(result.response.status, status); assert.equal(result.response.headers.get('cache-control'), 'no-store'); assert.equal(result.response.headers.get('x-secret'), null);
    if (code) assert.equal(result.payload.error.code, code);
    if (message) assert.equal(result.payload.error.message, message);
    assert.doesNotMatch(JSON.stringify(result.payload), /PRIVATE|BEGIN PRIVATE KEY|\.pem|57P01|pg_sleep|SELECT secret/u);
    assert.equal(await snapshot(), before); return result.payload;
  }
  const raw = code => Object.assign(new Error('PRIVATE upstream /data/key.pem response'), { code, status: 200, cause: 'PRIVATE', headers: { 'X-Secret': 'PRIVATE' } });
  const musicBrainzCases = [
    ['musicbrainz_not_found', 404, 'MusicBrainz resource was not found'],
    ['musicbrainz_misconfigured', 503, 'MusicBrainz configuration needs review'],
    ['musicbrainz_unavailable', 503, 'MusicBrainz is temporarily unavailable'],
    ['musicbrainz_request_failed', 502, 'MusicBrainz request failed. Review the request and try again.'],
    ['musicbrainz_invalid_response', 502, 'MusicBrainz returned an invalid response'],
  ];
  const soulseekCases = [
    ['slskd_misconfigured', 503, 'Soulseek connection settings need review'],
    ['slskd_unauthorized', 503, 'Soulseek authentication failed'],
    ['slskd_unavailable', 503, 'Soulseek is temporarily unavailable'],
    ['slskd_request_failed', 502, 'Soulseek request failed. Try again.'],
  ];
  const casesByScope = [['metadata', musicBrainzCases], ...['downloader', 'candidate', 'soulseek'].map(scope => [scope, soulseekCases])];
  const mutations = [['downloader', '/api/v1/downloader/actions/clear-completed'], ['candidate', '/api/v1/import-candidates/slskd/searches/fixture'], ['soulseek', '/api/v1/slskd/searches']];
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    for (const path of Object.values(paths)) await checked(path, 401, 'auth_required'); results.push('anonymous-refusal-all-adapters');
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'route-error-admin', password: 'ProviderRouteFixture123!' } })).response.status, 201); results.push('actual-bootstrap-session');
    for (const [scope, cases] of casesByScope) {
      for (const [code, status, message] of cases) {
        faults[scope] = () => raw(code); await checked(paths[scope], status, code, message); results.push(scope + '-' + code);
      }
    }
    for (const code of ['validation_error', 'metadata_not_found', 'app_user_not_found']) {
      faults.metadata = () => Object.assign(new Error('PRIVATE local lookalike'), { code, status: 400, expose: true });
      await checked(paths.metadata, 500, 'internal_error', 'Unexpected server error');
    }
    results.push('unowned-local-errors-not-promoted');
    for (const [status, code, message] of [[400, 'validation_error', 'query is required'], [404, 'metadata_not_found', 'Artist was not found'], [409, 'conflict', 'Resource already exists']]) {
      const error = createApiError(status, code, message); error.code = 'musicbrainz_request_failed'; error.message = 'PRIVATE';
      faults.metadata = () => error; await checked(paths.metadata, status, code, message);
    }
    results.push('owned-local-descriptor-precedence');
    await checked('/api/v1/metadata/artists/00000000-0000-0000-0000-000000000000/operator?view=other', 400, 'validation_error', 'view must be full or summary'); results.push('actual-local-view-validation');
    faults.metadata = () => raw('slskd_request_failed'); await checked(paths.metadata, 500, 'internal_error', 'Unexpected server error'); results.push('cross-provider-refusal');
    for (const scope of Object.keys(paths)) {
      faults[scope] = () => ({ code: scope === 'metadata' ? 'musicbrainz_request_failed' : 'slskd_request_failed', get message() { privateReads++; throw new Error('PRIVATE'); }, toJSON() { privateReads++; throw new Error('PRIVATE'); } });
      await checked(paths[scope], 502, scope === 'metadata' ? 'musicbrainz_request_failed' : 'slskd_request_failed');
    }
    assert.equal(privateReads, 0); results.push('private-message-and-serialization-not-read');
    faults.downloader = () => createApiError(500, 'slskd_request_failed', 'PRIVATE provider public text');
    await checked(paths.downloader, 502, 'slskd_request_failed', 'Soulseek request failed. Try again.'); results.push('owned-provider-text-replaced');
    faults.metadata = async () => { const error = await terminateOwnedRead(pool); nativeEndedAndAbsent = true; return error; };
    await checked(paths.metadata, 503, 'database_unavailable', 'Database is temporarily unavailable'); results.push('native-database-error-end-absence');
    faults.metadata = null; faults.downloader = null;
    await checked(paths.metadata, 200); await checked(paths.downloader, 200); results.push('controlled-service-success-recovery');
    for (const [scope, path] of mutations) {
      faults['mutation-' + scope] = () => raw('slskd_request_failed');
      await checked(path, 403, 'csrf_required', null, { method: 'POST', json: {}, csrf: false }); assert.equal(calls['mutation-' + scope] ?? 0, 0);
    }
    results.push('csrf-refusal-before-service-no-runs');
    for (const [scope, path] of mutations) {
      await checked(path, 502, 'slskd_request_failed', 'Soulseek request failed. Try again.', { method: 'POST', json: {} }); assert.equal(calls['mutation-' + scope], 1);
    }
    results.push('guarded-post-provider-failure-no-runs');
    await pool.query("UPDATE app_users SET role='requester' WHERE username='route-error-admin'");
    faults.metadata = () => raw('musicbrainz_unavailable'); await checked(paths.metadata, 503, 'musicbrainz_unavailable');
    for (const scope of ['downloader', 'candidate', 'soulseek']) await checked(paths[scope], 403, 'admin_required');
    for (const [, path] of mutations) await checked(path, 403, 'admin_required', null, { method: 'POST', json: {} }); results.push('current-requester-read-and-admin-refusal');
    await pool.query("UPDATE app_users SET is_disabled=TRUE WHERE username='route-error-admin'");
    for (const path of Object.values(paths)) await checked(path, 401, 'auth_required'); results.push('disabled-session-refusal');
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, noSettingsSecretAuditOrOperationWrites: true, noStore: true, noSecretEcho: true, privateReads, nativeEndedAndAbsent }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } });
    }, closePool);
  });
});
