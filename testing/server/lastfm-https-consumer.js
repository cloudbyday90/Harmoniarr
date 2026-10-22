/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createLastFmClient } from '../../src/server/integrations/lastfm/lastfm-client.js';

const secret = 'PUBLIC-TEST-ONLY-lastfm-private-sentinel';
const expected = [{ mbid: 'fixture-artist', name: 'Fixture Artist', score: 0.8 }];
const client = options => createLastFmClient({ apiKey: secret, maxRetries: 0, requestTimeoutMs: 3000, sleepImpl: async () => {}, ...options });
const get = (service, mbid) => service.getSimilarArtists({ mbid });
let assertions = 0;
async function refused(operation, kind, status = null) {
  await assert.rejects(operation, error => {
    assert.equal(error.diagnosticCode, kind);
    assert.equal(error.details.status, status);
    assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
    assert.equal(Object.hasOwn(error.details, 'url'), false); assert.equal(Object.hasOwn(error.details, 'cause'), false);
    return true;
  });
  assertions++;
}
const scenarios = {
  async normal() {
    const service = client();
    assert.deepEqual(await get(service, 'gzip'), expected);
    assert.deepEqual(await get(service, 'br'), expected);
    assert.deepEqual(await get(service, 'not-found'), []);
    assert.deepEqual(await get(service, 'denied'), []);
    assert.deepEqual(await get(service, 'healthy'), expected);
    assertions += 5;
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
      assert.equal(delays.length, 1); assert.ok(delays[0] >= 2000 && delays[0] < 2250); assertions++;
    }
    await refused(get(client({ maxRetries: 1 }), 'exhausted'), 'unavailable', 500);
    for (const path of ['headers-stall', 'body-stall', 'trickle']) await refused(get(client({ requestTimeoutMs: 1200 }), path), 'timeout');
    assert.deepEqual(await get(client(), 'healthy'), expected); assertions++;
  },
};
const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error('Unknown Last.fm HTTPS fixture scenario');
await scenario();
console.log(JSON.stringify({ scenario: process.argv[2], assertions, node: process.versions.node, undici: process.versions.undici,
  tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
