/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';

const secret = 'PUBLIC-TEST-ONLY-fanart-private';
const images = [{ id: 'english', url: 'https://assets.fanart.tv/other.jpg', likes: '99', lang: 'en' },
  { id: 'chosen', url: 'https://assets.fanart.tv/fixture.jpg', likes: '5', lang: '' }];
const payload = { artistthumb: images, albums: [{ release_group_id: 'unrelated', cdart: [] }] };
const consumerUrl = new URL('../../testing/server/fanart-https-consumer.js', import.meta.url);
function json(res, body, encoding = null) {
  const plain = Buffer.from(JSON.stringify(body));
  const bytes = encoding === 'gzip' ? gzipSync(plain) : encoding === 'br' ? brotliCompressSync(plain) : plain;
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length,
    ...(encoding ? { 'content-encoding': encoding } : {}) }); res.end(bytes);
  return { decoded: plain.length, encoded: bytes.length };
}

for (const [scenario, count, assertions] of [['normal', 7, 7], ['bounds', 8, 8], ['adverse', 10, 7]]) {
  test(`native Fanart.tv ${scenario} preserves bounded results, credential boundaries and socket retirement`, { timeout: 20000 }, async t => {
    const attempts = new Map(); const timers = new Set(); const closes = []; const closedPaths = [];
    const trackClose = (req, path) => {
      const closed = new Promise(resolve => { req.socket.once('close', () => { closedPaths.push(path); resolve(); }); });
      closes.push(closed);
    };
    let trickles = 0;
    try {
      await withProviderHttpsFixture({ consumerUrl, signal: t.signal, handler(req, res) {
        assert.equal(req.headers.host, 'webservice.fanart.tv'); assert.equal(req.socket.servername, req.headers.host);
        assert.equal(req.headers['api-key'], secret); assert.equal(req.headers['client-key'], secret);
        const url = new URL(req.url, 'https://webservice.fanart.tv');
        assert.equal(url.search, ''); assert.ok(url.pathname.startsWith('/v3.2/music/'));
        const path = url.pathname.split('/').at(-1); attempts.set(path, (attempts.get(path) ?? 0) + 1);
        if (path === 'healthy') {
          // Child stays alive awaiting this response. Request cancellation must
          // close earlier sockets before process exit/fixture cleanup can help.
          void Promise.all(closes).then(() => { if (!res.destroyed) json(res, payload); }); return;
        }
        if (['gzip', 'br'].includes(path)) { json(res, payload, path); return; }
        if (path === 'album-compatibility') { assert.ok(url.pathname.includes('/music/albums/')); json(res, { albumcover: images }, 'gzip'); return; }
        if (path === 'redirect') { res.writeHead(302, { location: 'https://redirect-sink.example.invalid/credential-sink' }); res.end(); return; }
        if (['gzip-large', 'br-large'].includes(path)) {
          const sizes = json(res, { padding: 'x'.repeat(2_000_001) }, path === 'br-large' ? 'br' : 'gzip');
          assert.ok(sizes.encoded < 2_000_000); assert.ok(sizes.decoded > 2_000_000); return;
        }
        if (path === 'chunked-large') { res.write('{"padding":"'); res.end('x'.repeat(2_000_001) + '"}'); return; }
        if (path === 'bad-json') { res.end(`{"private":"${secret}`); return; }
        if (path === 'bad-utf8') { res.end(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])); return; }
        if (path === 'bad-gzip') { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end('bad-compression'); return; }
        if (path === 'declared-large') { trackClose(req, path); res.writeHead(200, { 'content-length': '2000001' }); res.write('{}'); return; }
        if (path.startsWith('retry-') && attempts.get(path) === 2) {
          void Promise.all(closes).then(() => { if (!res.destroyed) json(res, payload); }); return;
        }
        assert.ok(['retry-503', 'retry-429', 'exhausted', 'not-found', 'denied', 'headers-stall', 'body-stall', 'trickle'].includes(path));
        trackClose(req, path); if (path === 'headers-stall') return;
        const status = path.startsWith('retry-') ? Number(path.slice(6)) : path === 'exhausted' ? 500
          : path === 'not-found' ? 404 : path === 'denied' ? 401 : 200;
        res.writeHead(status, { 'x-private': secret, 'retry-after': '3' }); res.write(status === 200 ? '{' : secret);
        if (path === 'trickle') {
          const timer = setInterval(() => { trickles++; res.write(' '); }, 100); timers.add(timer);
          req.socket.once('close', () => { clearInterval(timer); timers.delete(timer); });
        }
      } }, async ({ records, runClient }) => {
        const result = await runClient(scenario);
        assert.equal(result.assertions, assertions); assert.equal(result.node, process.versions.node);
        assert.equal(result.undici, process.versions.undici); assert.equal(result.tlsVerificationDisabled, false);
        assert.equal(records.requests.length, count);
        assert.equal(records.tunnels.some(authority => authority.includes('redirect-sink')), false);
        if (scenario === 'adverse') {
          for (const path of ['retry-503', 'retry-429', 'exhausted']) assert.equal(attempts.get(path), 2);
          assert.deepEqual([...closedPaths].sort(), ['body-stall', 'exhausted', 'exhausted', 'headers-stall', 'retry-429', 'retry-503', 'trickle']);
          assert.ok(trickles > 1);
        } else if (scenario === 'normal') assert.deepEqual(closedPaths, ['not-found', 'denied']);
        else assert.deepEqual(closedPaths, ['declared-large']);
      });
      assert.equal(timers.size, 0);
    } finally { for (const timer of timers) clearInterval(timer); }
  });
}
