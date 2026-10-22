import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { withProviderHttpsFixture } from '../../testing/server/provider-https-fixture.js';

test('aggregate artwork admission retains real TLS, Sharp and files through held publication', { timeout: 20000 }, async t => {
  const png = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'red' } }).png().toBuffer();
  await withProviderHttpsFixture({ signal: t.signal, transport: 'direct',
    consumerUrl: new URL('../../testing/server/artwork-admission-https-consumer.js', import.meta.url),
    handler(req, res) {
      assert.equal(req.method, 'GET'); assert.equal(req.socket.servername, req.headers.host);
      assert.equal(req.headers['accept-encoding'], 'identity');
      assert.equal(req.headers['api-key'], undefined); assert.equal(req.headers['client-key'], undefined);
      res.writeHead(200, { 'content-type': 'image/png' }); res.end(png);
    },
  }, async ({ records, runClient }) => {
    const result = await runClient('admission');
    assert.equal(result.admissionPassed, true); assert.equal(result.peakActive, 2);
    assert.equal(result.images, 7); assert.equal(result.publications, 7); assert.equal(result.queuedCancelled, true);
    assert.equal(result.tlsVerificationDisabled, false); assert.equal(result.node, process.versions.node);
    assert.equal(records.requests.length, 7); assert.equal(records.proxyConnections, 0); assert.equal(records.tunnels.length, 0);
    assert.deepEqual(records.tlsErrors, []);
  });
});
