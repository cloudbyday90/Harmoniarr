/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { AsyncLocalStorage } from 'node:async_hooks';
import test from 'node:test';
import pg from 'pg';
import { createApp } from '/app/server-dist/app.js';
import { createProviderModule } from '/app/server-dist/provider-module.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { getSessionFromRequest } from '/app/server-dist/auth.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createSpotifyOAuthService } from '/app/server-dist/integrations/spotify/spotify-oauth-service.js';
import { createYouTubeOAuthService } from '/app/server-dist/integrations/youtube/youtube-oauth-service.js';
import { createOAuthLinkCommandService } from '/app/server-dist/integrations/providers/oauth-link-command-service.js';
import { createOAuthLinkOwnerService } from '/app/server-dist/integrations/providers/oauth-link-owner-service.js';
import { createOAuthLinkStateService } from '/app/server-dist/integrations/providers/oauth-link-state-service.js';
import { createProviderCredentialsService } from '/app/server-dist/integrations/providers/provider-credentials-service.js';
import { oauthLinkNames, oauthCredentialsFingerprint } from '/app/server-dist/integrations/providers/oauth-link-policy.js';
import { createPlexCallbackRetentionService } from '/app/server-dist/integrations/plex/plex-callback-retention-service.js';
import { loadSettings, persistSettings } from '/app/server-dist/settings.js';
import { startAuthLookup } from '/app/server-dist/auth-lookup-service.js';
import { startSessionWriteTransaction } from '/app/server-dist/session-write-transaction-service.js';
import { recordAuditEvent } from '/app/server-dist/audit.js';
import { createMaintenanceLockService } from '/app/server-dist/recovery/maintenance-lock-service.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('Spotify and YouTube publication owns exact administrator authority and all local OAuth token writers', { timeout: 180_000 }, async t => {
  process.env.HARMONIARR_PG_POOL_MAX = '4'; process.env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS = '500';
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.HARMONIARR_SECURE_COOKIES = 'false';
  const pool = getPool(), observer = new pg.Client(buildConnectionConfig()), writer = new pg.Client(buildConnectionConfig());
  const secrets = createEncryptedSecretService(), credentialsService = createProviderCredentialsService(), ownership = new AsyncLocalStorage();
  const results = [], active = new Set(), releases = new Set(), callbacks = {}, providers = ['spotify', 'youtube'];
  const binding = Buffer.alloc(32, 1).toString('base64url'), other = Buffer.alloc(32, 2).toString('base64url'), baseUrl = 'http://127.0.0.1:3000';
  const metadata = { ipAddress: '127.0.0.1', userAgent: 'native-oauth-link' };
  let runtime, session, cookies, csrf, provider, networkCalls = 0;
  const names = () => oauthLinkNames(provider), stateName = key => names().pending + key;
  const track = promise => { active.add(promise); promise.then(() => active.delete(promise), () => active.delete(promise)); return promise; };
  const trackedPool = { async connect() {
    const context = ownership.getStore(); assert.ok(context);
    const client = await pool.connect(), release = client.release; context.clients++;
    client.release = function (...args) { client.release = release; const result = Reflect.apply(release, this, args); context.clients--; return result; };
    return client;
  } };
  const fetchFn = async (url, request) => {
    assert.equal(ownership.getStore()?.clients, 0, 'Provider work must hold no owned checkout'); networkCalls++;
    const p = url.startsWith('https://accounts.spotify.com') ? 'spotify' : 'youtube', body = new URLSearchParams(request.body);
    assert.equal(request.method, 'POST'); assert.equal(request.redirect, 'error');
    if (url.endsWith('/revoke')) {
      assert.equal(p, 'youtube'); assert.equal(await secrets.getSecretValue({ secretType: 'integration_oauth', name: oauthLinkNames(p).token, queryable: observer }), null);
      return new Response('', { status: 200 });
    }
    assert.equal(url, p === 'spotify' ? 'https://accounts.spotify.com/api/token' : 'https://oauth2.googleapis.com/token');
    assert.equal(body.get('client_id'), 'fixture-' + p);
    if (p === 'youtube') assert.equal(body.get('client_secret'), 'fixture-client-secret'); else assert.equal(body.has('client_secret'), false);
    if (body.get('grant_type') === 'authorization_code') {
      assert.ok(body.get('code_verifier')); assert.equal(body.get('redirect_uri'), baseUrl + '/api/v1/providers/' + p + '/oauth/callback');
    } else assert.equal(body.get('grant_type'), 'refresh_token');
    return Response.json({ access_token: 'fixture-' + p + '-token', refresh_token: 'fixture-' + p + '-refresh', expires_in: 3600, scope: 'read', token_type: 'Bearer' });
  };
  async function fingerprint(p, client) {
    const settings = await loadSettings(client), clientId = settings.providers[p + 'ClientId'];
    const clientSecret = p === 'youtube' ? await credentialsService.resolveYoutubeClientSecret(client) : null;
    return oauthCredentialsFingerprint(p, { clientId, ...(p === 'youtube' ? { extraTokenParams: { client_secret: clientSecret }, extraRefreshParams: { client_secret: clientSecret } } : {}) });
  }
  function make({ beforePublish, beforeRefresh, commandOptions = {}, startTransactionFn } = {}, p = provider) {
    const startReadFn = (work, settings) => startAuthLookup(work, { ...settings, getPoolFn: () => trackedPool });
    const owner = createOAuthLinkOwnerService({ provider: p, startTransactionFn: startTransactionFn ?? ((work, settings) => startSessionWriteTransaction(work, { ...settings, getPoolFn: () => trackedPool })) });
    const command = createOAuthLinkCommandService({ provider: p, encryptedSecretService: secrets, owner, readCredentialsFingerprint: client => fingerprint(p, client), ...commandOptions });
    const service = (p === 'spotify' ? createSpotifyOAuthService : createYouTubeOAuthService)({ encryptedSecretService: secrets, fetchFn, startReadFn,
      stateService: createOAuthLinkStateService({ provider: p, encryptedSecretService: secrets, startReadFn }),
      commandService: { ...command, async complete(input) { if (beforePublish) await beforePublish(); return command.complete(input); },
        async refresh(input) { if (beforeRefresh) await beforeRefresh(); return command.refresh(input); } } });
    return Object.fromEntries(['startAuthorization', 'completeAuthorization', 'clearAuthorization', 'resolveAccessToken'].map(name => [name, (...args) => ownership.run({ clients: 0 }, () => service[name](...args))]));
  }
  const delegates = p => ({ buildStatus: () => createOAuthLinkStateService({ provider: p }).buildStatus(),
    ...Object.fromEntries(['startAuthorization', 'completeAuthorization', 'clearAuthorization', 'resolveAccessToken'].map(name => [name, (...args) => track(callbacks[p][name](...args))])) });
  const app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createProviderModule: options => createProviderModule({ ...options,
    spotifyOAuthService: delegates('spotify'), youtubeOAuthService: delegates('youtube') }) });
  const record = key => secrets.getSecretRecord({ secretType: 'integration_oauth', name: stateName(key), queryable: observer });
  const snapshot = async () => (await observer.query("SELECT name,encode(encrypted_value,'hex') AS cipher,updated_at::text AS revision FROM encrypted_secrets WHERE name LIKE $1 ORDER BY name,id", ['providers.' + provider + '.oauth.%'])).rows;
  async function flow(service = callbacks[provider]) {
    const dto = await service.startAuthorization({ session, browserBinding: binding, requestMetadata: metadata });
    const url = new URL(dto.authorizationUrl); assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    return url.searchParams.get('state');
  }
  const complete = (key, service = callbacks[provider]) => service.completeAuthorization({ code: 'fixture-code', state: key, browserBinding: binding, requestMetadata: metadata });
  async function rewrite(name, delta) {
    const row = await secrets.getSecretRecord({ secretType: 'integration_oauth', name, queryable: observer });
    await secrets.setSecretValue({ secretType: 'integration_oauth', name, plaintextValue: JSON.stringify({ ...JSON.parse(secrets.decryptSecretRecord(row)), ...delta }), queryable: observer });
  }
  async function trigger(table, event, condition, body, work) {
    await observer.query(`CREATE FUNCTION public.fixture_oauth() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN ${body} END IF;
      RETURN ${event === 'DELETE' ? 'OLD' : 'NEW'}; END $$; CREATE TRIGGER fixture_oauth BEFORE ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION public.fixture_oauth()`);
    return withWorkerTaskCleanup(work, () => observer.query(`DROP TRIGGER fixture_oauth ON ${table}; DROP FUNCTION public.fixture_oauth()`));
  }
  function gate(count = 1, refresh = false) {
    const ready = Promise.withResolvers(), release = Promise.withResolvers(); releases.add(release); let seen = 0;
    const pause = async () => { if (++seen === count) ready.resolve(); await release.promise; };
    return { ready: ready.promise, open: () => { release.resolve(); releases.delete(release); }, service: make(refresh ? { beforeRefresh: pause } : { beforePublish: pause }) };
  }
  async function until(check) {
    const deadline = Date.now() + 5_000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'OAuth observation did not settle'); await observer.query('SELECT pg_stat_clear_snapshot()'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  await withWorkerTaskCleanup(async () => {
    for (const p of providers) callbacks[p] = make({}, p);
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    await observer.connect(); await writer.connect();
    const bootstrap = await fetch(baseUrl + '/api/v1/bootstrap/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'oauth-admin', password: 'OAuthFixturePassword123!' }) });
    assert.equal(bootstrap.status, 201); await bootstrap.json(); cookies = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    session = await getSessionFromRequest({ headers: { cookie: cookies }, socket: { remoteAddress: '127.0.0.1' } }); assert.ok(session); csrf = session.csrfToken;
    await persistSettings([{ namespace: 'system', settingKey: 'baseUrl', value: baseUrl }, ...providers.map(p => ({ namespace: 'providers', settingKey: p + 'ClientId', value: 'fixture-' + p }))]);
    await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.youtube.clientSecret', plaintextValue: 'fixture-client-secret', queryable: observer });
    for (const currentProvider of providers) {
      provider = currentProvider; const caseStart = results.length;
      const start = await fetch(baseUrl + '/api/v1/providers/' + provider + '/oauth/start', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } });
      assert.equal(start.status, 202); assert.equal(start.headers.get('cache-control'), 'no-store'); assert.equal(start.headers.get('referrer-policy'), 'no-referrer');
      const dto = await start.json(), cookie = start.headers.get('set-cookie'), browser = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
      assert.match(cookie, /HttpOnly; SameSite=Lax/u); assert.ok(!JSON.stringify(dto).includes(browser));
      const key = new URL(dto.authorizationUrl).searchParams.get('state');
      const callback = bindingValue => fetch(baseUrl + '/api/v1/providers/' + provider + '/oauth/callback?code=fixture-code&state=' + key,
        { redirect: 'manual', headers: bindingValue ? { cookie: `harmoniarr_${provider}_binding=${bindingValue}` } : {} });
      const before = await snapshot(), calls = networkCalls;
      for (const bindingValue of [null, other]) { const response = await callback(bindingValue); assert.match(response.headers.get('location'), new RegExp(provider + '_oauth_state_invalid', 'u')); assert.equal(networkCalls, calls); assert.deepEqual(await snapshot(), before); }
      const success = await callback(browser); assert.equal(success.headers.get('location'), '/app/settings?' + provider + 'OAuth=linked'); assert.equal(await record(key), null);
      const after = await snapshot(); await callback(browser); assert.deepEqual(await snapshot(), after); results.push('mounted-cookie-dto-cross-browser-refusal-success-without-strict-cookie-and-replay');
      const audits = (await observer.query('SELECT details FROM audit_events WHERE event_type LIKE $1', [provider + '_oauth_%'])).rows;
      for (const secret of [key, browser, 'fixture-code', 'fixture-client-secret', 'fixture-' + provider + '-token']) assert.ok(!JSON.stringify(audits).includes(secret)); results.push('required-audit-details-omit-credential-and-flow-secrets');
      for (const delta of [{ version: 0 }, { provider: 'other' }, { browserBindingHash: undefined }, { expiresAt: '2000-01-01T00:00:00.000Z' }]) {
        const state = await flow(); await rewrite(stateName(state), delta); const stable = await snapshot(), count = networkCalls;
        await assert.rejects(complete(state), { code: provider + '_oauth_state_invalid' }); assert.equal(networkCalls, count); assert.deepEqual(await snapshot(), stable);
      } results.push('legacy-purpose-malformed-and-expired-state-before-provider');
      const poolKey = await flow(), heldClients = [], stablePool = await snapshot(), poolCalls = networkCalls;
      await withWorkerTaskCleanup(async () => { for (let index = 0; index < 4; index++) heldClients.push(await pool.connect()); await assert.rejects(complete(poolKey), { status: 503 }); }, () => { for (const client of heldClients) client.release(); });
      assert.equal(networkCalls, poolCalls); assert.deepEqual(await snapshot(), stablePool); results.push('bounded-state-read-pool-exhaustion');
      const revokedKey = await flow(), stableRevoked = await snapshot(), revokedCalls = networkCalls;
      await observer.query('UPDATE refresh_tokens SET is_revoked=true WHERE id=$1', [session.refreshTokenId]);
      await assert.rejects(complete(revokedKey), { code: provider + '_oauth_authorization_changed' });
      assert.equal(networkCalls, revokedCalls); assert.deepEqual(await snapshot(), stableRevoked);
      await observer.query('UPDATE refresh_tokens SET is_revoked=false WHERE id=$1', [session.refreshTokenId]); results.push('revoked-authority-refused-before-code-exchange');
      for (const [label, sql, reset, identity] of [
        ['demotion', "UPDATE app_users SET role='member' WHERE id=$1", "UPDATE app_users SET role='admin' WHERE id=$1", session.appUserId],
        ['disabled', 'UPDATE app_users SET is_disabled=true WHERE id=$1', 'UPDATE app_users SET is_disabled=false WHERE id=$1', session.appUserId],
        ['password-required', 'UPDATE app_users SET must_change_password=true WHERE id=$1', 'UPDATE app_users SET must_change_password=false WHERE id=$1', session.appUserId],
        ['credential-epoch', 'UPDATE app_users SET password_changed_at=clock_timestamp() WHERE id=$1', 'UPDATE app_users SET password_changed_at=NULL WHERE id=$1', session.appUserId],
        ['session-revoked', 'UPDATE refresh_tokens SET is_revoked=true WHERE id=$1', 'UPDATE refresh_tokens SET is_revoked=false WHERE id=$1', session.refreshTokenId],
        ['session-rotated', 'UPDATE refresh_tokens SET replaced_by_refresh_token_id=id WHERE id=$1', 'UPDATE refresh_tokens SET replaced_by_refresh_token_id=NULL WHERE id=$1', session.refreshTokenId],
        ['session-expired', "UPDATE refresh_tokens SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", "UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 day' WHERE id=$1", session.refreshTokenId],
      ]) {
        const held = gate(), state = await flow(held.service), stable = await snapshot(), refused = assert.rejects(track(complete(state, held.service)), { code: provider + '_oauth_authorization_changed' });
        await held.ready; await observer.query(sql, [identity]); held.open(); await refused; assert.deepEqual(await snapshot(), stable); await observer.query(reset, [identity]); results.push('post-provider-current-' + label);
      }
      const writerKey = await flow(), stableWriter = await snapshot(); await writer.query('BEGIN'); await writer.query("UPDATE app_users SET role='member' WHERE id=$1", [session.appUserId]);
      await withWorkerTaskCleanup(async () => {
        const refused = assert.rejects(track(complete(writerKey)), { code: provider + '_oauth_authorization_changed' });
        await until(async () => (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%FOR NO KEY UPDATE%') AS waiting")).rows[0].waiting);
        await writer.query('COMMIT'); await refused;
      }, () => writer.query('ROLLBACK'));
      assert.deepEqual(await snapshot(), stableWriter); await observer.query("UPDATE app_users SET role='admin' WHERE id=$1", [session.appUserId]); results.push('committed-demotion-observed-after-real-account-lock-wait');
      const competing = gate(2), concurrentKey = await flow(competing.service), consumers = track(Promise.allSettled([complete(concurrentKey, competing.service), complete(concurrentKey, competing.service)]));
      await competing.ready; competing.open(); assert.equal((await consumers).filter(row => row.status === 'fulfilled').length, 1); assert.equal(await record(concurrentKey), null); results.push('concurrent-callbacks-publish-once');
      const older = await flow(), newer = await flow(); await complete(newer); const linked = await snapshot(); await assert.rejects(complete(older), { code: provider + '_oauth_state_invalid' }); assert.deepEqual(await snapshot(), linked); results.push('completed-relink-invalidates-older-flow');
      const stale = await flow(); await callbacks[provider].clearAuthorization({ session }); const cleared = await snapshot(); await assert.rejects(complete(stale), { code: provider + '_oauth_state_invalid' }); assert.deepEqual(await snapshot(), cleared); results.push('clear-invalidates-pending-flow');
      for (const kind of ['revision', 'cipher', 'replacement', 'deletion']) {
        const held = gate(), state = await flow(held.service), refused = assert.rejects(track(complete(state, held.service)), { code: provider + '_oauth_state_invalid' }); await held.ready;
        if (kind === 'revision') await observer.query("UPDATE encrypted_secrets SET updated_at=updated_at+interval '1 microsecond' WHERE name=$1", [stateName(state)]);
        if (kind === 'cipher') await rewrite(stateName(state), { codeVerifier: 'x'.repeat(86) });
        if (kind === 'replacement') await rewrite(stateName(state), {});
        if (kind === 'deletion') await observer.query('DELETE FROM encrypted_secrets WHERE name=$1', [stateName(state)]);
        const stable = await snapshot(); held.open(); await refused; assert.deepEqual(await snapshot(), stable); results.push('exact-state-' + kind);
      }
      const configHeld = gate(), configKey = await flow(configHeld.service), configStable = await snapshot(), configRefused = assert.rejects(track(complete(configKey, configHeld.service)), { code: provider + '_oauth_state_invalid' });
      await configHeld.ready; await persistSettings([{ namespace: 'providers', settingKey: provider + 'ClientId', value: 'replacement' }]); configHeld.open(); await configRefused;
      assert.deepEqual(await snapshot(), configStable); await persistSettings([{ namespace: 'providers', settingKey: provider + 'ClientId', value: 'fixture-' + provider }]); results.push('changed-client-configuration-refuses-publication');
      for (const event of ['started', 'completed', 'cleared']) {
        const state = event === 'completed' ? await flow() : null, stable = await snapshot();
        await trigger('audit_events', 'INSERT', `NEW.event_type='${provider}_oauth_${event}'`, 'RETURN NULL;', async () => {
          if (event === 'started') { const response = await fetch(baseUrl + '/api/v1/providers/' + provider + '/oauth/start', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } }); assert.equal(response.status, 503); assert.equal(response.headers.get('set-cookie'), null); await response.json(); }
          else await assert.rejects(event === 'completed' ? complete(state) : callbacks[provider].clearAuthorization({ session }), { status: 503 });
        }); assert.deepEqual(await snapshot(), stable); results.push('required-' + event + '-audit-rollback');
      }
      await complete(await flow());
      for (const event of ['INSERT', 'DELETE']) {
        const state = await flow(), stable = await snapshot();
        await trigger('encrypted_secrets', event, `${event === 'DELETE' ? 'OLD' : 'NEW'}.name='${names().token}'`, 'RETURN NULL;', () => assert.rejects(complete(state), { status: 503 }));
        assert.deepEqual(await snapshot(), stable); results.push('suppressed-token-' + event.toLowerCase() + '-rollback');
      }
      for (const subject of ['state', 'parent']) {
        const state = await flow(), expiry = new Date(Date.now() + 500).toISOString();
        if (subject === 'state') await rewrite(stateName(state), { expiresAt: expiry }); else await observer.query('UPDATE refresh_tokens SET expires_at=$2 WHERE id=$1', [session.refreshTokenId, expiry]);
        const stable = await snapshot(), expiring = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); await client.query('SELECT pg_sleep(GREATEST(0,EXTRACT(epoch FROM ($1::timestamptz-clock_timestamp())))+0.05)', [expiry]); } } });
        await assert.rejects(complete(state, expiring), { status: 503 }); assert.deepEqual(await snapshot(), stable);
        if (subject === 'parent') await observer.query("UPDATE refresh_tokens SET expires_at=clock_timestamp()+interval '1 day' WHERE id=$1", [session.refreshTokenId]); results.push('final-' + subject + '-expiry-rolls-back');
      }
      const maintenance = createMaintenanceLockService(), maintenanceKey = await flow(), stableMaintenance = await snapshot(), lock = await maintenance.acquireMaintenanceLock({ lockType: 'maintenance' });
      await withWorkerTaskCleanup(() => assert.rejects(complete(maintenanceKey), { status: 503 }), () => maintenance.releaseMaintenanceLock({ lockId: lock.id })); assert.deepEqual(await snapshot(), stableMaintenance); results.push('active-maintenance-refuses-publication');
      const admitted = Promise.withResolvers(), publish = Promise.withResolvers(); releases.add(publish);
      const heldCommit = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); admitted.resolve(); await publish.promise; } } });
      const invisibleKey = await flow(), invisible = await snapshot(), pendingCommit = track(complete(invisibleKey, heldCommit)); await admitted.promise; assert.deepEqual(await snapshot(), invisible);
      const inserting = track(createMaintenanceLockService({ getPoolFn: () => writer }).acquireMaintenanceLock({ lockType: 'restore' }));
      await until(async () => (await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1', [writer.processID])).rows[0]?.wait_event_type === 'Lock');
      publish.resolve(); releases.delete(publish); await pendingCommit; const inserted = await inserting; await maintenance.releaseMaintenanceLock({ lockId: inserted.id }); results.push('precommit-invisibility-and-maintenance-insertion-ownership');
      const lockKey = await flow(), stableLock = await snapshot(); await writer.query('BEGIN'); await writer.query('SELECT pg_advisory_xact_lock($1::bigint)', [names().lockKey]);
      await withWorkerTaskCleanup(() => assert.rejects(complete(lockKey), { status: 503 }), () => writer.query('ROLLBACK')); assert.deepEqual(await snapshot(), stableLock); results.push('bounded-provider-lock-wait');
      for (const winner of ['clear', 'relink']) {
        await complete(await flow()); await rewrite(names().token, { expiresAt: '2020-01-01T00:00:00.000Z' });
        const held = gate(1, true), refused = assert.rejects(track(held.service.resolveAccessToken()), { code: provider + '_oauth_link_changed' }); await held.ready;
        if (winner === 'clear') await callbacks[provider].clearAuthorization({ session }); else await complete(await flow());
        const stable = await snapshot(); held.open(); await refused; assert.deepEqual(await snapshot(), stable); results.push('late-refresh-cannot-overwrite-' + winner);
      }
      await complete(await flow()); await rewrite(names().token, { expiresAt: '2020-01-01T00:00:00.000Z' });
      const stableRefresh = await snapshot(); await trigger('audit_events', 'INSERT', `NEW.event_type='${provider}_oauth_refreshed'`, 'RETURN NULL;', () => assert.rejects(callbacks[provider].resolveAccessToken(), { status: 503 }));
      assert.deepEqual(await snapshot(), stableRefresh); await callbacks[provider].resolveAccessToken(); results.push('refresh-required-audit-rollback-and-explicit-retry');
      await rewrite(names().token, { expiresAt: '2020-01-01T00:00:00.000Z' });
      const refreshRace = gate(2, true), racingRefresh = track(Promise.allSettled([refreshRace.service.resolveAccessToken(), refreshRace.service.resolveAccessToken()]));
      await refreshRace.ready; refreshRace.open(); assert.equal((await racingRefresh).filter(row => row.status === 'fulfilled').length, 1); results.push('competing-refresh-snapshots-publish-once');
      await rewrite(names().token, { expiresAt: '2020-01-01T00:00:00.000Z' });
      const cancellation = new AbortController(), stableCancellation = await snapshot();
      const cancelled = make({ commandOptions: { recordAuditEventFn: async (event, client) => { await recordAuditEvent(event, client); cancellation.abort(); } } });
      await assert.rejects(cancelled.resolveAccessToken(undefined, { requestPolicy: { signal: cancellation.signal } }), { status: 503 });
      assert.deepEqual(await snapshot(), stableCancellation); results.push('refresh-cancellation-after-token-and-audit-writes-rolls-back');
      const expiredKey = await flow(); await rewrite(stateName(expiredKey), { expiresAt: '2000-01-01T00:00:00.000Z' }); const beforePrune = await snapshot();
      const pruner = createPlexCallbackRetentionService(); for (let index = 0; index < 4; index++) await pruner.startPrune().result;
      const afterPrune = await snapshot(); assert.equal(await record(expiredKey), null);
      for (const name of [names().token, names().revision]) assert.deepEqual(afterPrune.filter(row => row.name === name), beforePrune.filter(row => row.name === name)); results.push('automatic-retention-preserves-token-and-revision');
      let commits = 0;
      const uncertain = make({ startTransactionFn: (work, settings) => {
        let publishing = false;
        return startSessionWriteTransaction(async (client, check) => { const result = await work(client, check); publishing = Boolean(result.status); return result; }, { ...settings, getPoolFn: () => ({ async connect() {
          const client = await pool.connect(), query = client.query.bind(client); client.query = async (...args) => { const result = await query(...args); if (args[0] === 'COMMIT' && publishing) { commits++; throw new Error('controlled acknowledgement loss'); } return result; }; return client;
        } }) });
      } });
      const uncertainKey = await flow(); await assert.rejects(complete(uncertainKey, uncertain), { status: 503 }); assert.equal(commits, 1); assert.equal(await record(uncertainKey), null);
      const stableCommit = await snapshot(); await assert.rejects(complete(uncertainKey), { code: provider + '_oauth_state_invalid' }); assert.deepEqual(await snapshot(), stableCommit); results.push('real-commit-ack-loss-no-retry');
      const timedKey = await flow(), stableTimed = await snapshot(); let task, pid;
      await trigger('audit_events', 'INSERT', `NEW.event_type='${provider}_oauth_completed'`, 'PERFORM pg_sleep(30);', async () => {
        const timed = make({ startTransactionFn: (work, settings) => { task = startSessionWriteTransaction(async (client, check) => { pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; return work(client, check); }, { ...settings, timeoutMs: 1_000 }); return task; } });
        const refused = assert.rejects(track(complete(timedKey, timed)), { status: 503 });
        await until(async () => pid && (await observer.query("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1 AND wait_event='PgSleep') AS active", [pid])).rows[0].active);
        await refused; assert.equal(await task.drained, true); await until(async () => !(await observer.query('SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid=$1) AS present', [pid])).rows[0].present); assert.deepEqual(await snapshot(), stableTimed);
      }); results.push('deadline-and-actual-backend-retirement');
      for (let index = caseStart; index < results.length; index++) results[index] = provider + ':' + results[index];
    }
    provider = 'spotify'; const spotifyState = await flow(); provider = 'youtube'; const youtubeState = await flow(), independent = await snapshot(), count = networkCalls;
    await assert.rejects(complete(spotifyState), { code: 'youtube_oauth_state_invalid' }); assert.equal(networkCalls, count); assert.deepEqual(await snapshot(), independent);
    results.push('cross-provider:foreign-state-refused-before-provider-work');
    await complete(spotifyState, callbacks.spotify); assert.deepEqual(await snapshot(), independent); await complete(youtubeState); results.push('cross-provider:independent-link-revisions');
  }, async () => {
    for (const release of releases) release.resolve(); await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => Promise.allSettled([observer.end(), writer.end()]), async () => {
      await withWorkerTaskCleanup(async () => { if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => {
        runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); await drainApplicationWorkerOwners(app);
      } }); }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, browserBound: true, exactCurrentAuthority: true, singleUse: true, atomicPublication: true, exactRecordFence: true,
    revisionFenced: true, refreshFenced: true, controlledProviderTransport: true, commitLossControlled: true, actualBackendRetirement: true }));
});
