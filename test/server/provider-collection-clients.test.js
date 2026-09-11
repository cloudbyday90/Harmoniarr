import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createSpotifyClient } from '../../src/server/integrations/spotify/spotify-client.js';
import { createAppleMusicClient } from '../../src/server/integrations/apple-music/apple-music-client.js';

test('Spotify collection client requests current items, complete entry envelopes, snapshot metadata, and bounded artist pages', async () => {
  const calls = [];
  const client = createSpotifyClient({ accessTokenProvider: async () => 'test-access-token', fetchFn: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return new Response(JSON.stringify({}));
  } });
  await client.getPlaylistItems('playlist', { offset: 50 });
  await client.getPlaylistSnapshot('playlist');
  await client.getArtistAlbums('artist', { limit: 50, offset: 10 });
  assert.equal(calls[0].url.pathname, '/v1/playlists/playlist/items');
  assert.equal(calls[0].url.searchParams.has('fields'), false);
  assert.equal(calls[0].url.searchParams.get('additional_types'), 'track,episode');
  assert.equal(calls[0].url.searchParams.get('offset'), '50');
  assert.equal(calls[1].url.pathname, '/v1/playlists/playlist');
  assert.equal(calls[1].url.searchParams.get('fields'), 'id,snapshot_id');
  assert.equal(calls[2].url.pathname, '/v1/artists/artist/albums');
  assert.equal(calls[2].url.searchParams.get('limit'), '10');
  assert.equal(calls[2].url.searchParams.get('include_groups'), 'album,single');
  assert.ok(calls.every((call) => call.url.origin === 'https://api.spotify.com'));
});

test('Apple collection clients read the relationship endpoints in the requested storefront', async () => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const calls = [];
  const client = createAppleMusicClient({ teamId: 'test-team', keyId: 'test-key', privateKey, fetchFn: async (url) => {
    calls.push(new URL(url));
    return new Response(JSON.stringify({ data: [] }));
  } });
  await client.getCatalogPlaylistTracks('gb', 'pl.test', { offset: 100 });
  await client.getCatalogArtistAlbums('de', '123', { offset: 25 });
  assert.equal(calls[0].pathname, '/v1/catalog/gb/playlists/pl.test/tracks');
  assert.equal(calls[0].searchParams.get('offset'), '100');
  assert.equal(calls[0].searchParams.get('include'), 'albums,artists');
  assert.equal(calls[1].pathname, '/v1/catalog/de/artists/123/albums');
  assert.equal(calls[1].searchParams.get('offset'), '25');
  assert.ok(calls.every((url) => url.origin === 'https://api.music.apple.com'));
});
