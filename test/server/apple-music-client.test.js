/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import test from 'node:test';
import { createAppleMusicClient, generateAppleMusicDeveloperToken } from '../../src/server/integrations/apple-music/apple-music-client.js';
import { createAppleMusicDeveloperTokenService } from '../../src/server/integrations/apple-music/apple-music-developer-token-service.js';
import { createProviderHttpService } from '../../src/server/integrations/providers/provider-http-service.js';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const credentials = { teamId: 'fixture-team', keyId: 'fixture-key', privateKey };
const parts = token => token.split('.').map((value, index) => index < 2 ? JSON.parse(Buffer.from(value, 'base64url')) : Buffer.from(value, 'base64url'));

test('Apple developer JWT preserves ES256 claims, P1363 signature and 180-day lifetime', () => {
  const { token, expiresAt } = generateAppleMusicDeveloperToken(credentials), [header, payload, signature] = parts(token);
  assert.deepEqual(header, { alg: 'ES256', kid: credentials.keyId });
  assert.equal(payload.iss, credentials.teamId); assert.equal(payload.exp - payload.iat, 15_552_000); assert.equal(expiresAt, payload.exp * 1000);
  assert.equal(signature.length, 64); assert.equal(verify('SHA256', Buffer.from(token.split('.').slice(0, 2).join('.')), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature), true);
});

test('Apple token cache is per client and renews at the existing 30-day expiry buffer', t => {
  const start = Date.UTC(2026, 9, 28); t.mock.timers.enable({ apis: ['Date'], now: start });
  const first = createAppleMusicDeveloperTokenService(credentials), second = createAppleMusicDeveloperTokenService(credentials);
  const token = first.getToken(); assert.equal(first.getToken(), token); assert.notEqual(second.getToken(), token);
  t.mock.timers.setTime(start + (15_552_000 - 2_592_000) * 1000 - 1); assert.equal(first.getToken(), token);
  t.mock.timers.tick(1); const renewed = first.getToken(); assert.notEqual(renewed, token); assert.equal(parts(renewed)[1].iat, Math.floor(Date.now() / 1000));
});

test('Apple signing failure is sanitized and dispatches no request', async () => {
  let calls = 0; const secret = 'PRIVATE-invalid-key-sentinel';
  const client = createAppleMusicClient({ ...credentials, privateKey: secret, fetchFn: async () => { calls++; } });
  await assert.rejects(client.getCatalogSong('us', 'song'), error => error.code === 'apple_music_misconfigured' && !JSON.stringify({ ...error, message: error.message }).includes(secret));
  assert.equal(calls, 0);
});

test('every Apple catalogue method preserves its URL/query and reuses one signed bearer', async () => {
  const requests = [], providerHttpService = { request: async input => { requests.push(input); return { data: [] }; } };
  const client = createAppleMusicClient({ ...credentials, providerHttpService });
  await client.getCatalogPlaylist('gb', 'playlist', { offset: 10, limit: 20 }); await client.getCatalogAlbum('de', 'album');
  await client.getCatalogPlaylistTracks('us', 'playlist', { offset: 100 }); await client.getCatalogArtistAlbums('fr', 'artist', { offset: 25 });
  await client.getCatalogArtist('jp', 'artist', { offset: 50 }); await client.getCatalogSong('ca', 'song');
  assert.deepEqual(requests.map(row => new URL(row.url).pathname), ['/v1/catalog/gb/playlists/playlist', '/v1/catalog/de/albums/album', '/v1/catalog/us/playlists/playlist/tracks', '/v1/catalog/fr/artists/artist/albums', '/v1/catalog/jp/artists/artist', '/v1/catalog/ca/songs/song']);
  const urls = requests.map(row => new URL(row.url));
  assert.equal(urls[0].searchParams.get('include[songs]'), 'albums,artists'); assert.equal(urls[0].searchParams.get('offset'), '10'); assert.equal(urls[0].searchParams.get('limit'), '20');
  assert.equal(urls[1].searchParams.get('include'), 'artists,tracks'); assert.equal(urls[2].searchParams.get('offset'), '100'); assert.equal(urls[3].searchParams.get('offset'), '25');
  assert.equal(urls[4].searchParams.get('offset[albums]'), '50'); assert.equal(urls[5].searchParams.get('include'), 'albums,artists');
  assert.equal(new Set(requests.map(row => row.headers.Authorization)).size, 1); assert.ok(requests.every(row => row.provider === 'apple_music' && row.maxBytes === 2_000_000));
});

test('Apple shares held retirement and capacity with Spotify and YouTube', async () => {
  const result = Promise.withResolvers(), drain = Promise.withResolvers(), entered = Promise.withResolvers(); let published = false;
  const owner = createProviderHttpService({ maxActive: 1, transport: { startRequest() { entered.resolve(); return { result: result.promise, drained: drain.promise }; } } });
  const client = createAppleMusicClient({ ...credentials, providerHttpService: owner });
  const pending = client.getCatalogSong('us', 'song').then(value => { published = true; return value; }); await entered.promise;
  result.resolve({ status: 200, headers: new Headers(), body: Buffer.from('{"data":[]}') }); await new Promise(resolve => { setImmediate(resolve); }); assert.equal(published, false);
  for (const [provider, url] of [['spotify', 'https://api.spotify.com/v1/tracks/fixture'], ['youtube', 'https://www.googleapis.com/youtube/v3/videos']]) await assert.rejects(owner.request({ provider, url }), { diagnosticCode: 'unavailable' });
  drain.resolve(true); assert.deepEqual(await pending, { data: [] }); await owner.close();
});

test('Apple rejects foreign origins and proxy configuration before dispatch', async () => {
  let calls = 0; const owner = createProviderHttpService({ env: { HTTPS_PROXY: 'http://uncontacted.invalid', NO_PROXY: '*' }, transport: { kind: 'native', startRequest() { calls++; } } });
  for (const url of ['https://api.music.apple.com/v1/test', 'https://api.spotify.com/v1/tracks/fixture']) await assert.rejects(owner.request({ provider: 'apple_music', url }), { diagnosticCode: 'request_rejected' });
  assert.equal(calls, 0); await owner.close();
});
