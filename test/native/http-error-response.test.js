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
import { createSystemModule } from '/app/server-dist/system-module.js';
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

test('packaged HTTP error boundary preserves public contracts and refuses unexpected native details', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  process.env.HARMONIARR_BOOTSTRAP_OWNER_USERNAME = 'http-error-admin';
  process.env.HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE = 'PRIVATE-owner-claim-fixture-code';
  const pool = getPool(), results = [], path = '/api/v1/system/overview';
  let runtime, fault = null, serialized = false, nativeEndedAndAbsent = false;
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createPushModule: () => createPushModule({ pushNotificationService: {} }),
    createSystemModule: options => {
      const module = createSystemModule({ ...options, dependencyHealthService: { getDependencyHealth: async () => [] } });
      return { ...module, routeDependencies: { ...module.routeDependencies, getOverview: async args => {
        if (fault) throw await fault();
        return module.routeDependencies.getOverview(args);
      } } };
    },
  });
  const http = createSessionHttpClient('http://127.0.0.1:3000');
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
  });
  async function checked(url, status, code, options) {
    const before = await snapshot(), result = await http.requestJson(url, options);
    assert.equal(result.response.status, status); assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(result.response.headers.get('x-secret'), null);
    if (code) assert.equal(result.payload.error.code, code);
    assert.doesNotMatch(JSON.stringify(result.payload), /PRIVATE|SELECT secret|23505|57P01|ENOENT|pg_sleep|\.pem|terminated due/u);
    assert.equal(await snapshot(), before); return result.payload;
  }
  async function raw(status, code, options) {
    const before = await snapshot(), response = await fetch('http://127.0.0.1:3000' + path, options), payload = await response.json();
    assert.equal(response.status, status); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(payload.error.code, code);
    assert.ok(!JSON.stringify(payload).includes('PRIVATE')); assert.equal(await snapshot(), before);
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await checked(path, 401, 'auth_required'); results.push('anonymous-public-refusal');
    const bootstrap = { username: 'http-error-admin', password: 'HttpErrorFixture123!', claimCode: 'wrong-fixture-code' };
    await checked('/api/v1/bootstrap/admin', 403, 'bootstrap_owner_claim_invalid', { method: 'POST', json: bootstrap }); results.push('legacy-bootstrap-claim-public-refusal');
    bootstrap.claimCode = process.env.HARMONIARR_BOOTSTRAP_OWNER_CLAIM_CODE;
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: bootstrap })).response.status, 201);
    assert.equal((await checked(path, 200)).providers.statusSummary.state, 'complete'); results.push('actual-authenticated-overview');
    for (const [label, error] of [
      ['unexpected-sql', Object.assign(new Error('PRIVATE SELECT secret'), { code: '23505', detail: 'PRIVATE', query: 'SELECT secret' })],
      ['unexpected-filesystem', Object.assign(new Error('PRIVATE /data/key.pem'), { code: 'ENOENT', path: '/data/key.pem' })],
      ['forged-status-expose', Object.assign(new Error('PRIVATE provider'), { status: 404, code: 'validation_error', expose: true, headers: { 'X-Secret': 'PRIVATE' } })],
      ['custom-serialization', { status: 200, message: 'PRIVATE', toJSON() { serialized = true; throw new Error('PRIVATE'); } }],
    ]) {
      fault = () => error; assert.deepEqual((await checked(path, 500, 'internal_error')).error, { code: 'internal_error', message: 'Unexpected server error' }); results.push(label);
    }
    assert.equal(serialized, false);
    fault = () => createApiError(409, 'conflict', 'Resource already exists');
    assert.equal((await checked(path, 409, 'conflict')).error.message, 'Resource already exists'); results.push('intentional-conflict');
    fault = () => createApiError(503, 'auth_lookup_unavailable', 'Authentication lookup is temporarily unavailable');
    await checked(path, 503, 'auth_lookup_unavailable'); results.push('intentional-lookup-unavailable');
    fault = async () => { const error = await terminateOwnedRead(pool); nativeEndedAndAbsent = true; return error; };
    assert.deepEqual((await checked(path, 503, 'database_unavailable')).error, { code: 'database_unavailable', message: 'Database is temporarily unavailable' }); results.push('native-owned-backend-error-end-absence');
    fault = null; await checked(path, 200); results.push('actual-recovery');
    const patch = { providers: { appleMusicTeamId: 'PRIVATE-invalid-input' } };
    await checked('/api/v1/settings', 403, 'csrf_required', { method: 'PUT', json: patch, csrf: false }); results.push('csrf-no-write');
    const validation = await checked('/api/v1/settings', 400, 'validation_error', { method: 'PUT', json: patch });
    assert.match(validation.error.message, /appleMusicTeamId/u); results.push('settings-field-validation-no-write');
    assert.equal((await checked('/api/v1/metadata/artists/1/operator?view=other', 400, 'validation_error')).error.message, 'view must be full or summary'); results.push('legacy-metadata-view-validation');
    await raw(400, 'invalid_json', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"PRIVATE":' }); results.push('malformed-json');
    await raw(413, 'payload_too_large', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 'PRIVATE'.repeat(160_000) }) }); results.push('oversized-json');
    await raw(415, 'unsupported_media_type', { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'PRIVATE' }); results.push('unsupported-content-type');
    await raw(406, 'not_acceptable', { headers: { accept: 'text/html' } }); results.push('unacceptable-response-format');
    await pool.query("UPDATE app_users SET role='requester' WHERE username='http-error-admin'");
    await checked(path, 403, 'admin_required'); results.push('current-role-refusal');
    await pool.query("UPDATE app_users SET is_disabled=TRUE WHERE username='http-error-admin'");
    await checked(path, 401, 'auth_required'); results.push('disabled-session-refusal');
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, noSettingsSecretAuditWrites: true, noStore: true, noSecretEcho: true, customSerializationNotCalled: !serialized, nativeEndedAndAbsent }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } });
    }, closePool);
  });
});
