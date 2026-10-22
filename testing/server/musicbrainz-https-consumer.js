/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { createMusicBrainzClient } from '../../src/server/integrations/musicbrainz/musicbrainz-client.js';
import { largeMusicBrainzRelease } from './musicbrainz-response-fixtures.js';

const secret = 'PUBLIC-TEST-ONLY-private-query';
const client = options => createMusicBrainzClient({ maxRetries: 0, requestTimeoutMs: 3000,
  sleepImpl: async () => {}, ...options });
const get = (service, artistId) => service.lookupArtist({ artistId });
let assertions = 0;
async function refused(operation, kind, status = null, extra = {}) {
  await assert.rejects(operation, error => {
    assert.equal(error.diagnosticCode, kind); assert.equal(error.details.status, status);
    assert.equal(inspect(error, { depth: 8 }).includes(secret), false);
    assert.equal(Object.hasOwn(error.details, 'url'), false); assert.equal(Object.hasOwn(error.details, 'cause'), false);
    for (const [key, value] of Object.entries(extra)) assert.equal(error.details[key], value);
    return true;
  }); assertions++;
}
const scenarios = {
  async normal() {
    const service = client(); const release = largeMusicBrainzRelease();
    assert.deepEqual(await service.lookupRelease({ releaseId: 'gzip' }), release);
    assert.deepEqual(await service.browseReleaseGroupReleases({ releaseGroupId: 'br', limit: 100, offset: 7 }),
      { 'release-count': 101, offset: 7, releases: [release] });
    await refused(get(service, 'not-found'), 'not_found', 404);
    await refused(get(service, 'denied'), 'request_rejected', 400);
    assert.deepEqual(await get(service, 'healthy'), { ok: true }); assertions += 3;
  },
  async bounds() {
    const service = client({ maxRetries: 1 });
    for (const path of ['gzip-large', 'br-large', 'chunked-large', 'bad-json', 'bad-utf8', 'bad-gzip', 'declared-large']) {
      await refused(get(service, path), 'response_invalid');
    }
    await refused(service.lookupRelease({ releaseId: 'release-large' }), 'response_invalid');
    assert.deepEqual(await get(service, 'healthy'), { ok: true }); assertions++;
  },
  async adverse() {
    for (const status of [503, 429]) {
      const delays = [];
      const service = client({ maxRetries: 1, sleepImpl: async delay => { delays.push(delay); } });
      assert.deepEqual(await get(service, `retry-${status}`), { ok: true });
      assert.equal(delays.length, 1); assert.ok(delays[0] >= 3000 && delays[0] < 3250); assertions++;
    }
    await refused(get(client({ maxRetries: 1 }), 'exhausted'), 'unavailable', 503,
      { attempts: 2, maxRetries: 1, throttled: true, retryable: true, retryAfterMs: 3000 });
    for (const path of ['headers-stall', 'body-stall', 'trickle']) await refused(get(client({ requestTimeoutMs: 1200 }), path), 'timeout');
    assert.deepEqual(await get(client(), 'healthy'), { ok: true }); assertions++;
  },
};
const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error('Unknown MusicBrainz HTTPS fixture scenario');
await scenario();
console.log(JSON.stringify({ scenario: process.argv[2], assertions, node: process.versions.node, undici: process.versions.undici,
  tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
