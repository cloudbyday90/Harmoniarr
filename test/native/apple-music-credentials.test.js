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
import { getPool, closePool } from '/app/server-dist/database.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createProviderCredentialsService } from '/app/server-dist/integrations/providers/provider-credentials-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Apple credential saves validate before durable effects through protected application HTTP', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pem = () => generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
  const first = pem(), second = pem(), fallback = pem(), results = [];
  process.env.APPLE_MUSIC_PRIVATE_KEY = fallback;
  const pool = getPool(), secrets = createEncryptedSecretService(), credentials = createProviderCredentialsService();
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json' });
  const http = createSessionHttpClient('http://127.0.0.1:3000');
  const save = (providers, options = {}) => http.requestJson('/api/v1/settings', { method: 'PUT', json: { providers }, ...options });
  const secret = () => secrets.getSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey' });
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
  });
  const safe = payload => {
    const encoded = JSON.stringify(payload);
    for (const value of [first.trim(), second.trim(), fallback.trim(), 'PRIVATE-input-sentinel']) assert.ok(!encoded.includes(value));
    assert.doesNotMatch(encoded, /BEGIN (?:EC |ENCRYPTED )?PRIVATE KEY/u);
  };
  async function refused(providers, status, code, options) {
    const before = await snapshot(), result = await save(providers, options);
    assert.equal(result.response.status, status); assert.equal(result.payload.error.code, code);
    safe(result.payload); assert.equal(await snapshot(), before);
  }
  let runtime, trigger = false;
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await refused({ appleMusicPrivateKey: first }, 401, 'auth_required'); results.push('anonymous-refusal-no-write');
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'apple-save-admin', password: 'AppleSaveFixture123!' } })).response.status, 201);
    await refused({ appleMusicPrivateKey: first }, 403, 'csrf_required', { csrf: false }); results.push('csrf-refusal-no-write');
    await pool.query("UPDATE app_users SET role='requester' WHERE username='apple-save-admin'");
    await refused({ appleMusicPrivateKey: first }, 403, 'admin_required');
    await pool.query("UPDATE app_users SET role='admin',must_change_password=TRUE WHERE username='apple-save-admin'");
    await refused({ appleMusicPrivateKey: first }, 403, 'reauth_required');
    await pool.query("UPDATE app_users SET must_change_password=FALSE WHERE username='apple-save-admin'"); results.push('current-role-and-forced-reauth-refusal');
    const staged = await save({ appleMusicTeamId: ' TESTTEAM01 ', appleMusicKeyId: ' TESTKEY001 ' });
    assert.equal(staged.response.status, 200); assert.equal(await secret(), null); safe(staged.payload); results.push('identifier-only-staged-setup');
    const stored = await save({ appleMusicPrivateKey: first });
    assert.equal(stored.response.status, 200); assert.equal(await secret(), first.trim()); safe(stored.payload);
    assert.equal(stored.payload.secretStatus.providers.appleMusic.privateKeySource, 'stored');
    assert.equal(await credentials.resolveAppleMusicPrivateKey(), first.trim());
    const record = (await pool.query("SELECT encrypted_value FROM encrypted_secrets WHERE name='providers.appleMusic.privateKey'")).rows[0];
    assert.ok(Buffer.isBuffer(record.encrypted_value)); assert.ok(!record.encrypted_value.toString().includes(first.trim()));
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM app_settings WHERE setting_key='appleMusicPrivateKey'")).rows[0].count, 0);
    safe((await pool.query('SELECT details FROM audit_events')).rows); results.push('encrypted-replacement-status-and-audit-privacy');
    for (const providers of [
      { appleMusicTeamId: 'PRIVATE-input-sentinel', appleMusicPrivateKey: second, requestTimeoutMs: 12000 },
      { appleMusicKeyId: 'not-valid!', appleMusicPrivateKey: second },
      { appleMusicTeamId: 'NEWTEAM001', appleMusicPrivateKey: 'PRIVATE-input-sentinel', spotifyClientSecret: 'also-pending' },
      { appleMusicPrivateKey: generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey.export({ type: 'pkcs8', format: 'pem' }) },
      { appleMusicPrivateKey: first + ' '.repeat(16_384) },
      { appleMusicPrivateKey: second, clearAppleMusicPrivateKey: true },
    ]) await refused(providers, 400, 'validation_error');
    results.push('invalid-combined-patches-preserve-settings-secret-and-audit');
    const beforeBlank = (await pool.query("SELECT encrypted_value,updated_at FROM encrypted_secrets WHERE name='providers.appleMusic.privateKey'")).rows;
    assert.equal((await save({ appleMusicPrivateKey: ' \n ', appleMusicKeyId: 'NEXTKEY001' })).response.status, 200);
    assert.deepEqual((await pool.query("SELECT encrypted_value,updated_at FROM encrypted_secrets WHERE name='providers.appleMusic.privateKey'")).rows, beforeBlank);
    results.push('blank-key-retains-ciphertext-while-id-changes');
    assert.equal((await save({ appleMusicPrivateKey: second })).response.status, 200);
    assert.equal(await credentials.resolveAppleMusicPrivateKey(), second.trim()); results.push('key-only-rotation');
    await pool.query("CREATE FUNCTION fixture_apple_secret_refusal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture secret refusal'; END $$");
    await pool.query('CREATE TRIGGER fixture_apple_secret_refusal BEFORE INSERT ON encrypted_secrets FOR EACH ROW EXECUTE FUNCTION fixture_apple_secret_refusal()'); trigger = true;
    const beforeFailure = await snapshot(), failed = await save({ appleMusicPrivateKey: first, appleMusicKeyId: 'FAILKEY001' });
    assert.equal(failed.response.status, 500); safe(failed.payload); assert.equal(await snapshot(), beforeFailure);
    await pool.query('DROP TRIGGER fixture_apple_secret_refusal ON encrypted_secrets'); trigger = false;
    await pool.query('DROP FUNCTION fixture_apple_secret_refusal()'); results.push('native-secret-write-failure-rolls-back-id-change');
    const cleared = await save({ appleMusicPrivateKey: '', clearAppleMusicPrivateKey: true, appleMusicTeamId: '' });
    assert.equal(cleared.response.status, 200); assert.equal(await secret(), null); safe(cleared.payload);
    assert.equal(cleared.payload.secretStatus.providers.appleMusic.privateKeySource, 'environment');
    assert.equal(await credentials.resolveAppleMusicPrivateKey(), fallback.trim()); results.push('explicit-clear-and-environment-fallback');
    assert.equal((await save({ appleMusicPrivateKey: first, appleMusicTeamId: 'TESTTEAM01' })).response.status, 200);
    assert.equal(await secret(), first.trim()); results.push('healthy-save-after-refusals');
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, encryptedPersistence: true, authorizationPreserved: true, refusalNoWrite: true, rollbackVerified: true, noSecretEcho: true }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (trigger) await pool.query('DROP TRIGGER fixture_apple_secret_refusal ON encrypted_secrets');
    }, async () => {
      await withWorkerTaskCleanup(async () => {
        if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
          runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
        } });
      }, closePool);
    });
  });
});
