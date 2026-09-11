import assert from 'node:assert/strict';
import test from 'node:test';
import { createProviderCollectionAccessCheckService } from '../../src/server/integrations/providers/provider-collection-access-check-service.js';
import { createSpotifyClient } from '../../src/server/integrations/spotify/spotify-client.js';
import { createProviderRequestError } from '../../src/server/integrations/providers/provider-request-error.js';

const sourceUrl = 'https://open.spotify.com/playlist/playlist';
const now = () => new Date('2026-09-11T12:00:00Z');
const page = (offset, next, total = 2) => ({ offset, total, next, items: [{ item: { id: `track${offset}`, type: 'track',
  album: { id: `album${offset}`, name: 'Private album title', artists: [{ name: 'Private artist' }] } } }] });

function spotifyFixture({ pages, snapshot = 'version', maxPages = 2 } = {}) {
  const calls = [];
  const service = createProviderCollectionAccessCheckService({ getNow: now, maxPages,
    resolveProviderClient: async () => ({ enabled: true, configured: true, authMode: 'oauth_user', client: {
      getPlaylistSnapshot: async () => { calls.push('snapshot'); return { id: 'playlist', snapshot_id: snapshot }; },
      getPlaylistItems: async (_, { offset }) => { calls.push(`page:${offset}`); return pages[offset]; },
      getAlbum: async () => assert.fail('Access checks must not fetch descendant albums'),
    } }),
  });
  return { calls, service };
}

test('two valid pages verify access and complete traversal without exposing source contents or fetching albums', async () => {
  const value = spotifyFixture({ pages: [page(0, 'https://api.spotify.com/v1/playlists/playlist/items?offset=1'), page(1, null)] });
  const result = await value.service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.outcome, 'verified');
  assert.equal(result.authMode, 'oauth_user');
  assert.equal(result.quotaMode, 'unknown');
  assert.equal(result.pagesChecked, 2);
  assert.equal(result.entriesSeen, 2);
  assert.equal(result.multiPageObserved, true);
  assert.equal(result.fullTraversal, true);
  assert.equal(result.hasMore, false);
  assert.equal(result.snapshotCheck, 'verified');
  assert.equal(value.calls.length, 6);
  assert.equal(JSON.stringify(result).includes('Private'), false);
  assert.equal(JSON.stringify(result).includes('https://'), false);
  assert.equal(Object.hasOwn(result, 'sourceIdentifier'), false);
});

test('an accessible collection that continues beyond two pages never claims complete traversal', async () => {
  const value = spotifyFixture({ pages: [page(0, 'https://api.spotify.com/v1/playlists/playlist/items?offset=1', 3), page(1, 'https://api.spotify.com/v1/playlists/playlist/items?offset=2', 3)] });
  const result = await value.service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.outcome, 'verified');
  assert.equal(result.fullTraversal, false);
  assert.equal(result.multiPageObserved, true);
  assert.equal(result.hasMore, true);
  assert.equal(value.calls.length, 6);
});

test('a valid single page does not manufacture multipage acceptance evidence', async () => {
  const value = spotifyFixture({ pages: [page(0, null, 1)] });
  const result = await value.service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.outcome, 'verified');
  assert.equal(result.fullTraversal, true);
  assert.equal(result.multiPageObserved, false);
});

test('Apple access checks preserve storefront and follow relationship pages without resolving album metadata', async () => {
  const calls = [];
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async ({ provider }) => {
    assert.equal(provider, 'apple_music');
    return { enabled: true, configured: true, authMode: 'developer_token', client: {
      getCatalogPlaylistTracks: async (storefront, id, { offset }) => {
        calls.push([storefront, id, offset]);
        return { data: [{ id: `song${offset}`, type: 'songs' }], ...(offset === 0 ? { next: '/v1/catalog/gb/playlists/pl.test/tracks?offset=1' } : {}) };
      },
      getCatalogSong: async () => assert.fail('A probe does not resolve descendant metadata'),
    } };
  } });
  const result = await service.checkCollectionAccess({ sourceUrl: 'https://music.apple.com/gb/playlist/example/pl.test' });
  assert.equal(result.fullTraversal, true);
  assert.equal(result.multiPageObserved, true);
  assert.equal(result.snapshotCheck, 'not_applicable');
  assert.deepEqual(calls, [['gb', 'pl.test', 0], ['gb', 'pl.test', 1]]);
});

test('YouTube access checks report readable membership without implying video acquisition', async () => {
  const calls = [];
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => ({ enabled: true, configured: true, authMode: 'api_key', client: {
    listPlaylistItems: async (_, { pageToken }) => {
      calls.push(pageToken);
      return { items: [{ id: pageToken ?? 'first', snippet: { resourceId: { videoId: 'video' }, title: 'Private title' } }],
        ...(pageToken ? {} : { nextPageToken: 'next-token' }) };
    },
    getVideos: async () => assert.fail('A probe does not resolve descendant videos'),
  } }) });
  const result = await service.checkCollectionAccess({ sourceUrl: 'https://www.youtube.com/playlist?list=playlist' });
  assert.equal(result.outcome, 'verified');
  assert.equal(result.fullTraversal, true);
  assert.equal(result.entriesSeen, 2);
  assert.deepEqual(calls, [null, 'next-token']);
  assert.equal(JSON.stringify(result).includes('Private'), false);
});

test('a Spotify snapshot mismatch reports failed evidence instead of a successful access check', async () => {
  let version = 0;
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => ({ enabled: true, configured: true, authMode: 'oauth_user', client: {
    getPlaylistSnapshot: async () => ({ id: 'playlist', snapshot_id: `v${version++}` }),
    getPlaylistItems: async () => page(0, null, 1),
  } }) });
  const result = await service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.code, 'source_changed');
  assert.equal(result.snapshotCheck, 'failed');
  assert.equal(result.outcome, 'failed');
  assert.equal(result.pagesChecked, 0);
});

test('configuration state remains not checked and never becomes an access success', async () => {
  for (const enabled of [true, false]) {
    const service = createProviderCollectionAccessCheckService({ getNow: now,
      resolveProviderClient: async () => ({ enabled, configured: false, authMode: 'none', client: null }),
    });
    const result = await service.checkCollectionAccess({ sourceUrl });
    assert.equal(result.outcome, 'not_checked');
    assert.equal(result.pagesChecked, 0);
    assert.equal(result.fullTraversal, false);
    assert.equal(result.code, enabled ? 'configuration_required' : 'disabled');
  }
});

test('credential refresh failures retain authentication mode and expose no upstream error details', async () => {
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => {
    throw Object.assign(createProviderRequestError('spotify', 'credentials_rejected'), { providerAuthMode: 'oauth_user', message: 'PRIVATE-TOKEN', upstream: 'PRIVATE-TOKEN' });
  } });
  const result = await service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.authMode, 'oauth_user');
  assert.equal(result.code, 'credentials_rejected');
  assert.equal(JSON.stringify(result).includes('PRIVATE-TOKEN'), false);
});

test('known quota failures retain a distinct actionable diagnostic outcome', async () => {
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => {
    throw createProviderRequestError('spotify', 'quota_exceeded', { retryAfterSeconds: 600 });
  } });
  const result = await service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.code, 'quota_exceeded');
  assert.equal(result.retryAfterSeconds, 600);
  assert.match(result.nextAction, /quota/);
  assert.equal(result.quotaMode, 'unknown');
});

test('oversized membership arrays cannot create unbounded verified evidence', async () => {
  const response = page(0, null, 101);
  response.items = Array.from({ length: 101 }, () => response.items[0]);
  const value = spotifyFixture({ pages: [response] });
  const result = await value.service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.code, 'response_invalid');
  assert.equal(result.outcome, 'failed');
  assert.equal(result.entriesSeen, 0);
});

test('absolute check deadline includes provider resolution', async () => {
  const service = createProviderCollectionAccessCheckService({ deadlineMs: 10, resolveProviderClient: async () => new Promise(() => {}) });
  const result = await service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.code, 'timeout');
  assert.equal(result.pagesChecked, 0);
});

test('the HTTP budget includes Spotify client credential token exchange', async () => {
  const calls = [];
  const service = createProviderCollectionAccessCheckService({ maxRequests: 1,
    resolveProviderClient: async ({ requestPolicy }) => ({ enabled: true, configured: true, authMode: 'client_credentials', client: createSpotifyClient({
      requestPolicy, clientId: 'client', clientSecret: 'PRIVATE-SECRET', fetchFn: async (url) => {
        calls.push(url);
        assert.equal(new URL(url).pathname, '/api/token');
        return new Response(JSON.stringify({ access_token: 'PRIVATE-TOKEN', expires_in: 3600 }));
      },
    }) }),
  });
  const result = await service.checkCollectionAccess({ sourceUrl });
  assert.equal(result.code, 'request_budget_exceeded');
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('concurrent checks are rejected before resolving another provider', async () => {
  let finish;
  const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => new Promise((resolve) => { finish = resolve; }) });
  const first = service.checkCollectionAccess({ sourceUrl });
  await assert.rejects(service.checkCollectionAccess({ sourceUrl }), { code: 'provider_diagnostic_busy', status: 409 });
  finish({ enabled: false, configured: false, authMode: 'none' });
  assert.equal((await first).outcome, 'not_checked');
});

for (const invalid of ['https://untrusted.example/playlist/test', 'https://open.spotify.com/album/test', 'https://secret@open.spotify.com/playlist/test', '', null]) {
  test(`unsupported diagnostic source does not resolve credentials: ${invalid}`, async () => {
    const service = createProviderCollectionAccessCheckService({ resolveProviderClient: async () => assert.fail('No provider should be resolved') });
    await assert.rejects(service.checkCollectionAccess({ sourceUrl: invalid }), { status: 400 });
  });
}
