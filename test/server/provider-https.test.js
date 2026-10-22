/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';

const secret = 'PUBLIC-TEST-ONLY-private-sentinel';
function json(res, body, encoding = null, status = 200, extra = {}) {
  let bytes = Buffer.from(JSON.stringify(body));
  const decodedBytes = bytes.length;
  if (encoding) bytes = encoding === 'br' ? brotliCompressSync(bytes) : gzipSync(bytes);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': bytes.length,
    ...(encoding ? { 'content-encoding': encoding } : {}), ...extra });
  res.end(bytes);
  return { decodedBytes, encodedBytes: bytes.length };
}
function qualified(result, assertions) {
  assert.equal(result.assertions, assertions);
  assert.equal(result.node, process.versions.node);
  assert.equal(result.undici, process.versions.undici);
  assert.equal(result.tlsVerificationDisabled, false);
}

test('real provider clients preserve DNS identity, credentials and compressed JSON through bundled fetch', { timeout: 15000 }, async t => {
  await withProviderHttpsFixture({ signal: t.signal, handler(req, res) {
    const url = new URL(req.url, `https://${req.headers.host}`);
    if (req.headers.host === 'accounts.spotify.com') {
      assert.equal(req.method, 'POST'); assert.equal(url.pathname, '/api/token');
      assert.equal(req.headers.authorization, `Basic ${Buffer.from(`${secret}:${secret}`).toString('base64')}`);
      let body = '';
      req.on('data', chunk => { body += chunk; assert.ok(body.length < 1024); });
      req.on('end', () => { assert.equal(body, 'grant_type=client_credentials'); json(res, { access_token: secret, expires_in: 3600 }, 'gzip'); });
    } else if (req.headers.host === 'api.spotify.com') {
      assert.equal(req.headers.authorization, `Bearer ${secret}`);
      json(res, { id: url.pathname.split('/').at(-1) }, 'br');
    } else if (req.headers.host === 'www.googleapis.com') {
      assert.equal(url.searchParams.get('key'), secret); assert.equal(req.headers.authorization, undefined);
      json(res, { items: [{ id: 'video' }] }, 'gzip');
    } else if (req.headers.host === 'api.music.apple.com') {
      assert.match(req.headers.authorization, /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/u);
      json(res, { data: [{ id: 'playlist' }] }, 'br');
    } else if (req.headers.host === 'oauth2.googleapis.com') {
      assert.equal(req.method, 'POST'); assert.equal(url.pathname, '/token');
      let body = '';
      req.on('data', chunk => { body += chunk; assert.ok(body.length < 1024); });
      req.on('end', () => { assert.equal(body, `refresh_token=${secret}`); json(res, { access_token: secret }, 'br'); });
    } else { assert.equal(req.headers.host, '127.0.0.1'); json(res, { ip: true }); }
  } }, async ({ records, runClient }) => {
    qualified(await runClient('clients'), 6);
    assert.equal(records.requests.length, 7);
    assert.equal(records.requests.filter(row => row.host === 'accounts.spotify.com').length, 1, 'Client token cache remains effective');
    for (const row of records.requests.filter(requestRow => requestRow.host !== '127.0.0.1')) assert.equal(row.servername, row.host);
    assert.equal(records.requests.find(row => row.host === '127.0.0.1').servername, false);
  });
});

for (const [profile, trust] of [['mismatched', true], ['matched', false]]) {
  test(`real HTTPS refuses ${trust ? 'DNS/IP identity mismatch' : 'an untrusted chain'} before HTTP delivery`, { timeout: 10000 }, async t => {
    await withProviderHttpsFixture({ profile, signal: t.signal, handler() { assert.fail('TLS refusal must precede HTTP'); } }, async ({ records, runClient }) => {
      qualified(await runClient('tls', { trust }), 2);
      assert.equal(records.requests.length, 0);
      assert.equal(records.tunnels.length, 2);
      assert.equal(records.connections, 2);
    });
  });
}

test('native redirects never reach same-origin or cross-origin targets, and the next request remains usable', { timeout: 15000 }, async t => {
  await withProviderHttpsFixture({ signal: t.signal, handler(req, res) {
    const url = new URL(req.url, 'https://api.spotify.com');
    if (url.pathname === '/healthy') { json(res, { healthy: true }); return; }
    const [, , status, target] = url.pathname.split('/');
    assert.ok(status && target, 'A redirect target must never receive an HTTP request');
    res.writeHead(Number(status), { location: target === 'same' ? '/redirect-target' : 'https://redirect-sink.example.invalid/target' }); res.end();
  } }, async ({ records, runClient }) => {
    qualified(await runClient('redirects'), 11);
    assert.equal(records.requests.length, 11);
    assert.equal(records.tunnels.some(authority => authority.startsWith('redirect-sink.')), false);
  });
});

test('native decoded-body bounds, deadlines and HTTP errors preserve only approved diagnostics', { timeout: 15000 }, async t => {
  let trickles = 0;
  const timers = new Set();
  const closedBodies = new Set();
  const bodyCloses = [];
  try {
    await withProviderHttpsFixture({ signal: t.signal, handler(req, res) {
      const path = new URL(req.url, 'https://api.spotify.com').pathname;
      if (path === '/healthy') {
        // The child remains alive awaiting this response: process exit and fixture
        // teardown cannot substitute for deadline-driven socket retirement.
        void Promise.all(bodyCloses).then(() => { if (!res.destroyed) json(res, { healthy: true }); });
        return;
      }
      if (['/gzip-large', '/br-large'].includes(path)) {
        const sizes = json(res, { value: 'x'.repeat(4096) }, path === '/br-large' ? 'br' : 'gzip');
        assert.ok(sizes.encodedBytes < 128); assert.ok(sizes.decodedBytes > 128);
        return;
      }
      if (path === '/chunked-large') { res.writeHead(200); res.write('{"value":"'); res.end('x'.repeat(256) + '"}'); return; }
      if (path === '/bad-gzip') { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end('invalid-gzip'); return; }
      if (path === '/bad-json') { res.end(`{"private":"${secret}`); return; }
      if (path === '/bad-utf8') { res.end(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])); return; }
      if (path === '/http-error') { json(res, { error: { reason: 'QUOTA_EXCEEDED', message: secret }, private: secret }, 'br', 429, { 'retry-after': '9999999', 'x-private': secret }); return; }
      if (path === '/large-http-error') { json(res, { private: secret.repeat(100) }, null, 401); return; }
      assert.ok(['/stall', '/trickle'].includes(path));
      bodyCloses.push(new Promise(resolve => { req.socket.once('close', () => { closedBodies.add(path); resolve(); }); }));
      res.writeHead(200); res.write('{');
      if (path === '/trickle') {
        const timer = setInterval(() => { trickles++; res.write(' '); }, 100); timers.add(timer);
        req.socket.once('close', () => { clearInterval(timer); timers.delete(timer); });
      }
    } }, async ({ records, runClient }) => {
      qualified(await runClient('bodies'), 11);
      assert.equal(records.requests.length, 11);
      assert.ok(trickles > 1, 'Ongoing body activity must not reset the absolute deadline');
      assert.deepEqual([...closedBodies].sort(), ['/stall', '/trickle']);
    });
    assert.equal(timers.size, 0);
  } finally { for (const timer of timers) clearInterval(timer); }
});

test('aborting an active native HTTPS child drains its process before fixture retirement', { timeout: 10000 }, async t => {
  const controller = new AbortController();
  const reason = new Error('Owned HTTPS fixture cancellation');
  const signal = AbortSignal.any([controller.signal, t.signal]);
  let delivered = false;
  await assert.rejects(withProviderHttpsFixture({ signal, handler() {
    delivered = true;
    controller.abort(reason);
  } }, ({ runClient }) => runClient('bodies')), error => error === reason);
  assert.equal(delivered, true);
});

test('callback failure drains an active HTTPS child and preserves the original null rejection', { timeout: 10000 }, async t => {
  let acknowledge;
  const delivered = new Promise(resolve => { acknowledge = resolve; });
  await assert.rejects(withProviderHttpsFixture({ signal: t.signal, handler() { acknowledge(); } }, async ({ runClient }) => {
    const running = runClient('bodies');
    await Promise.race([delivered, running]);
    throw null;
  }), error => error === null);
});

test('provider origin admission refuses unsafe and malformed URLs without any native connection', { timeout: 10000 }, async t => {
  await withProviderHttpsFixture({ signal: t.signal, handler() { assert.fail('Rejected origins must not reach HTTP'); } }, async ({ records, runClient }) => {
    qualified(await runClient('admission'), 7);
    assert.equal(records.tunnels.length, 0);
    assert.equal(records.connections, 0);
    assert.equal(records.requests.length, 0);
  });
});
