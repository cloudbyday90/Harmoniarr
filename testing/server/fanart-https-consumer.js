/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createFanartTvClient } from '../../src/server/integrations/fanart-tv/fanart-client.js';

const secret = 'PUBLIC-TEST-ONLY-fanart-private';
const image = { id: 'chosen', url: 'https://assets.fanart.tv/fixture.jpg', likes: 5 };
const expected = [{ ...image, imageType: 'artistthumb' }];
const client = options => createFanartTvClient({ maxRetries: 0, requestTimeoutMs: 3000, sleepImpl: async () => {},
  resolveApiKey: async () => secret, resolveClientKey: async () => secret, ...options });
const get = (service, mbid) => service.fetchArtistImages({ mbid });
let assertions = 0;
async function refused(operation, kind, status = null) {
  await assert.rejects(operation, error => {
    assert.equal(error.diagnosticCode, kind); assert.equal(error.details.status, status);
    assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
    assert.equal(Object.hasOwn(error.details, 'url'), false); assert.equal(Object.hasOwn(error.details, 'cause'), false);
    return true;
  }); assertions++;
}
const scenarios = {
  async normal() {
    const service = client();
    assert.deepEqual(await get(service, 'gzip'), expected);
    assert.deepEqual(await get(service, 'br'), expected);
    // Flat compatibility payload; current v3.2 album-envelope support is separate.
    assert.deepEqual(await service.fetchAlbumImages({ mbid: 'album-compatibility' }), [{ ...image, imageType: 'albumcover' }]);
    assert.deepEqual(await get(service, 'not-found'), []);
    await refused(get(service, 'denied'), 'request_rejected', 401);
    await refused(get(service, 'redirect'), 'unavailable');
    assert.deepEqual(await get(service, 'healthy'), expected); assertions += 5;
  },
  async bounds() {
    const service = client({ maxRetries: 1 });
    for (const path of ['gzip-large', 'br-large', 'chunked-large', 'bad-json', 'bad-utf8', 'bad-gzip', 'declared-large']) {
      await refused(get(service, path), 'response_invalid');
    }
    assert.deepEqual(await get(service, 'healthy'), expected); assertions++;
  },
  async adverse() {
    for (const status of [503, 429]) {
      const delays = [];
      const service = client({ maxRetries: 1, sleepImpl: async delay => { delays.push(delay); } });
      assert.deepEqual(await get(service, `retry-${status}`), expected);
      assert.equal(delays.length, 1); assert.equal(delays[0], 3000); assertions++;
    }
    await refused(get(client({ maxRetries: 1 }), 'exhausted'), 'unavailable', 500);
    for (const path of ['headers-stall', 'body-stall', 'trickle']) await refused(get(client({ requestTimeoutMs: 1200 }), path), 'timeout');
    assert.deepEqual(await get(client(), 'healthy'), expected); assertions++;
  },
};
const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error('Unknown Fanart.tv HTTPS fixture scenario');
await scenario();
console.log(JSON.stringify({ scenario: process.argv[2], assertions, node: process.versions.node, undici: process.versions.undici,
  tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
