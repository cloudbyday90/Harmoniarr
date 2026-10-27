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
import { gzipSync } from 'node:zlib';
import { createApp } from '/app/server-dist/app.js';
import { getPool, closePool } from '/app/server-dist/database.js';
import { persistSettings } from '/app/server-dist/settings.js';
import { createPlexHttpsTransport } from '/app/server-dist/integrations/plex/plex-https-transport.js';
import { createPlexHttpClient } from '/app/server-dist/integrations/plex/plex-http-client.js';
import { startServerRuntime } from '/app/server-dist/startup-runtime.js';
import { drainApplicationWorkerOwners } from '/app/server-dist/application-worker-drain.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
const certificate = JSON.parse(await readFile('testing/fixtures/provider-https/plex-public-test-certificate.json'));
const otherCertificate = JSON.parse(await readFile('testing/fixtures/provider-https/public-test-certificates.json'));
test('owned Plex HTTPS bounds actual headers, body, TLS, DNS, cancellation and callback publication', { timeout: 120_000 }, async t => {
  process.env.HARMONIARR_SECRET_ENCRYPTION_KEY = '0'.repeat(64); process.env.HARMONIARR_SECURE_COOKIES = 'false';
  const clients = new Set(), sockets = new Set(), results = [], timers = new Set(), dnsReleases = new Set();
  let mode = 'normal', received = 0, trapCalls = 0, runtime, app;
  const stats = { requests: 0, requestCloses: 0, socketCloses: 0, responseCloses: 0, secure: 0 };
  const json = (response, body) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(body)); };
  const serve = (incoming, response) => {
    received++; assert.equal(incoming.headers['accept-encoding'], 'identity'); assert.equal(incoming.headers['x-plex-product'], 'Harmoniarr');
    const path = incoming.url.split('?')[0];
    const stall = mode === 'headers-stall' || (mode === 'user-stall' && path === '/api/v2/user');
    if (stall) return;
    if (mode === 'slow-body') { response.writeHead(200, { 'content-type': 'application/json' }); response.write('{'); return; }
    if (mode === 'oversized-header') { response.setHeader('X-Public-Fixture', 'a'.repeat(20_000)); json(response, {}); return; }
    if (mode === 'declared-large') { response.writeHead(200, { 'content-type': 'application/json', 'content-length': '65537' }); response.flushHeaders(); return; }
    if (mode === 'chunked-large') { response.writeHead(200, { 'content-type': 'application/json' }); response.write(' '.repeat(60_000)); response.end(' '.repeat(6000)); return; }
    if (mode === 'exact-limit') { const prefix = '{"id":123,"padding":"', suffix = '"}'; response.setHeader('Content-Type', 'application/json'); response.end(prefix + 'x'.repeat(65536 - prefix.length - suffix.length) + suffix); return; }
    if (mode === 'compressed') { response.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' }); response.end(gzipSync(Buffer.from('{"id":123}'))); return; }
    if (mode === 'invalid-utf8') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(Buffer.from([255])); return; }
    if (mode === 'invalid-json') { response.writeHead(200, { 'content-type': 'application/json' }); response.end('{'); return; }
    if (mode === 'truncated') { response.writeHead(200, { 'content-type': 'application/json', 'content-length': '100' }); response.end('{}'); return; }
    if (mode === 'redirect') { response.writeHead(307, { location: 'https://127.0.0.1:' + trap.address().port + '/capture' }); response.end(); return; }
    if (mode === 'unauthorized') { response.writeHead(401, { 'content-type': 'text/plain' }); response.end('PUBLIC-FIXTURE-SECRET'); return; }
    if (mode === 'server-error') { response.writeHead(503, { 'content-type': 'application/json' }); response.end('{"message":"PUBLIC-FIXTURE-SECRET"}'); return; }
    if (path === '/api/v2/pins') json(response, { id: 123, code: 'public-fixture-pin' });
    else if (path === '/api/v2/pins/123') json(response, { authToken: 'public-fixture-token' });
    else if (path === '/api/v2/user') { assert.equal(incoming.headers['x-plex-token'], 'public-fixture-token'); json(response, { id: 123, uuid: 'http-fixture-subject', restricted: false }); }
    else if (path === '/api/v2/home/users') json(response, { MediaContainer: { User: [{ id: 123 }] } });
    else if (path === '/api/v2/resources') json(response, [{ name: 'fixture-server' }]);
    else { response.writeHead(404); response.end(); }
  };
  const server = createServer(certificate, serve), wrongServer = createServer(otherCertificate.matched, serve);
  const trap = createServer(certificate, (_request, response) => { trapCalls++; response.end(); });
  for (const instance of [server, wrongServer, trap]) {
    instance.on('tlsClientError', () => {});
    instance.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  }
  const listen = instance => new Promise(resolve => { instance.listen(0, '127.0.0.1', resolve); });
  const close = instance => new Promise((resolve, reject) => { instance.close(error => error ? reject(error) : resolve()); });
  async function until(check) {
    const deadline = Date.now() + 5000;
    while (!await check()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, 'Owned HTTP observation did not settle'); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  function client({ timeoutMs = 2000, lookupFn = (_host, _options, callback) => callback(null, [{ address: '93.184.216.34', family: 4 }]), trust = 'matched', maxActive = 4 } = {}) {
    const transport = createPlexHttpsTransport({ lookupFn, requestFn: (url, options, callback) => {
      stats.requests++; assert.equal(options.rejectUnauthorized, true); assert.equal(options.servername, url.hostname); assert.equal(options.maxHeaderSize, 16384);
      assert.equal(options.agent.options.keepAlive, false); assert.deepEqual(options.agent.options.proxyEnv, {});
      const target = trust === 'wrong-name' ? wrongServer : server;
      const outgoing = request(url, { ...options, port: target.address().port, headers: { ...options.headers, Host: url.host },
        ca: trust === 'untrusted' ? undefined : trust === 'wrong-name' ? otherCertificate.ca : certificate.cert,
        lookup: (hostname, settings, done) => options.lookup(hostname, settings, (error, answers, family) => {
          if (error) done(error);
          else if (Array.isArray(answers)) done(null, answers.map(() => ({ address: '127.0.0.1', family: 4 })));
          else done(null, '127.0.0.1', family);
        }) }, incoming => { incoming.once('close', () => { stats.responseCloses++; }); callback(incoming); });
      outgoing.once('close', () => { stats.requestCloses++; });
      outgoing.once('socket', socket => { socket.once('close', () => { stats.socketCloses++; }); socket.once('secureConnect', () => { assert.equal(socket.authorized, true); stats.secure++; }); });
      return outgoing;
    } });
    const value = createPlexHttpClient({ transport, timeoutMs, maxActive }); clients.add(value); return value;
  }
  const input = { clientIdentifier: 'public-fixture-client', accessToken: 'public-fixture-token' };
  async function retired(value) { assert.equal(await value.waitForDrain(), true); assert.equal(value.getRequestState().active, 0); assert.equal(stats.requests, stats.requestCloses); assert.equal(stats.requests, stats.socketCloses); await until(() => sockets.size === 0); }
  await withWorkerTaskCleanup(async () => {
    await Promise.all([listen(server), listen(wrongServer), listen(trap)]);
    const normal = client();
    assert.equal((await normal.createPin(input)).id, 123); assert.equal((await normal.readPin({ ...input, pinId: 123 })).authToken, input.accessToken);
    assert.equal((await normal.fetchCurrentUser(input)).uuid, 'http-fixture-subject'); assert.deepEqual(await normal.fetchHomeUsers(input), [{ id: 123 }]);
    assert.deepEqual(await normal.fetchResources(input), [{ name: 'fixture-server' }]); await retired(normal);
    results.push('real-verified-tls-all-five-endpoints-and-owned-native-close');
    mode = 'exact-limit'; assert.equal((await normal.createPin(input)).id, 123); await retired(normal); results.push('exact-byte-boundary-accepted');
    for (const [selected, expected] of [['declared-large','plex_request_oversized'],['chunked-large','plex_request_oversized'],['oversized-header','plex_request_unavailable'],
      ['compressed','plex_request_invalid'],['invalid-utf8','plex_pin_invalid_response'],['invalid-json','plex_pin_invalid_response'],['truncated',null],['redirect','plex_request_redirect']]) {
      mode = selected; await assert.rejects(normal.createPin(input), error => error.status === 502 && (!expected || error.code === expected)); await retired(normal); results.push(selected + '-refused-and-closed');
    }
    assert.equal(trapCalls, 0);
    for (const [selected, code] of [['unauthorized','plex_token_invalid'],['server-error','plex_user_fetch_failed']]) {
      mode = selected; await assert.rejects(normal.fetchCurrentUser(input), error => error.code === code && !error.message.includes('PUBLIC-FIXTURE-SECRET')); await retired(normal); results.push(selected + '-fixed-private-diagnostic');
    }
    for (const selected of ['headers-stall','slow-body']) {
      mode = selected; const timed = client({ timeoutMs: 75 }); await assert.rejects(timed.createPin(input), { code: 'plex_request_timeout' }); await retired(timed); results.push(selected + '-whole-request-deadline-and-retirement');
    }
    mode = 'normal';
    for (const trust of ['untrusted','wrong-name']) { const refused = client({ trust }); const before = received;
      await assert.rejects(refused.fetchCurrentUser(input), { code: 'plex_request_unavailable' }); await retired(refused); assert.equal(received, before); results.push(trust + '-tls-refusal-before-http-token-delivery'); }
    const privateDns = client({ lookupFn: (_host, _options, callback) => callback(null, [{ address: '127.0.0.1', family: 4 }]) });
    const beforePrivate = received; await assert.rejects(privateDns.createPin(input), { code: 'plex_request_unavailable' }); await retired(privateDns); assert.equal(received, beforePrivate); results.push('private-dns-answer-refused-before-connection');
    let dnsCallback; const dnsEntered = Promise.withResolvers();
    const heldDns = client({ timeoutMs: 75, maxActive: 1, lookupFn: (_host, _options, callback) => { dnsCallback = callback; dnsReleases.add(callback); dnsEntered.resolve(); } });
    const timedDns = heldDns.createPin(input); const dnsRefusal = assert.rejects(timedDns, { code: 'plex_request_timeout' }); await dnsEntered.promise; await dnsRefusal;
    assert.equal(heldDns.getRequestState().active, 1); await assert.rejects(heldDns.createPin(input), { code: 'plex_request_busy' });
    let closed = false; const closing = heldDns.close(); closing.then(() => { closed = true; });
    await new Promise(resolve => { setImmediate(resolve); }); assert.equal(closed, false);
    dnsCallback(null, [{ address: '93.184.216.34', family: 4 }]); dnsReleases.delete(dnsCallback); await closing; await retired(heldDns);
    await assert.rejects(heldDns.createPin(input), { code: 'plex_request_closed' }); results.push('deadline-and-shutdown-retain-capacity-through-actual-delayed-dns-callback');

    const shared = client({ timeoutMs: 250 });
    await persistSettings([{ namespace: 'system', settingKey: 'baseUrl', value: 'http://127.0.0.1:3000' }]);
    app = createApp({ appPort: 3000, clientDistDir: '/app/client-dist', packageJsonPath: '/app/package.json', createPlexHttpClient: () => shared });
    assert.equal(app.plexHttpClient, shared);
    runtime = await startServerRuntime({ createApp: () => app, startBackgroundServices: false, processEmitter: new EventEmitter(), stdout: { write() {} }, stderr: { write() {} } });
    const bootstrap = await fetch('http://127.0.0.1:3000/api/v1/bootstrap/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'http-admin', password: 'PublicHttpFixture123!' }) });
    assert.equal(bootstrap.status, 201); await bootstrap.json(); await getPool().query("UPDATE app_users SET auth_provider='plex',auth_subject='http-fixture-subject' WHERE username='http-admin'");
    const started = await fetch('http://127.0.0.1:3000/api/v1/auth/plex/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(started.status, 202); const cookie = started.headers.getSetCookie()[0].split(';')[0], dto = await started.json();
    const target = new URLSearchParams(dto.authorizationUrl.split('#?')[1]).get('forwardUrl');
    const beforeSessions = Number((await getPool().query('SELECT count(*) FROM refresh_tokens')).rows[0].count);
    mode = 'user-stall'; const refused = await fetch(target, { redirect: 'manual', headers: { cookie } });
    assert.equal(refused.status, 303); assert.match(refused.headers.get('location'), /plex_request_timeout/u); assert.deepEqual(refused.headers.getSetCookie(), []);
    assert.equal(Number((await getPool().query('SELECT count(*) FROM refresh_tokens')).rows[0].count), beforeSessions);
    assert.equal(Number((await getPool().query("SELECT count(*) FROM audit_events WHERE event_type='plex_sign_in_succeeded'")).rows[0].count), 0);
    await retired(shared); mode = 'normal';
    const accepted = await fetch(target, { redirect: 'manual', headers: { cookie } }); assert.equal(accepted.headers.get('location'), '/app'); assert.ok(accepted.headers.getSetCookie().some(value => value.startsWith('harmoniarr_refresh=')));
    assert.equal(Number((await getPool().query('SELECT count(*) FROM refresh_tokens')).rows[0].count), beforeSessions + 1); await retired(shared);
    results.push('mounted-callback-native-timeout-has-no-session-audit-or-cookie-and-explicit-retry-succeeds');
  }, async () => {
    for (const callback of dnsReleases) callback(new Error('fixture closing'));
    for (const timer of timers) clearTimeout(timer);
    if (runtime) await runtime.startupServiceSupervisor.shutdown({ onShutdown: async () => { runtime.server.closeIdleConnections(); await new Promise(resolve => { runtime.server.close(resolve); }); } });
    if (app) await drainApplicationWorkerOwners(app);
    await Promise.all([...clients].map(value => value.close()));
    for (const socket of sockets) socket.destroy();
    await Promise.all([close(server), close(wrongServer), close(trap)]); await closePool();
  });
  t.diagnostic(JSON.stringify({ results, stats, actualNativeClose: true, verifiedFixtureTls: true, byteAndTimeBounds: true,
    actualDnsDrain: true, activeAdmissionHeld: true, redirectTrapCalls: trapCalls, callbackPublicationFenced: true }));
});
