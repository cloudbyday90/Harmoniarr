/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { createAppleMusicClient } from '../../src/server/integrations/apple-music/apple-music-client.js';
import { createProviderJsonRequestService } from '../../src/server/integrations/providers/provider-json-request-service.js';
import { createSpotifyClient } from '../../src/server/integrations/spotify/spotify-client.js';
import { createYouTubeClient } from '../../src/server/integrations/youtube/youtube-client.js';

const secret = 'PUBLIC-TEST-ONLY-private-sentinel';
// This retained cohort qualifies the explicit bundled-fetch seam and Apple Music.
// The guarded provider-http native entry qualifies Spotify/YouTube's direct owner.
const fetchFn = (...args) => fetch(...args);
const base = 'https://api.spotify.com';
const service = options => createProviderJsonRequestService({ provider: 'spotify', fetchFn, requestTimeoutMs: 3000, ...options });
const request = (client, path) => client.requestJson({ url: `${base}/${path}?private=${secret}`, headers: { Authorization: `Bearer ${secret}` } });
let assertions = 0;
async function rejected(operation, diagnosticCode, details) {
  await assert.rejects(operation, error => {
    assert.equal(error.diagnosticCode, diagnosticCode);
    assert.equal(JSON.stringify({ ...error, message: error.message, stack: error.stack }).includes(secret), false);
    assert.deepEqual(Object.keys(error.details).sort(), ['reasonCode', 'retryAfterSeconds', 'status']);
    if (details) assert.deepEqual(error.details, details);
    return true;
  });
  assertions++;
}

const scenarios = {
  async clients() {
    const spotify = createSpotifyClient({ clientId: secret, clientSecret: secret, fetchFn });
    assert.deepEqual(await spotify.getTrack('first'), { id: 'first' });
    assert.deepEqual(await spotify.getTrack('second'), { id: 'second' });
    const youtube = createYouTubeClient({ apiKey: secret, fetchFn });
    assert.deepEqual(await youtube.getVideos('video'), { items: [{ id: 'video' }] });
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' } });
    const apple = createAppleMusicClient({ teamId: 'TESTONLY', keyId: 'TESTONLY', privateKey });
    assert.deepEqual(await apple.getCatalogPlaylist('us', 'playlist'), { data: [{ id: 'playlist' }] });
    const oauth = createProviderJsonRequestService({ provider: 'youtube', fetchFn });
    assert.deepEqual(await oauth.requestJson({ url: 'https://oauth2.googleapis.com/token', method: 'POST', oauth: true,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `refresh_token=${secret}` }), { access_token: secret });
    const response = await fetch('https://127.0.0.1/ip-control', { signal: AbortSignal.timeout(3000) });
    assert.deepEqual(await response.json(), { ip: true });
    assertions += 6;
  },
  async tls() {
    await rejected(request(service(), 'tls-refusal'), 'unavailable');
    await assert.rejects(fetch('https://127.0.0.1/ip-control', { signal: AbortSignal.timeout(3000) }), error => {
      assert.equal(error.cause.code, process.env.NODE_EXTRA_CA_CERTS ? 'ERR_TLS_CERT_ALTNAME_INVALID' : 'UNABLE_TO_VERIFY_LEAF_SIGNATURE');
      return true;
    });
    assertions++;
  },
  async redirects() {
    for (const status of [301, 302, 303, 307, 308]) {
      for (const target of ['same', 'cross']) await rejected(request(service(), `redirect/${status}/${target}`), 'unavailable');
    }
    assert.deepEqual(await request(service(), 'healthy'), { healthy: true });
    assertions++;
  },
  async bodies() {
    for (const path of ['gzip-large', 'br-large', 'chunked-large', 'bad-gzip', 'bad-json', 'bad-utf8']) {
      await rejected(request(service({ requestPolicy: { maxResponseBytes: 128 } }), path), 'response_invalid');
    }
    await rejected(request(service(), 'http-error'), 'quota_exceeded', { status: 429, reasonCode: 'QUOTA_EXCEEDED', retryAfterSeconds: 86400 });
    await rejected(request(service({ requestPolicy: { maxResponseBytes: 128 } }), 'large-http-error'), 'credentials_rejected',
      { status: 401, reasonCode: null, retryAfterSeconds: null });
    for (const path of ['stall', 'trickle']) await rejected(request(service({ requestTimeoutMs: 1200 }), path), 'timeout');
    assert.deepEqual(await request(service(), 'healthy'), { healthy: true });
    assertions++;
  },
  async admission() {
    for (const url of [`https://127.0.0.1/?private=${secret}`, `https://${secret}@api.spotify.com/`,
      `https://api.spotify.com/#${secret}`, `https://api.spotify.com.example.invalid/?private=${secret}`,
      `http://api.spotify.com/?private=${secret}`, `https://api.spotify.com:444/?private=${secret}`, `bad-${secret}`]) {
      await rejected(service().requestJson({ url }), 'request_rejected');
    }
  },
};

const scenario = scenarios[process.argv[2]];
if (!scenario) throw new Error('Unknown provider HTTPS fixture scenario');
await scenario();
console.log(JSON.stringify({ scenario: process.argv[2], assertions, node: process.versions.node, undici: process.versions.undici,
  tlsVerificationDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' }));
