/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';
import { largeMusicBrainzRelease } from '../../testing/server/musicbrainz-response-fixtures.js';

const secret = 'PUBLIC-TEST-ONLY-private-query';
const consumerUrl = new URL('../../testing/server/musicbrainz-https-consumer.js', import.meta.url);
function json(res, body, encoding = null) {
  const plain = Buffer.from(JSON.stringify(body));
  const bytes = encoding === 'gzip' ? gzipSync(plain) : encoding === 'br' ? brotliCompressSync(plain) : plain;
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': bytes.length,
    ...(encoding ? { 'content-encoding': encoding } : {}) }); res.end(bytes);
  return { decoded: plain.length, encoded: bytes.length };
}

for (const [scenario, count, assertions] of [['normal', 5, 5], ['bounds', 9, 9], ['adverse', 10, 7]]) {
  test(`native MusicBrainz ${scenario} preserves operation bounds, paging and socket retirement`, { timeout: 20000 }, async t => {
    const attempts = new Map(); const timers = new Set(); const closes = []; const closedPaths = [];
    const trackClose = (req, path) => {
      const closed = new Promise(resolve => { req.socket.once('close', () => { closedPaths.push(path); resolve(); }); });
      closes.push(closed);
    };
    let trickles = 0;
    try {
      await withProviderHttpsFixture({ consumerUrl, signal: t.signal, handler(req, res) {
        assert.equal(req.headers.host, 'musicbrainz.org'); assert.equal(req.socket.servername, req.headers.host);
        assert.match(req.headers['user-agent'], /^Harmoniarr\//u);
        const url = new URL(req.url, 'https://musicbrainz.org'); assert.equal(url.searchParams.get('fmt'), 'json');
        const path = url.searchParams.get('release-group') ?? url.pathname.split('/').at(-1);
        attempts.set(path, (attempts.get(path) ?? 0) + 1);
        if (path === 'healthy') {
          // Child waits here while earlier sockets must close due to request
          // cancellation, before process exit or fixture destruction can occur.
          void Promise.all(closes).then(() => { if (!res.destroyed) json(res, { ok: true }); }); return;
        }
        if (path === 'gzip') { const sizes = json(res, largeMusicBrainzRelease(), 'gzip'); assert.ok(sizes.decoded > 2_000_000); return; }
        if (path === 'br') {
          assert.equal(url.searchParams.get('limit'), '100'); assert.equal(url.searchParams.get('offset'), '7');
          json(res, { 'release-count': 101, offset: 7, releases: [largeMusicBrainzRelease()] }, 'br'); return;
        }
        if (['gzip-large', 'br-large', 'release-large'].includes(path)) {
          const cap = path === 'release-large' ? 8_000_000 : 2_000_000;
          const sizes = json(res, { padding: 'x'.repeat(cap + 1) }, path === 'br-large' ? 'br' : 'gzip');
          assert.ok(sizes.encoded < cap); assert.ok(sizes.decoded > cap); return;
        }
        if (path === 'chunked-large') { res.write('{"padding":"'); res.end('x'.repeat(2_000_001) + '"}'); return; }
        if (path === 'bad-json') { res.end(`{"private":"${secret}`); return; }
        if (path === 'bad-utf8') { res.end(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])); return; }
        if (path === 'bad-gzip') { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end('bad-compression'); return; }
        if (path === 'declared-large') { trackClose(req, path); res.writeHead(200, { 'content-length': '2000001' }); res.write('{}'); return; }
        if (path.startsWith('retry-') && attempts.get(path) === 2) {
          void Promise.all(closes).then(() => { if (!res.destroyed) json(res, { ok: true }); }); return;
        }
        assert.ok(['retry-503', 'retry-429', 'exhausted', 'not-found', 'denied', 'headers-stall', 'body-stall', 'trickle'].includes(path));
        trackClose(req, path); if (path === 'headers-stall') return;
        const status = path.startsWith('retry-') ? Number(path.slice(6)) : path === 'exhausted' ? 503
          : path === 'not-found' ? 404 : path === 'denied' ? 400 : 200;
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
