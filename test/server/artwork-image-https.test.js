/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { gzipSync } from 'node:zlib';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';

const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
for (const [scenario, count] of [['normal', 5], ['bounds', 7], ['adverse', 4]]) {
  test(`native artwork image ${scenario} retains origin, byte, decode and retirement boundaries`, { timeout: 20000 }, async t => {
    const closes = []; const timers = new Set(); const closed = [];
    const track = (req, path) => { closes.push(new Promise(resolve => { req.socket.once('close', () => { closed.push(path); resolve(); }); })); };
    try {
      await withProviderHttpsFixture({ signal: t.signal, consumerUrl: new URL('../../testing/server/artwork-image-https-consumer.js', import.meta.url),
        handler(req, res) {
          assert.equal(req.socket.servername, req.headers.host); assert.equal(req.method, 'GET');
          assert.equal(req.headers['accept-encoding'], 'identity');
          assert.equal(req.headers['api-key'], undefined); assert.equal(req.headers['client-key'], undefined);
          const path = new URL(req.url, `https://${req.headers.host}`).pathname;
          if (scenario === 'normal') {
            if (req.headers.host === 'coverartarchive.org') {
              assert.match(req.headers['user-agent'], /^Harmoniarr\//u);
              res.writeHead(307, { location: 'http://archive.org/download/fixture.png' }); res.end(); return;
            }
            if (req.headers.host === 'archive.org') { res.writeHead(302, { location: 'https://s3.us.archive.org/mbid-fixture/image.png' }); res.end(); return; }
            res.writeHead(200, { 'content-type': 'image/png' }); res.end(png); return;
          }
          assert.equal(req.headers.host, 'assets.fanart.tv');
          if (path === '/healthy') { void Promise.all(closes).then(() => { if (!res.destroyed) res.end(png); }); return; }
          if (path === '/exact') { res.end(Buffer.concat([png, Buffer.alloc(256 - png.length)])); return; }
          if (path === '/large') { track(req, path); res.write(png); res.write(Buffer.alloc(300)); return; }
          if (path === '/declared') { track(req, path); res.writeHead(200, { 'content-length': '257' }); res.write(png); return; }
          if (path === '/gzip') { res.writeHead(200, { 'content-encoding': 'gzip' }); res.end(gzipSync(png)); return; }
          if (path === '/svg') { res.end('<svg>PRIVATE-image-fixture</svg>'); return; }
          if (path === '/redirect') { res.writeHead(302, { location: 'https://redirect-sink.example.invalid/PRIVATE-image-fixture' }); res.end(); return; }
          track(req, path);
          if (path === '/headers-stall') return;
          assert.ok(['/body-stall', '/trickle'].includes(path)); res.writeHead(200); res.write(png.subarray(0, 8));
          if (path === '/trickle') {
            const timer = setInterval(() => res.write(' '), 100); timers.add(timer);
            req.socket.once('close', () => { clearInterval(timer); timers.delete(timer); });
          }
        },
      }, async ({ records, runClient }) => {
        const result = await runClient(scenario); assert.equal(result.imageBoundaryPassed, true);
        assert.equal(result.node, process.versions.node); assert.equal(result.tlsVerificationDisabled, false);
        assert.equal(records.requests.length, count);
        assert.equal(records.tunnels.some(authority => authority.includes('redirect-sink')), false);
        if (scenario === 'normal') assert.equal(records.tlsErrors.length, 0);
        else assert.ok(records.tlsErrors.every(code => code === 'ECONNRESET'));
        if (scenario === 'bounds') assert.deepEqual(closed.sort(), ['/declared', '/large']);
        if (scenario === 'adverse') assert.deepEqual(closed.sort(), ['/body-stall', '/headers-stall', '/trickle']);
      });
    } finally { for (const timer of timers) clearInterval(timer); }
  });
}
