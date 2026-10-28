/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync, verify } from 'node:crypto';
import { createServer, request } from 'node:https';
import { readFile } from 'node:fs/promises';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { createApp } from '/app/server-dist/app.js';
import { closePool } from '/app/server-dist/database.js';
import { persistSettings } from '/app/server-dist/settings.js';
import { createEncryptedSecretService } from '/app/server-dist/encrypted-secret-service.js';
import { createProviderHttpService } from '/app/server-dist/integrations/providers/provider-http-service.js';
import { createProviderHttpsTransport } from '/app/server-dist/integrations/providers/provider-https-transport.js';
import { createAppleMusicClient } from '/app/server-dist/integrations/apple-music/apple-music-client.js';
import { createProviderClientResolverService } from '/app/server-dist/integrations/providers/provider-client-resolver-service.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';

await requireDeploymentMemoryProfile();
test('Apple Music owns native HTTPS, developer authentication and shared retirement through application wiring', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64);
  const cert = JSON.parse(await readFile('testing/fixtures/provider-https/public-test-certificates.json'));
  const wrong = JSON.parse(await readFile('testing/fixtures/provider-https/plex-public-test-certificate.json'));
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const credentials = { teamId: 'TESTTEAM01', keyId: 'TESTKEY001', privateKey }, results = [], owners = new Set(), sockets = new Set(), dnsReleases = new Set(), tokens = new Set(), paths = [];
  let mode = 'identity', received = 0, closed = 0, issued = 0, requestCloses = 0, bodyStarts = 0, trapCalls = 0, fixtureFailure, app;
  const serve = (_incoming, response) => {
    try {
      received++; assert.equal(_incoming.headers.host, 'api.music.apple.com'); assert.equal(_incoming.headers['accept-encoding'], 'gzip, deflate, br');
      const token = _incoming.headers.authorization?.slice(7), [header, payload, signature] = token.split('.');
      assert.deepEqual(JSON.parse(Buffer.from(header, 'base64url')), { alg: 'ES256', kid: credentials.keyId });
      const claims = JSON.parse(Buffer.from(payload, 'base64url')); assert.equal(claims.iss, credentials.teamId); assert.equal(claims.exp - claims.iat, 3600);
      assert.equal(verify('SHA256', Buffer.from(header + '.' + payload), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
      tokens.add(token); paths.push(_incoming.url);
      if (mode === 'headers-stall') return;
      if (mode === 'body-stall') { response.writeHead(200); response.write('{'); return; }
      if (mode === 'redirect') { response.writeHead(307, { location: 'https://127.0.0.1:' + trap.address().port + '/capture' }); response.end(); return; }
      if (mode === 'bad-json') { response.end('{PRIVATE-response-sentinel'); return; }
      if (mode === 'large-error') { response.writeHead(401, { 'content-length': '999999' }); response.flushHeaders(); return; }
      if (mode === 'quota') { response.writeHead(429, { 'retry-after': '120' }); response.end('{"error":{"message":"PRIVATE-response-sentinel"}}'); return; }
      let body = Buffer.from(JSON.stringify({ data: [{ id: 'fixture', type: 'songs' }] }));
      if (mode === 'exact') body = Buffer.from('{"value":"' + 'x'.repeat(116) + '"}');
      if (mode === 'oversized') body = Buffer.from(JSON.stringify({ value: 'x'.repeat(4096) }));
      if (['gzip', 'deflate', 'br', 'oversized'].includes(mode)) {
        const encoding = mode === 'oversized' ? 'br' : mode; response.setHeader('Content-Encoding', encoding);
        body = encoding === 'gzip' ? gzipSync(body) : encoding === 'br' ? brotliCompressSync(body) : deflateSync(body);
      }
      response.end(body);
    } catch (error) { fixtureFailure ??= error; response.destroy(); }
  };
  const server = createServer(cert.matched, serve), wrongServer = createServer(wrong, serve), trap = createServer(cert.matched, (_request, response) => { trapCalls++; response.end(); });
  for (const value of [server, wrongServer, trap]) { value.on('tlsClientError', () => {}); value.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); }); }
  const until = async check => { const expires = Date.now() + 5000; while (!check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < expires, 'Native Apple observation did not settle'); await new Promise(resolve => { setTimeout(resolve, 10); }); } };
  function owner({ maxActive = 4, maxTimeoutMs = 2000, trust = 'matched', env = {}, lookupFn = (_host, _options, callback) => callback(null, [{ address: '93.184.216.34', family: 4 }]) } = {}) {
    const transport = createProviderHttpsTransport({ lookupFn, requestFn: (url, options, callback) => {
      issued++; assert.equal(options.servername, 'api.music.apple.com'); assert.equal(options.rejectUnauthorized, true); assert.equal(options.agent.options.keepAlive, false);
      const outgoing = request(url, { ...options, port: (trust === 'wrong-name' ? wrongServer : server).address().port, headers: { ...options.headers, Host: url.host },
        ca: trust === 'untrusted' ? undefined : trust === 'wrong-name' ? wrong.cert : cert.ca,
        lookup: (host, input, done) => options.lookup(host, input, (error, addresses, family) => error ? done(error) : Array.isArray(addresses) ? done(null, addresses.map(() => ({ address: '127.0.0.1', family: 4 }))) : done(null, '127.0.0.1', family)) }, response => { response.once('data', () => { bodyStarts++; }); callback(response); });
      outgoing.once('close', () => { requestCloses++; }); outgoing.once('socket', socket => socket.once('close', () => { closed++; })); return outgoing;
    } });
    const service = createProviderHttpService({ transport, maxActive, maxTimeoutMs, env }); owners.add(service); return service;
  }
  const client = (service, requestPolicy = {}) => createAppleMusicClient({ ...credentials, providerHttpService: service, requestPolicy });
  const retired = async service => { assert.equal(await service.waitForDrain(), true); assert.equal(service.getState().active, 0); await until(() => issued === closed && issued === requestCloses); if (fixtureFailure) throw fixtureFailure; };
  const refusal = async (service, kind, requestPolicy = {}) => { await assert.rejects(client(service, requestPolicy).getCatalogSong('us', 'fixture'), error => error.diagnosticCode === kind && !JSON.stringify({ ...error, message: error.message }).includes('PRIVATE-response-sentinel')); await retired(service); };
  await withWorkerTaskCleanup(async () => {
    await Promise.all([server, wrongServer, trap].map(value => new Promise(resolve => { value.listen(0, '127.0.0.1', resolve); })));
    const shared = owner();
    for (const encoding of ['identity', 'gzip', 'deflate', 'br']) { mode = encoding; assert.equal((await client(shared).getCatalogSong('us', 'fixture')).data[0].id, 'fixture'); await retired(shared); results.push(encoding + '-native-tls-and-jwt'); }
    mode = 'exact'; assert.equal((await client(shared, { maxResponseBytes: 128 }).getCatalogSong('us', 'fixture')).value.length, 116); await retired(shared); results.push('exact-decoded-boundary');
    for (const [selected, kind] of [['oversized', 'response_invalid'], ['bad-json', 'response_invalid'], ['redirect', 'unavailable'], ['large-error', 'credentials_rejected']]) { mode = selected; await refusal(shared, kind, { maxResponseBytes: 128 }); results.push(selected + '-refused-and-retired'); }
    assert.equal(trapCalls, 0); mode = 'quota'; await assert.rejects(client(shared).getCatalogSong('us', 'fixture'), error => error.diagnosticCode === 'rate_limited' && error.details.retryAfterSeconds === 120); await retired(shared); results.push('sanitized-rate-limit-and-retry-after');
    for (const selected of ['headers-stall', 'body-stall']) { mode = selected; const timed = owner({ maxTimeoutMs: 100 }); await refusal(timed, 'timeout'); results.push(selected + '-native-retirement'); }
    mode = 'body-stall'; const cancel = new AbortController(), beforeBody = bodyStarts;
    const pending = assert.rejects(client(shared, { signal: cancel.signal }).getCatalogSong('us', 'fixture'), { diagnosticCode: 'timeout' }); await until(() => bodyStarts > beforeBody); cancel.abort(new Error('PRIVATE-response-sentinel')); await pending; await retired(shared); results.push('active-body-caller-cancellation');
    mode = 'identity'; for (const trust of ['untrusted', 'wrong-name']) { const before = received, service = owner({ trust }); await refusal(service, 'unavailable'); assert.equal(received, before); results.push(trust + '-tls-before-http'); }
    const beforePrivate = received, privateDns = owner({ lookupFn: (_host, _options, callback) => callback(null, [{ address: '127.0.0.1', family: 4 }]) }); await refusal(privateDns, 'unavailable'); assert.equal(received, beforePrivate); results.push('private-dns-before-http');
    const beforeProxy = issued, proxy = owner({ env: { HTTPS_PROXY: 'http://uncontacted.invalid', NO_PROXY: '*' } }); await refusal(proxy, 'request_rejected'); assert.equal(issued, beforeProxy); results.push('proxy-before-dispatch');
    const entered = Promise.withResolvers(); let finishDns;
    const held = owner({ maxActive: 1, maxTimeoutMs: 100, lookupFn: (_host, _options, callback) => { finishDns = callback; dnsReleases.add(callback); entered.resolve(); } });
    const timed = assert.rejects(client(held).getCatalogSong('us', 'fixture'), { diagnosticCode: 'timeout' }); await entered.promise; await timed; assert.equal(held.getState().active, 1);
    for (const [provider, url] of [['spotify', 'https://api.spotify.com/v1/tracks/fixture'], ['youtube', 'https://www.googleapis.com/youtube/v3/videos']]) await assert.rejects(held.request({ provider, url }), { diagnosticCode: 'unavailable' });
    let done = false; const closing = held.close(); closing.then(() => { done = true; }); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(done, false); finishDns(null, [{ address: '93.184.216.34', family: 4 }]); dnsReleases.delete(finishDns); await closing; await retired(held); results.push('cross-provider-admission-and-shutdown-own-issued-dns');
    const secrets = createEncryptedSecretService();
    await persistSettings([{ namespace: 'providers', settingKey: 'appleMusicEnabled', value: true }, { namespace: 'providers', settingKey: 'appleMusicTeamId', value: credentials.teamId }, { namespace: 'providers', settingKey: 'appleMusicKeyId', value: credentials.keyId }]);
    await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey', plaintextValue: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    app = createApp({ clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createProviderHttpService: () => shared });
    mode = 'identity'; const access = await app.providerModule.providerCollectionAccessCheckService.checkCollectionAccess({ sourceUrl: 'https://music.apple.com/gb/playlist/example/pl.test' });
    assert.equal(access.outcome, 'verified'); assert.equal(access.authMode, 'developer_token'); await retired(shared); results.push('default-application-collection-probe-uses-shared-native-owner');
    const resolver = createProviderClientResolverService({ providerHttpService: app.providerHttpService });
    const resolved = await resolver.resolveProviderClient({ provider: 'apple_music' }); assert.equal(resolved.authMode, 'developer_token'); assert.equal(resolved.configured, true);
    tokens.clear(); paths.length = 0; mode = 'identity';
    await resolved.client.getCatalogSong('us', 'song'); await resolved.client.getCatalogAlbum('de', 'album'); await resolved.client.getCatalogPlaylist('gb', 'playlist');
    await resolved.client.getCatalogPlaylistTracks('fr', 'playlist', { offset: 100 }); await resolved.client.getCatalogArtistAlbums('jp', 'artist', { offset: 25 }); await resolved.client.getCatalogArtist('ca', 'artist', { offset: 50 });
    assert.equal(tokens.size, 1); assert.equal(paths.length, 6); assert.ok(paths.some(path => path.includes('offset=100'))); await retired(shared); results.push('application-resolver-stored-key-six-methods-one-cached-jwt');
    const invalidKeys = [['malformed', 'PRIVATE-response-sentinel'], ['rsa', generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' })],
      ['p384', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey.export({ type: 'pkcs8', format: 'pem' })],
      ['secp256k1', generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey.export({ type: 'pkcs8', format: 'pem' })], ['public', publicKey.export({ type: 'spki', format: 'pem' })]];
    for (const [kind, material] of invalidKeys) {
      const beforeBadKey = issued; await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey', plaintextValue: material });
      const changed = await resolver.resolveProviderClient({ provider: 'apple_music' }); await assert.rejects(changed.client.getCatalogSong('us', 'song'), error => error.code === 'apple_music_misconfigured' && error.cause === undefined && !JSON.stringify({ ...error, message: error.message }).includes('PRIVATE-response-sentinel'));
      assert.equal(issued, beforeBadKey); results.push('stored-' + kind + '-key-refuses-before-network');
    }
    await secrets.setSecretValue({ secretType: 'integration_credential', name: 'providers.appleMusic.privateKey', plaintextValue: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
    const recovered = await resolver.resolveProviderClient({ provider: 'apple_music' }); assert.equal((await recovered.client.getCatalogSong('us', 'song')).data[0].id, 'fixture'); await retired(shared); results.push('valid-saved-key-recovers-after-refusal');
    const active = owner(); mode = 'body-stall'; const bodyBeforeClose = bodyStarts, activeRequest = assert.rejects(client(active).getCatalogSong('us', 'fixture'), { diagnosticCode: 'timeout' }); await until(() => bodyStarts > bodyBeforeClose); await active.close(); await activeRequest; await retired(active); results.push('shutdown-cancels-active-native-body');
  }, async () => {
    for (const release of dnsReleases) release(new Error('fixture closing'));
    if (app) await drainApplicationWorkerOwners(app);
    await Promise.all([...owners].map(value => value.close())); await closePool();
    for (const socket of sockets) socket.destroy(); await Promise.all([server, wrongServer, trap].map(value => new Promise((resolve, reject) => { value.close(error => error ? reject(error) : resolve()); })));
  });
  t.diagnostic(JSON.stringify({ results, issued, requestCloses, socketCloses: closed, trapCalls, verifiedTls: true, verifiedDeveloperJwt: true, boundedCodecs: true, sharedAdmissionHeld: true, actualDnsDrain: true, applicationResolver: true, actualNativeClose: true }));
});
