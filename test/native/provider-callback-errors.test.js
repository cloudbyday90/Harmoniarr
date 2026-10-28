/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { createApp } from '/app/server-dist/app.js';
import { createApiError } from '/app/server-dist/api-error.js';
import { createProviderModule } from '/app/server-dist/provider-module.js';
import { createPushModule } from '/app/server-dist/push/push-module.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createSessionHttpClient } from '/app/shared/http-session-client.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('packaged provider callbacks bound redirect output without publishing controlled failures', { timeout: 90_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const pool = getPool(), results = [], calls = [], faults = {};
  const providers = [
    { provider: 'spotify', path: 'oauth', owner: 'completeSpotifyAuthorization', fallback: 'spotify_oauth_failed', known: 'spotify_oauth_token_exchange_failed', state: 'spotify_oauth_state_invalid' },
    { provider: 'youtube', path: 'oauth', owner: 'completeYoutubeAuthorization', fallback: 'youtube_oauth_failed', known: 'youtube_oauth_authorization_changed', state: 'youtube_oauth_state_invalid' },
    { provider: 'plex', path: 'link', owner: 'completePlexLink', fallback: 'plex_link_failed', known: 'plex_link_not_claimed', state: 'plex_link_state_invalid' },
  ];
  const completion = provider => async input => {
    calls.push({ provider, input });
    if (Object.hasOwn(faults, provider)) throw faults[provider];
    return { accessToken: 'PRIVATE-completion-result' };
  };
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json',
    createPushModule: () => createPushModule({ pushNotificationService: {} }),
    createProviderModule: options => {
      const module = createProviderModule(options);
      return { ...module, routeDependencies: { ...module.routeDependencies,
        ...Object.fromEntries(providers.map(({ provider, owner }) => [owner, completion(provider)])) } };
    },
  });
  let runtime, privateReads = 0;
  const binding = Buffer.alloc(32, 1).toString('base64url'), baseUrl = 'http://127.0.0.1:3000';
  const http = createSessionHttpClient(baseUrl);
  const snapshot = async () => JSON.stringify({
    settings: (await pool.query('SELECT row_to_json(s) FROM app_settings s ORDER BY namespace,setting_key')).rows,
    secrets: (await pool.query('SELECT row_to_json(s) FROM encrypted_secrets s ORDER BY name')).rows,
    audit: (await pool.query("SELECT row_to_json(s) FROM audit_events s WHERE event_type='settings_updated' ORDER BY id")).rows,
    operations: (await pool.query('SELECT row_to_json(s) FROM operation_runs s ORDER BY id')).rows,
  });
  async function checked(row, expected, cookie = true) {
    const before = await snapshot(), count = calls.length;
    const name = row.provider === 'plex' ? 'harmoniarr_plex_link_binding' : `harmoniarr_${row.provider}_binding`;
    const response = await fetch(`${baseUrl}/api/v1/providers/${row.provider}/${row.path}/callback?code=PRIVATE-code&state=PRIVATE-state&error=PRIVATE-error&error_description=PRIVATE-description`,
      { redirect: 'manual', headers: { accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', ...(cookie ? { cookie: name + '=' + binding } : {}) } });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get('location'), `/app/settings?${row.provider}OAuth=${expected ? 'failed&code=' + expected : 'linked'}`);
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('set-cookie'), null);
    assert.doesNotMatch(JSON.stringify([...response.headers]) + await response.text(), /PRIVATE|key\.pem/u);
    assert.equal(calls.length, count + (cookie ? 1 : 0));
    if (cookie) {
      assert.equal(calls.at(-1).provider, row.provider); assert.equal(calls.at(-1).input.browserBinding, binding);
      assert.equal(calls.at(-1).input.state, 'PRIVATE-state');
      if (row.provider !== 'plex') assert.equal(calls.at(-1).input.code, 'PRIVATE-code');
    }
    assert.equal(await snapshot(), before);
  }
  await withWorkerTaskCleanup(async () => {
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    assert.equal((await http.requestJson('/api/v1/bootstrap/admin', { method: 'POST', json: { username: 'callback-error-admin', password: 'CallbackFixture123!' } })).response.status, 201);
    for (const row of providers) {
      await checked(row, row.state, false); results.push(row.provider + '-missing-binding-before-completion');
      for (const [name, error, expected] of [
        ['known', { code: row.known, get message() { privateReads++; throw new Error('PRIVATE'); }, toJSON() { privateReads++; throw new Error('PRIVATE'); } }, row.known],
        ['private-code', { code: 'PRIVATE /data/key.pem\r\nX-Secret: PRIVATE' }, row.fallback],
        ['cross-provider', { code: row.provider === 'plex' ? 'spotify_oauth_state_invalid' : 'plex_link_state_invalid' }, row.fallback],
        ['coercion', { code: { toString() { privateReads++; throw new Error('PRIVATE'); } } }, row.fallback],
        ['throwing-getter', new Proxy({}, { get() { throw new Error('PRIVATE'); } }), row.fallback],
        ['null', null, row.fallback],
      ]) {
        faults[row.provider] = error; await checked(row, expected); results.push(row.provider + '-' + name);
      }
      const captured = createApiError(400, row.known, 'PRIVATE'); captured.code = 'PRIVATE-mutated';
      faults[row.provider] = captured; await checked(row, row.known); results.push(row.provider + '-captured-code');
      const unknown = createApiError(400, 'PRIVATE', 'PRIVATE'); unknown.code = row.known;
      faults[row.provider] = unknown; await checked(row, row.fallback); results.push(row.provider + '-captured-unknown');
      delete faults[row.provider]; await checked(row, null); results.push(row.provider + '-controlled-success-recovery');
    }
    assert.equal(privateReads, 0);
    t.diagnostic(JSON.stringify({ results, actualHttp: true, actualPostgres: true, noStore: true, noReferrer: true, noSecretEcho: true,
      noSettingsSecretAuditOrOperationWrites: true, privateReads, noProviderNetwork: true }));
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } });
    }, closePool);
  });
});
