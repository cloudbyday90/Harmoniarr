import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCollectionWorkKey, parseCollectionNextCursor } from '../../src/server/library/provider-collection-cursor-policy.js';
import { adaptProviderCollectionPage } from '../../src/server/library/provider-collection-page-adapter.js';
import { fetchProviderCollectionWork } from '../../src/server/library/provider-collection-fetch-service.js';

function row(overrides = {}) {
  const value = { mediaRequestId: 'request', sourceProvider: 'spotify', sourceIdentifier: 'playlist',
    ingestTargetType: 'playlist_page', sourceResourceType: 'playlist', pageCursor: null, pageNumber: 1, ...overrides };
  return { ...value, ingestKey: buildCollectionWorkKey(value) };
}
const album = { id: 'album', name: 'Release', artists: [{ name: 'Artist' }] };
const track = { id: 'track', type: 'track', album };

test('Spotify current and legacy entry envelopes deduplicate albums and preserve continuation input identity', () => {
  const original = row();
  const page = adaptProviderCollectionPage({ row: original, response: {
    items: [{ item: track }, { track }], total: 3, offset: 0,
    next: 'https://api.spotify.com/v1/playlists/playlist/items?offset=2&limit=50',
  } });
  assert.equal(page.items.length, 1);
  assert.equal(page.itemsSeen, 2);
  assert.equal(page.items[0].itemKey, 'spotify:release:album');
  assert.equal(page.nextPageCursor, '2');
  assert.equal(page.derivedRequests.length, 2);
  const next = page.derivedRequests.find((item) => item.ingestTargetType === 'playlist_page');
  assert.equal(next.pageNumber, 2);
  assert.equal(next.pageCursor, '2');
  assert.notEqual(next.ingestKey, original.ingestKey);
  assert.equal(original.pageCursor, null);
});

test('unavailable occurrences remain stable explicit exclusions instead of disappearing', () => {
  const input = { row: row(), response: { items: [{ item: null }, { item: { is_local: true } }], total: 2, offset: 0, next: null } };
  const page = adaptProviderCollectionPage(input);
  assert.equal(page.items.length, 2);
  assert.equal(page.items[0].itemKind, 'unsupported');
  assert.notEqual(page.items[0].itemKey, page.items[1].itemKey);
  assert.deepEqual(page, adaptProviderCollectionPage(input));
});

test('Apple relationship pagination uses provider next offset and preserves URL storefront', () => {
  const page = adaptProviderCollectionPage({ row: row({ sourceProvider: 'apple_music' }), storefront: 'gb', response: {
    data: [{ id: 'song', type: 'songs', attributes: { name: 'Song' }, relationships: { albums: { data: [
      { id: 'album', attributes: { name: 'Album', artistName: 'Artist' } },
    ] } } }], next: '/v1/catalog/gb/playlists/playlist/tracks?offset=1',
  } });
  assert.equal(page.nextPageCursor, '1');
  assert.equal(page.items[0].itemKey, 'apple_music:release:album');
  assert.equal(page.derivedRequests[0].canonicalUrl, 'https://music.apple.com/gb/album/album');
});

test('Apple songs without included relationships become bounded metadata work', () => {
  const page = adaptProviderCollectionPage({ row: row({ sourceProvider: 'apple_music' }), storefront: 'us', response: {
    data: [{ id: 'song', type: 'songs', attributes: { name: 'Song' } }],
  } });
  assert.equal(page.items.length, 0);
  assert.equal(page.derivedRequests[0].ingestTargetType, 'track');
  assert.equal(page.itemsSeen, 1);
});

test('YouTube videos remain explicit unsupported leaves and retain opaque page tokens', () => {
  const page = adaptProviderCollectionPage({ row: row({ sourceProvider: 'youtube' }), response: {
    items: [{ snippet: { title: 'Video', resourceId: { videoId: 'video' } } }], nextPageToken: 'CAAQAA',
  } });
  assert.equal(page.items[0].itemKind, 'unsupported');
  assert.equal(page.items[0].sourceIdentifier, 'video');
  assert.equal(page.derivedRequests.length, 1);
  assert.equal(page.nextPageCursor, 'CAAQAA');
});

test('YouTube duplicate video occurrences retain separate membership decisions', () => {
  const snippet = { title: 'Video', resourceId: { videoId: 'video' } };
  const page = adaptProviderCollectionPage({ row: row({ sourceProvider: 'youtube' }), response: {
    items: [{ id: 'membership-a', snippet }, { id: 'membership-b', snippet }, { snippet }],
  } });
  assert.equal(page.items.length, 3);
  assert.deepEqual(page.items.map((item) => item.sourceIdentifier), ['video', 'video', 'video']);
  assert.equal(page.items[0].itemKey, 'youtube:membership:membership-a');
  assert.equal(page.items[1].itemKey, 'youtube:membership:membership-b');
  assert.notEqual(page.items[1].itemKey, page.items[2].itemKey);
});

for (const sourceProvider of ['spotify', 'apple_music']) {
  test(`${sourceProvider} pagination cannot skip unseen membership entries`, () => {
    const response = sourceProvider === 'spotify'
      ? { items: [{ item: track }], total: 500, offset: 0, next: 'https://api.spotify.com/v1/playlists/playlist/items?offset=500' }
      : { data: [{ id: 'song' }], next: '/v1/catalog/us/playlists/playlist/tracks?offset=500' };
    assert.throws(() => adaptProviderCollectionPage({ row: row({ sourceProvider }), storefront: 'us', response }), { code: 'provider_collection_cursor_gap' });
  });
}

test('Apple nested album relationship pagination cannot silently omit albums', () => {
  assert.throws(() => adaptProviderCollectionPage({ row: row({ sourceProvider: 'apple_music' }), storefront: 'us', response: {
    data: [{ id: 'song', relationships: { albums: { data: [{ id: 'album' }], next: '/v1/catalog/us/songs/song/albums?offset=1' } } }],
  } }), { code: 'provider_collection_album_relationship_incomplete' });
});

test('Spotify page contents cannot exceed the reported total', () => {
  assert.throws(() => adaptProviderCollectionPage({ row: row(), response: { items: [{ item: track }], total: 0, offset: 0, next: null } }), { code: 'provider_collection_contents_invalid' });
});

for (const response of [null, {}, { items: [], offset: 0, total: 5, next: null }, { items: [], offset: 0, total: 5, next: 'https://api.spotify.com/v1/playlists/playlist/items?offset=1' }]) {
  test(`Spotify missing or truncated content is blocked: ${JSON.stringify(response)}`, () => {
    assert.throws(() => adaptProviderCollectionPage({ row: row(), response }), (error) => error.collectionBlocked === true);
  });
}

for (const cursor of ['https://evil.example/v1/playlists/playlist/items?offset=10', 'https://api.spotify.com/v1/playlists/other/items?offset=10',
  'https://api.spotify.com/v1/playlists/playlist/items?offset=0', 'https://api.spotify.com/v1/playlists/playlist/items?offset=1junk',
  'https://api.spotify.com/v1/playlists/playlist/items?offset=1&offset=2', 'https://api.spotify.com/v1/playlists/playlist/items?offset=9007199254740992']) {
  test(`collection cursor rejects an invalid or unsafe destination: ${cursor}`, () => {
    assert.throws(() => parseCollectionNextCursor({ row: row(), value: cursor }), (error) => error.collectionBlocked === true);
  });
}

test('a Spotify playlist page is bracketed by version checks and cannot cross a changed snapshot', async () => {
  const calls = [];
  let version = 'v1';
  const clients = { spotify: {
    getPlaylistSnapshot: async () => { calls.push('snapshot'); return { id: 'playlist', snapshot_id: version }; },
    getPlaylistItems: async () => { calls.push('items'); version = 'v2'; return { items: [] }; },
  } };
  await assert.rejects(fetchProviderCollectionWork({ row: row(), collection: { providerSnapshot: 'v1' }, clients,
    assertActive: async () => {} }), { code: 'provider_collection_snapshot_changed' });
  assert.deepEqual(calls, ['snapshot', 'items', 'snapshot']);
});

test('Apple relationship fetch uses the URL storefront and never follows an arbitrary URL', async () => {
  const calls = [];
  const response = { data: [] };
  const fetched = await fetchProviderCollectionWork({ row: row({ sourceProvider: 'apple_music', pageCursor: '100' }),
    collection: { storefront: 'gb' }, assertActive: async () => {},
    clients: { appleMusic: { getCatalogPlaylistTracks: async (...args) => { calls.push(args); return response; } } },
  });
  assert.deepEqual(calls, [['gb', 'playlist', { offset: 100, limit: 100 }]]);
  assert.equal(fetched.response, response);
});
