import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSimilarArtistsCache,
  createSimilarArtistsService,
  extractMbRelatedArtists,
  mergeSimilarArtists,
} from '../../src/server/metadata/similar-artists-service.js';

// ---------------------------------------------------------------------------
// extractMbRelatedArtists
// ---------------------------------------------------------------------------

test('extractMbRelatedArtists returns empty array for non-array input', () => {
  assert.deepEqual(extractMbRelatedArtists(null), []);
  assert.deepEqual(extractMbRelatedArtists(undefined), []);
  assert.deepEqual(extractMbRelatedArtists('invalid'), []);
});

test('extractMbRelatedArtists maps "similar artist" relations at weight 0.7', () => {
  const relations = [
    {
      type: 'similar artist',
      artist: { id: 'mb-similar-1', name: 'Similar Artist' },
    },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].mbid, 'mb-similar-1');
  assert.equal(result[0].name, 'Similar Artist');
  assert.equal(result[0].score, 0.7);
});

test('extractMbRelatedArtists maps "influenced by" relations at weight 0.5', () => {
  const relations = [
    {
      type: 'influenced by',
      artist: { id: 'mb-influence-1', name: 'Influence Artist' },
    },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.5);
});

test('extractMbRelatedArtists maps "collaboration" and "member of band" at weight 0.4', () => {
  const relations = [
    { type: 'collaboration', artist: { id: 'mb-collab-1', name: 'Collaborator' } },
    { type: 'member of band', artist: { id: 'mb-member-1', name: 'Band Member' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 2);
  assert.equal(result[0].score, 0.4);
  assert.equal(result[1].score, 0.4);
});

test('extractMbRelatedArtists is case-insensitive for relation type', () => {
  const relations = [
    { type: 'Similar Artist', artist: { id: 'mb-1', name: 'Test' } },
    { type: 'INFLUENCED BY', artist: { id: 'mb-2', name: 'Test 2' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 2);
  assert.equal(result[0].score, 0.7);
  assert.equal(result[1].score, 0.5);
});

test('extractMbRelatedArtists skips relations with unknown types', () => {
  const relations = [
    { type: 'conductor', artist: { id: 'mb-1', name: 'Conductor' } },
    { type: 'similar artist', artist: { id: 'mb-2', name: 'Similar' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].mbid, 'mb-2');
});

test('extractMbRelatedArtists skips relations missing artist id', () => {
  const relations = [
    { type: 'similar artist', artist: { name: 'No ID' } },
    { type: 'similar artist', artist: null },
    { type: 'similar artist' },
    { type: 'similar artist', artist: { id: 'mb-valid', name: 'Valid' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].mbid, 'mb-valid');
});

// ---------------------------------------------------------------------------
// mergeSimilarArtists
// ---------------------------------------------------------------------------

test('mergeSimilarArtists returns ListenBrainz artists when MB list is empty', () => {
  const lbArtists = [
    { mbid: 'mb-1', name: 'Artist A', score: 0.9 },
    { mbid: 'mb-2', name: 'Artist B', score: 0.8 },
  ];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 });

  assert.equal(result.length, 2);
  assert.equal(result[0].source, 'listenbrainz');
  assert.equal(result[1].source, 'listenbrainz');
});

test('mergeSimilarArtists returns MusicBrainz artists when LB list is empty', () => {
  const mbArtists = [
    { mbid: 'mb-1', name: 'Artist A', score: 0.7 },
    { mbid: 'mb-2', name: 'Artist B', score: 0.5 },
  ];

  const result = mergeSimilarArtists([], mbArtists, { limit: 20 });

  assert.equal(result.length, 2);
  assert.equal(result[0].source, 'musicbrainz');
});

test('mergeSimilarArtists deduplicates by MBID and marks source as "both"', () => {
  const lbArtists = [{ mbid: 'mb-shared', name: 'Shared Artist', score: 0.85 }];
  const mbArtists = [{ mbid: 'mb-shared', name: 'Shared Artist', score: 0.7 }];

  const result = mergeSimilarArtists(lbArtists, mbArtists, { limit: 20 });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'mb-shared');
  assert.equal(result[0].source, 'both');
  // LB score (0.85) is higher than MB weight (0.7) — keep the higher.
  assert.equal(result[0].score, 0.85);
});

test('mergeSimilarArtists takes MB score when it is higher than LB score', () => {
  const lbArtists = [{ mbid: 'mb-shared', name: 'Shared Artist', score: 0.5 }];
  const mbArtists = [{ mbid: 'mb-shared', name: 'Shared Artist', score: 0.7 }];

  const result = mergeSimilarArtists(lbArtists, mbArtists, { limit: 20 });

  assert.equal(result[0].score, 0.7);
  assert.equal(result[0].source, 'both');
});

test('mergeSimilarArtists sorts results descending by score', () => {
  const lbArtists = [
    { mbid: 'mb-low', name: 'Low', score: 0.3 },
    { mbid: 'mb-high', name: 'High', score: 0.95 },
    { mbid: 'mb-mid', name: 'Mid', score: 0.6 },
  ];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 });

  assert.equal(result[0].id, 'mb-high');
  assert.equal(result[1].id, 'mb-mid');
  assert.equal(result[2].id, 'mb-low');
});

test('mergeSimilarArtists applies limit correctly', () => {
  const lbArtists = Array.from({ length: 30 }, (_, i) => ({
    mbid: `mb-${i}`,
    name: `Artist ${i}`,
    score: 1 - i * 0.03,
  }));

  const result = mergeSimilarArtists(lbArtists, [], { limit: 10 });

  assert.equal(result.length, 10);
  assert.equal(result[0].id, 'mb-0');
});

test('mergeSimilarArtists skips entries missing mbid', () => {
  const lbArtists = [
    { name: 'No MBID', score: 0.9 },
    { mbid: 'mb-valid', name: 'Valid', score: 0.8 },
  ];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'mb-valid');
});

// ---------------------------------------------------------------------------
// createSimilarArtistsCache
// ---------------------------------------------------------------------------

test('createSimilarArtistsCache stores and retrieves data', () => {
  const cache = createSimilarArtistsCache(60_000);
  const data = [{ id: 'mb-1', name: 'Artist', score: 0.9, source: 'listenbrainz' }];

  cache.set('test-mbid', data);

  assert.deepEqual(cache.get('test-mbid'), data);
});

test('createSimilarArtistsCache returns undefined for unknown key', () => {
  const cache = createSimilarArtistsCache(60_000);

  assert.equal(cache.get('unknown'), undefined);
});

test('createSimilarArtistsCache treats expired entries as missing', (t) => {
  // Use fake clock to control Date.now().
  let fakeNow = 1_000_000;
  t.mock.method(Date, 'now', () => fakeNow);

  const cache = createSimilarArtistsCache(5000); // 5 second TTL
  cache.set('test-mbid', [{ id: 'mb-1' }]);

  // Still within TTL.
  fakeNow += 4000;
  assert.ok(cache.get('test-mbid') !== undefined, 'Should be cached within TTL');

  // Past TTL.
  fakeNow += 2000;
  assert.equal(cache.get('test-mbid'), undefined, 'Should be expired after TTL');
});

// ---------------------------------------------------------------------------
// createSimilarArtistsService
// ---------------------------------------------------------------------------

function createTestListenBrainzClient(getSimilarArtistsImpl) {
  return {
    getSimilarArtists: getSimilarArtistsImpl,
  };
}

function createTestMusicBrainzClient(lookupArtistRelationsImpl) {
  return {
    lookupArtistRelations: lookupArtistRelationsImpl,
  };
}

test('createSimilarArtistsService merges and returns similar artists', async (t) => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'mb-lb-1', name: 'LB Artist', score: 0.9 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => ({
    relations: [
      { type: 'similar artist', artist: { id: 'mb-mb-1', name: 'MB Artist' } },
    ],
  }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.ok(Array.isArray(result.similar));
  const ids = result.similar.map((a) => a.id);
  assert.ok(ids.includes('mb-lb-1'));
  assert.ok(ids.includes('mb-mb-1'));
});

test('createSimilarArtistsService returns cached result on second call', async (t) => {
  let lbCallCount = 0;
  const lbClient = createTestListenBrainzClient(async () => {
    lbCallCount += 1;
    return [{ mbid: 'mb-1', name: 'Artist', score: 0.8 }];
  });
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  await service.getSimilarArtists({ artistMbid: 'test-mbid' });
  await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(lbCallCount, 1, 'LB client should only be called once per MBID');
});

test('createSimilarArtistsService caches separately per MBID', async (t) => {
  let lbCallCount = 0;
  const lbClient = createTestListenBrainzClient(async ({ mbid }) => {
    lbCallCount += 1;
    return [{ mbid: `result-for-${mbid}`, name: 'Artist', score: 0.8 }];
  });
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  await service.getSimilarArtists({ artistMbid: 'mbid-a' });
  await service.getSimilarArtists({ artistMbid: 'mbid-b' });
  await service.getSimilarArtists({ artistMbid: 'mbid-a' }); // should hit cache

  assert.equal(lbCallCount, 2);
});

test('createSimilarArtistsService returns empty similar list when both sources fail', async () => {
  const lbClient = createTestListenBrainzClient(async () => {
    throw Object.assign(new Error('LB down'), { code: 'listenbrainz_unavailable' });
  });
  const mbClient = createTestMusicBrainzClient(async () => {
    throw Object.assign(new Error('MB down'), { code: 'musicbrainz_unavailable' });
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.deepEqual(result.similar, []);
});

test('createSimilarArtistsService continues when only LB fails', async () => {
  const lbClient = createTestListenBrainzClient(async () => {
    throw Object.assign(new Error('LB down'), { code: 'listenbrainz_unavailable' });
  });
  const mbClient = createTestMusicBrainzClient(async () => ({
    relations: [
      { type: 'similar artist', artist: { id: 'mb-only', name: 'MB Only Artist' } },
    ],
  }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 1);
  assert.equal(result.similar[0].id, 'mb-only');
  assert.equal(result.similar[0].source, 'musicbrainz');
});

test('createSimilarArtistsService continues when only MB fails', async () => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'lb-only', name: 'LB Only Artist', score: 0.85 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => {
    throw Object.assign(new Error('MB down'), { code: 'musicbrainz_unavailable' });
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 1);
  assert.equal(result.similar[0].id, 'lb-only');
  assert.equal(result.similar[0].source, 'listenbrainz');
});

test('createSimilarArtistsService respects limit parameter', async () => {
  const lbClient = createTestListenBrainzClient(async () =>
    Array.from({ length: 30 }, (_, i) => ({
      mbid: `mb-${i}`,
      name: `Artist ${i}`,
      score: 1 - i * 0.03,
    })),
  );
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid', limit: 5 });

  assert.equal(result.similar.length, 5);
});

test('createSimilarArtistsService returns top 20 by default', async () => {
  const lbClient = createTestListenBrainzClient(async () =>
    Array.from({ length: 50 }, (_, i) => ({
      mbid: `mb-${i}`,
      name: `Artist ${i}`,
      score: 1 - i * 0.01,
    })),
  );
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 20);
});

test('createSimilarArtistsService accepts a custom cache implementation', async () => {
  const cacheStore = new Map();
  const customCache = {
    get: (key) => cacheStore.get(key),
    set: (key, value) => cacheStore.set(key, value),
  };

  let callCount = 0;
  const lbClient = createTestListenBrainzClient(async () => {
    callCount += 1;
    return [];
  });
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    cache: customCache,
  });

  await service.getSimilarArtists({ artistMbid: 'test-mbid' });
  await service.getSimilarArtists({ artistMbid: 'test-mbid' }); // hits custom cache

  assert.equal(callCount, 1);
});
