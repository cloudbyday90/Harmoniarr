/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createServer, request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { persistSettings } from '/app/server-dist/settings.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createProviderHttpService } from '/app/server-dist/integrations/providers/provider-http-service.js';
import { createProviderHttpsTransport } from '/app/server-dist/integrations/providers/provider-https-transport.js';
import { createSpotifyClient } from '/app/server-dist/integrations/spotify/spotify-client.js';
import { createYouTubeClient } from '/app/server-dist/integrations/youtube/youtube-client.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
const certificate = JSON.parse(await readFile('testing/fixtures/provider-https/public-test-certificates.json'));
const wrongCertificate = JSON.parse(await readFile('testing/fixtures/provider-https/plex-public-test-certificate.json'));
test('Spotify and YouTube own native TLS, bounded codecs, cancellation and OAuth publication', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.HARMONIARR_SECURE_COOKIES = 'false';
  const secret = 'PUBLIC-TEST-ONLY-private-sentinel', owners = new Set(), sockets = new Set(), dnsReleases = new Set(), timers = new Set(), results = [];
  const stats = { requests: 0, requestCloses: 0, socketCloses: 0, responseCloses: 0, bodyStarts: 0, secure: 0 };
  const secrets = createEncryptedSecretService(); let mode = 'normal', received = 0, trapCalls = 0, tokenCalls = 0, app, runtime, fixtureFailure;
  const tokenName = provider => `providers.${provider}.oauth.token`;
  const readToken = provider => secrets.getSecretRecord({ secretType: 'integration_oauth', name: tokenName(provider), queryable: getPool() });
  async function serve(incoming, response) {
    received++; const host = incoming.headers.host, path = incoming.url.split('?')[0];
    assert.equal(incoming.headers['accept-encoding'], 'gzip, deflate, br');
    const chunks = []; let bytes = 0;
    for await (const chunk of incoming) { bytes += chunk.length; assert.ok(bytes <= 65_536); chunks.push(chunk); }
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    if (path === '/revoke') { assert.equal(host, 'oauth2.googleapis.com'); assert.equal(form.get('token'), secret); assert.equal(await readToken('youtube'), null); }
    if (mode === 'headers-stall' || (mode === 'revoke-stall' && path === '/revoke')) return;
    if (mode === 'body-stall' || mode === 'trickle') {
      response.writeHead(200, { 'content-type': 'application/json' }); response.write('{');
      if (mode === 'trickle') { const timer = setInterval(() => response.write(' '), 15); timers.add(timer); incoming.socket.once('close', () => { clearInterval(timer); timers.delete(timer); }); }
      return;
    }
    if (mode === 'declared-large') { response.writeHead(200, { 'content-length': '129' }); response.flushHeaders(); return; }
    if (mode === 'chunked-large') { response.writeHead(200); response.write(' '.repeat(100)); response.end(' '.repeat(100)); return; }
    if (mode === 'header-large') { response.setHeader('X-Fixture', 'x'.repeat(20_000)); response.end('{}'); return; }
    if (mode === 'redirect') { response.writeHead(307, { location: 'https://127.0.0.1:' + trap.address().port + '/capture' }); response.end(); return; }
    if (mode === 'bad-utf8') { response.end(Buffer.from([255])); return; }
    if (mode === 'bad-json') { response.end('{'); return; }
    if (mode === 'truncated') { response.writeHead(200, { 'content-length': '100' }); response.end('{}'); return; }
    if (mode === 'bad-gzip') { response.writeHead(200, { 'content-encoding': 'gzip' }); response.end('not-gzip'); return; }
    if (mode === 'layers') { response.writeHead(200, { 'content-encoding': 'gzip, br' }); response.end('{}'); return; }
    if (mode === 'quota') { response.writeHead(429, { 'content-encoding': 'br', 'retry-after': '9999999', 'x-private': secret }); response.end(brotliCompressSync(Buffer.from(JSON.stringify({ error: { reason: 'QUOTA_EXCEEDED', message: secret } })))); return; }
    if (mode === 'large-error') { response.writeHead(401, { 'content-length': '999999' }); response.flushHeaders(); return; }
    let value = { id: 'fixture', items: [{ id: 'fixture-video' }] };
    if (path === '/api/token' || path === '/token') {
      tokenCalls++; assert.equal(incoming.method, 'POST');
      assert.ok(['client_credentials', 'authorization_code', 'refresh_token'].includes(form.get('grant_type')));
      if (form.get('grant_type') === 'authorization_code') { assert.ok(form.get('code_verifier')); assert.ok(form.get('redirect_uri')); }
      if (host === 'oauth2.googleapis.com') assert.equal(form.get('client_secret'), 'fixture-client-secret');
      value = { access_token: secret, refresh_token: 'fixture-refresh', expires_in: 3600, scope: 'read', token_type: 'Bearer' };
    }
    if (path === '/revoke') { response.writeHead(200); response.end(); return; }
    if (host === 'www.googleapis.com' && incoming.url.includes('key=')) assert.equal(incoming.headers.authorization, undefined);
    let body = Buffer.from(JSON.stringify(value));
    if (mode === 'exact') { const prefix = '{"value":"', suffix = '"}'; body = Buffer.from(prefix + 'x'.repeat(128 - prefix.length - suffix.length) + suffix); }
    if (mode.endsWith('-large')) body = Buffer.from(JSON.stringify({ value: 'x'.repeat(4096) }));
    const codec = mode.startsWith('gzip') ? 'gzip' : mode.startsWith('br') ? 'br' : mode === 'deflate' ? 'deflate' : null;
    if (codec) { body = codec === 'gzip' ? gzipSync(body) : codec === 'br' ? brotliCompressSync(body) : deflateSync(body); response.setHeader('Content-Encoding', codec); }
    if (mode === 'gzip-garbage') body = Buffer.concat([body, Buffer.from('garbage')]);
    response.setHeader('Content-Type', 'application/json'); response.end(body);
  }
  const server = createServer(certificate.matched, (incoming, response) => { void serve(incoming, response).catch(error => { fixtureFailure ??= error; response.destroy(); }); });
  const wrongServer = createServer(wrongCertificate, (incoming, response) => { void serve(incoming, response).catch(error => { fixtureFailure ??= error; response.destroy(); }); });
  const trap = createServer(certificate.matched, (_incoming, response) => { trapCalls++; response.end(); });
  for (const instance of [server, wrongServer, trap]) { instance.on('tlsClientError', () => {}); instance.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); }); }
  const listen = instance => new Promise(resolve => { instance.listen(0, '127.0.0.1', resolve); });
  const close = instance => new Promise((resolve, reject) => { instance.close(error => error ? reject(error) : resolve()); });
  async function until(check) {
    const deadline = Date.now() + 5000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'Native provider observation did not settle'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  function owner({ maxTimeoutMs = 2000, maxActive = 4, trust = 'matched', lookupFn = (_hostname, _options, callback) => callback(null, [{ address: '93.184.216.34', family: 4 }]), env = {} } = {}) {
    const transport = createProviderHttpsTransport({ lookupFn, requestFn: (url, options, callback) => {
      stats.requests++; assert.equal(options.rejectUnauthorized, true); assert.equal(options.servername, url.hostname); assert.equal(options.maxHeaderSize, 16384);
      assert.equal(options.agent.options.keepAlive, false); assert.deepEqual(options.agent.options.proxyEnv, {});
      const target = trust === 'wrong-name' ? wrongServer : server;
      const outgoing = request(url, { ...options, port: target.address().port, headers: { ...options.headers, Host: url.host },
        ca: trust === 'untrusted' ? undefined : trust === 'wrong-name' ? wrongCertificate.cert : certificate.ca,
        lookup: (hostname, settings, done) => options.lookup(hostname, settings, (error, answers, family) => {
          if (error) done(error); else if (Array.isArray(answers)) done(null, answers.map(() => ({ address: '127.0.0.1', family: 4 }))); else done(null, '127.0.0.1', family);
        }) }, response => { response.once('data', () => { stats.bodyStarts++; }); response.once('close', () => { stats.responseCloses++; }); callback(response); });
      outgoing.once('close', () => { stats.requestCloses++; }); outgoing.once('socket', socket => { socket.once('secureConnect', () => { stats.secure++; }); socket.once('close', () => { stats.socketCloses++; }); }); return outgoing;
    } });
    const service = createProviderHttpService({ transport, maxTimeoutMs, maxActive, env }); owners.add(service); return service;
  }
  const send = (service, options = {}) => service.request({ provider: 'spotify', url: 'https://api.spotify.com/v1/tracks/fixture?private=' + secret, headers: { Authorization: 'Bearer ' + secret }, ...options });
  async function retired(service) {
    assert.equal(await service.waitForDrain(), true); assert.equal(service.getState().active, 0);
    await until(() => stats.requests === stats.requestCloses && stats.requests === stats.socketCloses);
    if (fixtureFailure) throw fixtureFailure;
  }
  async function refusal(service, options, diagnosticCode) {
    await assert.rejects(send(service, options), error => error.diagnosticCode === diagnosticCode && !JSON.stringify({ ...error, message: error.message, stack: error.stack }).includes(secret)); await retired(service);
  }
  await withWorkerTaskCleanup(async () => {
    await Promise.all([listen(server), listen(wrongServer), listen(trap)]);
    const normal = owner();
    for (const encoding of ['normal', 'gzip', 'deflate', 'br']) { mode = encoding; assert.equal((await send(normal)).id, 'fixture'); await retired(normal); results.push(encoding + '-verified-native-tls-and-complete-retirement'); }
    mode = 'exact'; assert.equal((await send(normal, { maxBytes: 128 })).value.length, 116); await retired(normal); results.push('exact-decoded-boundary');
    for (const selected of ['declared-large', 'chunked-large', 'gzip-large', 'br-large', 'bad-gzip', 'gzip-garbage', 'layers', 'bad-utf8', 'bad-json', 'truncated']) {
      mode = selected; await refusal(normal, { maxBytes: 128 }, 'response_invalid'); results.push(selected + '-refused-and-retired');
    }
    mode = 'header-large'; await refusal(normal, {}, 'unavailable'); results.push('native-header-bound');
    mode = 'redirect'; await refusal(normal, {}, 'unavailable'); assert.equal(trapCalls, 0); results.push('redirect-target-never-contacted');
    mode = 'quota'; await assert.rejects(send(normal), error => error.diagnosticCode === 'quota_exceeded' && error.details.reasonCode === 'QUOTA_EXCEEDED' && error.details.retryAfterSeconds === 86400 && !JSON.stringify({ ...error, message: error.message }).includes(secret)); await retired(normal); results.push('compressed-http-error-whitelist-and-bounded-retry-after');
    mode = 'large-error'; await refusal(normal, {}, 'credentials_rejected'); results.push('known-http-status-survives-body-refusal');
    for (const selected of ['headers-stall', 'body-stall', 'trickle']) { mode = selected; const timed = owner({ maxTimeoutMs: 100 }); await refusal(timed, {}, 'timeout'); results.push(selected + '-deadline-and-actual-native-close'); }
    mode = 'body-stall'; const controller = new AbortController(), beforeBody = stats.bodyStarts;
    const cancelled = assert.rejects(send(normal, { signal: controller.signal }), error => error.diagnosticCode === 'timeout' && !JSON.stringify({ ...error, message: error.message }).includes(secret));
    await until(() => stats.bodyStarts > beforeBody); controller.abort(new Error(secret)); await cancelled; await retired(normal); results.push('caller-cancels-active-native-body-with-private-reason-and-actual-close');
    mode = 'normal';
    for (const trust of ['untrusted', 'wrong-name']) { const service = owner({ trust }), before = received; await refusal(service, {}, 'unavailable'); assert.equal(received, before); results.push(trust + '-tls-refused-before-http'); }
    const privateDns = owner({ lookupFn: (_host, _options, callback) => callback(null, [{ address: '127.0.0.1', family: 4 }]) }), beforePrivate = received;
    await refusal(privateDns, {}, 'unavailable'); assert.equal(received, beforePrivate); results.push('private-dns-refused-before-http');
    const proxy = owner({ env: { HTTPS_PROXY: 'http://uncontacted.invalid', NO_PROXY: '*' } }), beforeProxy = stats.requests;
    await refusal(proxy, {}, 'request_rejected'); assert.equal(stats.requests, beforeProxy); results.push('proxy-refused-before-native-dispatch');
    const entered = Promise.withResolvers(); let dnsCallback;
    const heldDns = owner({ maxTimeoutMs: 100, maxActive: 1, lookupFn: (_hostname, _options, callback) => { dnsCallback = callback; dnsReleases.add(callback); entered.resolve(); } });
    const pending = assert.rejects(send(heldDns), { diagnosticCode: 'timeout' }); await entered.promise; await pending; assert.equal(heldDns.getState().active, 1);
    await assert.rejects(heldDns.request({ provider: 'youtube', url: 'https://www.googleapis.com/youtube/v3/videos' }), { diagnosticCode: 'unavailable' });
    let closed = false; const closing = heldDns.close(); closing.then(() => { closed = true; }); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(closed, false);
    dnsCallback(null, [{ address: '93.184.216.34', family: 4 }]); dnsReleases.delete(dnsCallback); await closing; await retired(heldDns); results.push('shared-admission-and-shutdown-retain-late-dns-ownership');
    mode = 'normal'; const beforeClientTokens = tokenCalls;
    const spotify = createSpotifyClient({ clientId: 'fixture-client', clientSecret: 'fixture-secret', providerHttpService: normal });
    assert.equal((await spotify.getTrack('first')).id, 'fixture'); assert.equal((await spotify.getTrack('second')).id, 'fixture'); assert.equal(tokenCalls, beforeClientTokens + 1); await retired(normal); results.push('spotify-client-credentials-and-api-share-owner-and-cache');
    const youtube = createYouTubeClient({ apiKey: secret, providerHttpService: normal }); assert.deepEqual((await youtube.getVideos('fixture')).items, [{ id: 'fixture-video' }]); await retired(normal); results.push('youtube-api-key-default-client-uses-owner');

    const shared = owner({ maxTimeoutMs: 250 });
    await persistSettings([{ namespace: 'system', settingKey: 'baseUrl', value: 'http://127.0.0.1:3000' },
      { namespace: 'providers', settingKey: 'spotifyClientId', value: 'fixture-spotify' }, { namespace: 'providers', settingKey: 'youtubeClientId', value: 'fixture-youtube' }]);
    await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.youtube.clientSecret', plaintextValue: 'fixture-client-secret' });
    app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createProviderHttpService: () => shared });
    assert.equal(app.providerHttpService, shared); assert.equal(app.providerModule.providerHttpService, shared);
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    const bootstrap = await fetch('http://127.0.0.1:3000/api/v1/bootstrap/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'native-provider-admin', password: 'PublicProviderFixture123!' }) });
    assert.equal(bootstrap.status, 201); await bootstrap.json(); const cookies = bootstrap.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const csrf = decodeURIComponent(cookies.split('; ').find(value => value.startsWith('harmoniarr_csrf=')).slice('harmoniarr_csrf='.length));
    for (const provider of ['spotify', 'youtube']) {
      const base = 'http://127.0.0.1:3000/api/v1/providers/' + provider + '/oauth';
      const start = await fetch(base + '/start', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } }); assert.equal(start.status, 202);
      const binding = start.headers.getSetCookie()[0].split(';')[0], dto = await start.json(), state = new URL(dto.authorizationUrl).searchParams.get('state');
      const callback = () => fetch(base + '/callback?code=fixture-code&state=' + state, { redirect: 'manual', headers: { cookie: binding } });
      mode = 'headers-stall'; const failed = await callback(); assert.match(failed.headers.get('location'), new RegExp(provider + '_oauth_token_exchange_failed', 'u')); assert.equal(await readToken(provider), null);
      assert.equal(Number((await getPool().query('SELECT count(*) FROM audit_events WHERE event_type=$1', [provider + '_oauth_completed'])).rows[0].count), 0); await retired(shared);
      mode = 'normal'; assert.equal((await callback()).headers.get('location'), '/app/settings?' + provider + 'OAuth=linked'); await retired(shared); results.push(provider + '-mounted-callback-native-timeout-no-publication-and-controlled-retry');
      const saved = await readToken(provider), value = JSON.parse(secrets.decryptSecretRecord(saved));
      await secrets.setSecretValue({ secretType: 'integration_oauth', name: tokenName(provider), plaintextValue: JSON.stringify({ ...value, expiresAt: '2000-01-01T00:00:00.000Z' }) });
      const before = await readToken(provider), service = provider === 'spotify' ? app.providerModule.spotifyOAuthService : app.providerModule.youtubeOAuthService;
      mode = 'headers-stall'; await assert.rejects(service.resolveAccessToken(), { diagnosticCode: 'timeout' }); await retired(shared); assert.deepEqual(await readToken(provider), before);
      mode = 'normal'; assert.equal(await service.resolveAccessToken(), secret); await retired(shared); results.push(provider + '-native-refresh-timeout-preserves-old-token-and-controlled-retry');
      if (provider === 'youtube') {
        mode = 'revoke-stall'; const clear = await fetch(base + '/clear', { method: 'POST', headers: { cookie: cookies, 'x-csrf-token': csrf } });
        assert.equal(clear.status, 200); assert.equal((await clear.json()).status.linked, false); assert.equal(await readToken(provider), null); await retired(shared); results.push('google-revocation-timeout-retired-after-committed-local-clear');
      }
    }
  }, async () => {
    for (const callback of dnsReleases) callback(new Error('fixture closing'));
    if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => { runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); } });
    if (app) await drainApplicationWorkerOwners(app);
    await Promise.all([...owners].map(value => value.close()));
    for (const timer of timers) clearInterval(timer);
    for (const socket of sockets) socket.destroy();
    await Promise.all([close(server), close(wrongServer), close(trap)]); await closePool();
  });
  t.diagnostic(JSON.stringify({ results, stats, actualNativeClose: true, verifiedFixtureTls: true, boundedCodecs: true, actualDnsDrain: true,
    sharedAdmissionHeld: true, redirectTrapCalls: trapCalls, callbackPublicationFenced: true, refreshPublicationFenced: true, revocationAfterLocalClear: true }));
});
