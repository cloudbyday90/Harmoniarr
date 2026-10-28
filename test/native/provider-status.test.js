/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { createProviderModule } from '/app/server-dist/provider-module.js';
import { createSystemModule } from '/app/server-dist/system-module.js';
import { createProviderStatusService } from '/app/server-dist/integrations/providers/provider-status-service.js';
import { createProviderHttpService } from '/app/server-dist/integrations/providers/provider-http-service.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { persistSettings } from '/app/server-dist/settings.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();

// This connection belongs only to this disposable fixture; never terminate a pool peer.
async function terminatedRead(pool) {
  const client = new pg.Client(buildConnectionConfig());
  client.on('error', () => {});
  await client.connect();
  const ended = new Promise(resolve => { client.once('end', resolve); });
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
    const outcome = await observed;
    assert.equal(outcome.error?.code, '57P01');
    await client.end(); await ended;
    assert.equal(Number((await pool.query('SELECT count(*) AS count FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].count), 0);
    return outcome.error;
  } finally { await client.end(); }
}

test('provider status isolates local observations and preserves native database failure through packaged HTTP', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  process.env.APPLE_MUSIC_PRIVATE_KEY = '';
  const pool = getPool(), secrets = createEncryptedSecretService(), results = [];
  const privateKey = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const owner = createProviderHttpService({ env: {} });
  let providerCalls = 0, mode = null, nativeFailure, runtime;
  owner.request = async () => { providerCalls++; throw new Error('Unexpected provider request'); };
  const names = ['plex', 'spotify', 'youtube', 'appleMusic'];
  const methods = { plex: 'plexOwnerLinkService', spotify: 'spotifyOAuthService', youtube: 'youtubeOAuthService', appleMusic: 'appleMusicStatusService' };
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createProviderHttpService: () => owner,
    createSystemModule: options => createSystemModule({ ...options, dependencyHealthService: { getDependencyHealth: async () => [] } }),
    createProviderModule: options => createProviderModule({ ...options, providerStatusService: createProviderStatusService({ readers: Object.fromEntries(names.map(name => [name, async () => {
      if (mode === 'database' && name === 'plex') throw nativeFailure;
      if (mode === name || mode === 'all') throw new Error('PRIVATE-provider-status-sentinel');
      return app.providerModule[methods[name]].buildStatus();
    }])) }) }),
  });
  const http = createSessionHttpClient('http://127.0.0.1:3000'), path = '/api/v1/providers/status';
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
  });
  async function read(url = path, expected = 200) {
    const before = await snapshot(), { response, payload } = await http.requestJson(url);
    assert.equal(response.status, expected); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(await snapshot(), before); assert.equal(providerCalls, 0);
    assert.doesNotMatch(JSON.stringify(payload), /PRIVATE-provider-status-sentinel|BEGIN PRIVATE KEY|57P01|pg_sleep|ciphertext|terminated due/u);
    assert.ok(!JSON.stringify(payload).includes(privateKey.trim()));
    return payload;
  }
  const unavailable = name => ({ provider: name === 'appleMusic' ? 'apple_music' : name, availability: 'unavailable', code: 'provider_status_unavailable' });
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal((await read(path, 401)).error.code, 'auth_required'); results.push('anonymous-refusal');
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'status-admin', password: 'ProviderStatusFixture123!' } })).response.status, 201);
    await persistSettings([{ namespace: 'providers', settingKey: 'appleMusicTeamId', value: 'TESTTEAM01' }, { namespace: 'providers', settingKey: 'appleMusicKeyId', value: 'TESTKEY001' }]);
    await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey', plaintextValue: privateKey });
    const complete = await read(); assert.equal(complete.appleMusic.localSigning.state, 'valid');
    assert.deepEqual(complete.statusSummary, { state: 'complete', unavailableProviders: [] }); results.push('actual-owner-complete');
    const encrypted = (await pool.query("SELECT encrypted_value FROM encrypted_secrets WHERE name='providers.appleMusic.privateKey'")).rows[0].encrypted_value;
    await pool.query("UPDATE encrypted_secrets SET encrypted_value=$1 WHERE name='providers.appleMusic.privateKey'", [Buffer.from('PRIVATE-provider-status-sentinel')]);
    const partial = await read(); assert.deepEqual(partial.appleMusic, unavailable('appleMusic'));
    for (const name of names.slice(0, 3)) assert.deepEqual(partial[name], complete[name]);
    assert.deepEqual(partial.statusSummary, { state: 'partial', unavailableProviders: ['appleMusic'] }); results.push('actual-corrupt-storage-healthy-siblings');
    const overview = await read('/api/v1/system/overview'); assert.deepEqual(overview.providers.appleMusic, unavailable('appleMusic'));
    assert.deepEqual(overview.providers.statusSummary, { state: 'partial', unavailableProviders: ['appleMusic'] }); results.push('actual-overview-partial');
    await pool.query("UPDATE encrypted_secrets SET encrypted_value=$1 WHERE name='providers.appleMusic.privateKey'", [encrypted]);
    assert.deepEqual(await read(), complete); results.push('actual-storage-recovery');
    for (const name of names) {
      mode = name; const payload = await read(); assert.deepEqual(payload[name], unavailable(name));
      assert.deepEqual(payload.statusSummary, { state: 'partial', unavailableProviders: [name] });
      for (const peer of names.filter(candidate => candidate !== name)) assert.deepEqual(payload[peer], complete[peer]);
      results.push('injected-local-' + name);
    }
    mode = 'all'; const all = await read(); assert.deepEqual(all.statusSummary, { state: 'unavailable', unavailableProviders: names });
    for (const name of names) assert.deepEqual(all[name], unavailable(name)); results.push('injected-all-unavailable');
    nativeFailure = await terminatedRead(pool); mode = 'database';
    const failure = await read(path, 503); assert.deepEqual(failure.error, { code: 'database_unavailable', message: 'Database is temporarily unavailable' }); results.push('native-owned-backend-terminated-ended-absent-503');
    mode = null; assert.deepEqual(await read(), complete); results.push('database-recovery');
    await pool.query("UPDATE app_users SET role='requester' WHERE username='status-admin'");
    assert.deepEqual(await read(), complete); assert.equal((await read('/api/v1/system/overview', 403)).error.code, 'admin_required'); results.push('requester-read-admin-overview-refusal');
    await pool.query("UPDATE app_users SET is_disabled=TRUE WHERE username='status-admin'");
    assert.equal((await read(path, 401)).error.code, 'auth_required'); results.push('disabled-session-refusal');
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, actualEncryptedRead: true, nativeBackendEndedAndAbsent: true, noWritesOnRead: true, noStore: true, noSecretEcho: true, providerCalls }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } });
    }, closePool);
  });
});
