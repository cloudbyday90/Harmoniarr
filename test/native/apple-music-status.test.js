/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { createSystemModule } from '/app/server-dist/system-module.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { persistSettings } from '/app/server-dist/settings.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createProviderHttpService } from '/app/server-dist/integrations/providers/provider-http-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Apple status separates presence and local validity through read-only authenticated application HTTP', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  process.env.APPLE_MUSIC_PRIVATE_KEY = '';
  const pem = () => generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const first = pem(), second = pem(), fallback = pem(), results = [], pool = getPool();
  const secrets = createEncryptedSecretService(), owner = createProviderHttpService({ env: {} });
  let providerCalls = 0, runtime;
  owner.request = async () => { providerCalls++; throw new Error('Unexpected status provider request'); };
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createProviderHttpService: () => owner,
    createSystemModule: options => createSystemModule({ ...options, dependencyHealthService: { getDependencyHealth: async () => [] } }),
  });
  const http = createSessionHttpClient('http://127.0.0.1:3000'), path = '/api/v1/providers/status';
  const stored = plaintextValue => secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey', plaintextValue });
  const clear = () => secrets.clearSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey' });
  const ids = (teamId, keyId) => persistSettings([
    { namespace: 'providers', settingKey: 'appleMusicTeamId', value: teamId }, { namespace: 'providers', settingKey: 'appleMusicKeyId', value: keyId },
  ]);
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
  });
  async function read(url = path, expectedStatus = 200) {
    const before = await snapshot(), result = await http.requestJson(url);
    assert.equal(result.response.status, expectedStatus); assert.equal(result.response.headers.get('cache-control'), 'no-store');
    assert.equal(await snapshot(), before); assert.equal(providerCalls, 0);
    const encoded = JSON.stringify(result.payload);
    for (const value of [first.trim(), second.trim(), fallback.trim(), 'PRIVATE-status-sentinel', 'TESTTEAM01', 'TESTKEY001']) assert.ok(!encoded.includes(value));
    assert.doesNotMatch(encoded, /BEGIN (?:EC |ENCRYPTED )?PRIVATE KEY|ciphertext|OpenSSL|SyntaxError/u);
    return result.payload;
  }
  async function status(state, configured, checks) {
    const payload = await read(); assert.equal(payload.appleMusic.configured, configured);
    assert.deepEqual(payload.appleMusic.localSigning, { state, checks }); return payload.appleMusic;
  }
  const valid = { teamId: 'valid', keyId: 'valid', privateKey: 'valid' };
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal((await read(path, 401)).error.code, 'auth_required'); results.push('anonymous-refusal-no-store');
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'apple-status-admin', password: 'AppleStatusFixture123!' } })).response.status, 201);
    await status('incomplete', false, { teamId: 'missing', keyId: 'missing', privateKey: 'missing' }); results.push('missing-credentials');
    await ids('TESTTEAM01', ''); await status('incomplete', false, { teamId: 'valid', keyId: 'missing', privateKey: 'missing' }); results.push('partial-credentials');
    await ids('TESTTEAM01', 'TESTKEY001'); process.env.APPLE_MUSIC_PRIVATE_KEY = fallback;
    await status('valid', true, valid); results.push('valid-environment-credentials');
    for (const [name, value] of [['malformed', 'PRIVATE-status-sentinel'],
      ['rsa', generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })],
      ['p384', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey.export({ type: 'pkcs8', format: 'pem' })],
      ['public', generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey.export({ type: 'spki', format: 'pem' })],
      ['oversized', first + 'X'.repeat(16_384)]]) {
      await stored(value); await status('invalid', true, { ...valid, privateKey: 'invalid' }); results.push('stored-' + name + '-precedes-valid-environment');
    }
    await stored(first); await status('valid', true, valid); results.push('valid-stored-recovery');
    await ids('PRIVATE-status-sentinel', '');
    await status('invalid', false, { teamId: 'invalid', keyId: 'missing', privateKey: 'valid' }); results.push('legacy-invalid-id-priority');
    await ids('TESTTEAM01', 'TESTKEY001'); await stored(second); await status('valid', true, valid); results.push('rotation-reread');
    await clear(); await status('valid', true, valid); results.push('clear-uses-environment-fallback');
    await stored(first);
    const encrypted = (await pool.query("SELECT encrypted_value FROM encrypted_secrets WHERE name='providers.appleMusic.privateKey'")).rows[0].encrypted_value;
    await pool.query("UPDATE encrypted_secrets SET encrypted_value=$1 WHERE name='providers.appleMusic.privateKey'", [Buffer.from('PRIVATE-status-sentinel')]);
    const partial = await read();
    assert.deepEqual(partial.appleMusic, { provider: 'apple_music', availability: 'unavailable', code: 'provider_status_unavailable' });
    assert.deepEqual(partial.statusSummary, { state: 'partial', unavailableProviders: ['appleMusic'] }); results.push('corrupt-storage-is-isolated-unavailable');
    await pool.query("UPDATE encrypted_secrets SET encrypted_value=$1 WHERE name='providers.appleMusic.privateKey'", [encrypted]);
    await status('valid', true, valid); results.push('recovery-after-storage-failure');
    const overview = await read('/api/v1/system/overview'); assert.deepEqual(overview.providers.appleMusic.localSigning, { state: 'valid', checks: valid }); results.push('administrator-system-overview-consumer');
    await pool.query("UPDATE app_users SET role='requester' WHERE username='apple-status-admin'");
    await status('valid', true, valid); assert.equal((await read('/api/v1/system/overview', 403)).error.code, 'admin_required'); results.push('existing-requester-read-scope');
    await pool.query("UPDATE app_users SET is_disabled=TRUE WHERE username='apple-status-admin'");
    assert.equal((await read(path, 401)).error.code, 'auth_required'); results.push('current-disabled-session-refusal');
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, encryptedReads: true, noWritesOnRead: true, noStore: true, noSecretEcho: true, providerCalls, applicationOverview: true, currentAuthorization: true }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } });
    }, closePool);
  });
});
