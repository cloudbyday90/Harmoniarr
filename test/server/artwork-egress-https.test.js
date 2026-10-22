/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';

const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
for (const [scenario, profile, trust, count] of [['fallback', 'matched', true, 1], ['blocked', 'matched', true, 0],
  ['proxy', 'matched', true, 0], ['tls-refusal', 'mismatched', true, 0], ['tls-refusal', 'matched', false, 0],
  ['redirect-rebind', 'matched', true, 2], ['retry-rebind', 'matched', true, 2]]) {
  test(`native artwork egress ${scenario} (${profile}, trust=${trust}) preserves pinning and refusal`, { timeout: 10000 }, async t => {
    const closed = []; const paths = [];
    await withProviderHttpsFixture({ signal: t.signal, profile, transport: 'direct',
      consumerUrl: new URL('../../testing/server/artwork-egress-https-consumer.js', import.meta.url),
      handler(req, res) {
        assert.equal(req.headers.host, req.socket.servername); paths.push(req.url);
        if (req.url === '/healthy') { void Promise.all(closed).then(() => { if (!res.destroyed) res.end(png); }); return; }
        if (req.headers.host === 'coverartarchive.org') {
          closed.push(new Promise(resolve => { req.socket.once('close', resolve); }));
          res.writeHead(scenario === 'retry-rebind' ? 503 : 307, { location: 'https://archive.org/download/fixture.png' });
          res.write('PRIVATE-egress-body'); return;
        }
        assert.equal(req.headers.host, 'assets.fanart.tv'); res.end(png);
      },
    }, async ({ records, runClient }) => {
      const result = await runClient(scenario, { trust });
      assert.equal(result.passed, true); assert.equal(result.node, process.versions.node); assert.equal(result.tlsVerificationDisabled, false);
      assert.equal(records.requests.length, count); assert.equal(records.proxyConnections, 0); assert.equal(records.tunnels.length, 0);
      if (scenario.endsWith('rebind')) assert.deepEqual(paths, ['/release/fixture/front', '/healthy']);
      if (scenario === 'tls-refusal') assert.ok(records.connections > 0);
    });
  });
}
