/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useArtworkBatchResolve } from '../../src/client/composables/useArtworkBatchResolve.js';

function createMockBatchFn(resolvedMap = {}) {
  return async (requests) => ({ resolved: resolvedMap });
}

test('useArtworkBatchResolve resolves artwork and populates artworkMap', async () => {
  const resolvedMap = {
    'musicbrainz_release:mbid-1:cover_front': {
      url: '/api/v1/artwork/assets/asset-1/file',
      assetId: 'asset-1',
      dominantColor: { hue: 180, chroma: 0.25, lightness: 0.55 },
      cached: false,
      sourceProvider: 'coverArtArchive',
    },
  };

  const { getResolved, isResolving, resolve } = useArtworkBatchResolve({
    batchResolveFn: createMockBatchFn(resolvedMap),
  });

  assert.equal(isResolving.value, false);
  assert.equal(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'), null);

  await resolve([
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-1', artworkRole: 'cover_front' },
  ]);

  assert.equal(isResolving.value, false);
  const result = getResolved('musicbrainz_release', 'mbid-1', 'cover_front');
  assert.equal(result.url, '/api/v1/artwork/assets/asset-1/file');
  assert.equal(result.assetId, 'asset-1');
  assert.deepEqual(result.dominantColor, { hue: 180, chroma: 0.25, lightness: 0.55 });
});

test('useArtworkBatchResolve returns null for unresolved keys', async () => {
  const { getResolved, resolve } = useArtworkBatchResolve({
    batchResolveFn: createMockBatchFn({}),
  });

  await resolve([
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-1', artworkRole: 'cover_front' },
  ]);

  assert.equal(getResolved('musicbrainz_artist', 'mbid-2', 'artist_thumbnail'), null);
});

test('useArtworkBatchResolve defaults artworkRole to cover_front in getResolved', async () => {
  const resolvedMap = {
    'musicbrainz_release:mbid-1:cover_front': {
      url: '/api/v1/artwork/assets/asset-1/file',
      assetId: 'asset-1',
      dominantColor: null,
      cached: true,
      sourceProvider: 'coverArtArchive',
    },
  };

  const { getResolved, resolve } = useArtworkBatchResolve({
    batchResolveFn: createMockBatchFn(resolvedMap),
  });

  await resolve([
    { ownerType: 'musicbrainz_release', ownerId: 'mbid-1' },
  ]);

  assert.equal(getResolved('musicbrainz_release', 'mbid-1')?.url, '/api/v1/artwork/assets/asset-1/file');
});

test('useArtworkBatchResolve merges results from multiple batches', async () => {
  let callCount = 0;
  const batchFn = async (batch) => {
    callCount++;
    const resolved = {};
    for (const r of batch) {
      const key = `${r.ownerType}:${r.ownerId}:${r.artworkRole ?? 'cover_front'}`;
      resolved[key] = { url: `/api/v1/artwork/assets/asset-${callCount}/file`, assetId: `asset-${callCount}`, dominantColor: null, cached: false, sourceProvider: null };
    }
    return { resolved };
  };

  const { getResolved, resolve } = useArtworkBatchResolve({ batchResolveFn: batchFn });

  const requests = Array.from({ length: 60 }, (_, i) => ({
    ownerType: 'musicbrainz_release',
    ownerId: `mbid-${i}`,
    artworkRole: 'cover_front',
  }));

  await resolve(requests);

  assert.equal(callCount, 2);
  assert.equal(getResolved('musicbrainz_release', 'mbid-0', 'cover_front')?.assetId, 'asset-1');
  assert.equal(getResolved('musicbrainz_release', 'mbid-59', 'cover_front')?.assetId, 'asset-2');
});

test('useArtworkBatchResolve clears artwork map', async () => {
  const resolvedMap = {
    'musicbrainz_release:mbid-1:cover_front': {
      url: '/api/v1/artwork/assets/asset-1/file',
      assetId: 'asset-1',
      dominantColor: null,
      cached: false,
      sourceProvider: null,
    },
  };

  const { getResolved, clear, resolve } = useArtworkBatchResolve({
    batchResolveFn: createMockBatchFn(resolvedMap),
  });

  await resolve([{ ownerType: 'musicbrainz_release', ownerId: 'mbid-1', artworkRole: 'cover_front' }]);
  assert.ok(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'));

  clear();
  assert.equal(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'), null);
});

test('useArtworkBatchResolve handles empty requests array', async () => {
  const batchFn = async () => ({ resolved: {} });
  const { artworkMap, resolve } = useArtworkBatchResolve({ batchResolveFn: batchFn });

  await resolve([]);
  assert.deepEqual(artworkMap.value, {});
});

test('useArtworkBatchResolve handles API failure gracefully', async () => {
  const failingFn = async () => { throw new Error('network error'); };
  const { getResolved, resolve } = useArtworkBatchResolve({ batchResolveFn: failingFn });

  await resolve([{ ownerType: 'musicbrainz_release', ownerId: 'mbid-1', artworkRole: 'cover_front' }]);
  assert.equal(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'), null);
});

test('useArtworkBatchResolve preserves existing data on subsequent failure', async () => {
  let callCount = 0;
  const batchFn = async () => {
    callCount++;
    if (callCount === 1) {
      return {
        resolved: {
          'musicbrainz_release:mbid-1:cover_front': {
            url: '/api/v1/artwork/assets/asset-1/file',
            assetId: 'asset-1',
            dominantColor: null,
            cached: false,
            sourceProvider: null,
          },
        },
      };
    }
    throw new Error('network error');
  };

  const { getResolved, resolve } = useArtworkBatchResolve({ batchResolveFn: batchFn });

  await resolve([{ ownerType: 'musicbrainz_release', ownerId: 'mbid-1', artworkRole: 'cover_front' }]);
  assert.ok(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'));

  await resolve([{ ownerType: 'musicbrainz_release', ownerId: 'mbid-2', artworkRole: 'cover_front' }]);
  assert.ok(getResolved('musicbrainz_release', 'mbid-1', 'cover_front'), 'previous data preserved');
  assert.equal(getResolved('musicbrainz_release', 'mbid-2', 'cover_front'), null);
});

test('overlapping artwork calls retain pending state until every current call completes', async () => {
  const finish = [];
  const artwork = useArtworkBatchResolve({ batchResolveFn: () => new Promise((resolve) => { finish.push(resolve); }) });
  const first = artwork.resolve([{}]);
  const second = artwork.resolve([{}]);
  await new Promise((resolve) => { setImmediate(resolve); });
  finish[0]({ resolved: { first: true } });
  await first;
  assert.equal(artwork.isResolving.value, true);
  assert.deepEqual(artwork.artworkMap.value, { first: true });
  finish[1]({ resolved: { second: true } });
  await second;
  assert.equal(artwork.isResolving.value, false);
  assert.deepEqual(artwork.artworkMap.value, { first: true, second: true });
});

test('clear invalidates old artwork and its finalizer without disturbing a new resolution', async () => {
  const finish = [];
  const artwork = useArtworkBatchResolve({ batchResolveFn: () => new Promise((resolve) => { finish.push(resolve); }) });
  const old = artwork.resolve([{}]);
  await new Promise((resolve) => { setImmediate(resolve); });
  artwork.clear();
  const current = artwork.resolve([{}]);
  await new Promise((resolve) => { setImmediate(resolve); });
  finish[0]({ resolved: { stale: true } });
  await old;
  assert.equal(artwork.isResolving.value, true);
  assert.deepEqual(artwork.artworkMap.value, {});
  finish[1]({ resolved: { current: true } });
  await current;
  assert.deepEqual(artwork.artworkMap.value, { current: true });
  assert.equal(artwork.isResolving.value, false);
});

test('artwork composable keeps successful sibling batch results on partial failure', async () => {
  const artwork = useArtworkBatchResolve({ batchResolveFn: async (batch) => {
    if (batch[0] === 0) throw new Error('Failed first batch');
    return { resolved: { retained: { url: 'cover' } } };
  } });
  await artwork.resolve(Array.from({ length: 51 }, (_, index) => index));
  assert.deepEqual(artwork.artworkMap.value, { retained: { url: 'cover' } });
  assert.equal(artwork.isResolving.value, false);
});

test('disposed artwork composable rejects late resolve calls without repopulating state', async () => {
  let calls = 0;
  const scope = effectScope();
  const artwork = scope.run(() => useArtworkBatchResolve({ batchResolveFn: async () => {
    calls += 1;
    return { resolved: { cover: { url: 'cover' } } };
  } }));
  await artwork.resolve([{}]);
  assert.equal(calls, 1);
  scope.stop();
  assert.deepEqual(artwork.artworkMap.value, {});
  await artwork.resolve([{}]);
  assert.equal(calls, 1);
  assert.deepEqual(artwork.artworkMap.value, {});
  assert.equal(artwork.isResolving.value, false);
});
