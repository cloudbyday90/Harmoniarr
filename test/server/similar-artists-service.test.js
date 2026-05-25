import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSimilarArtistsCache,
  computeGenreOverlapBonus,
  createSimilarArtistsService,
  extractMbGenreSignals,
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

function createTestLastFmClient(getSimilarArtistsImpl) {
  return {
    getSimilarArtists: getSimilarArtistsImpl,
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

test('createSimilarArtistsService clamps NaN limit to default', async () => {
  const lbClient = createTestListenBrainzClient(async () =>
    Array.from({ length: 30 }, (_, i) => ({
      mbid: `mb-${i}`,
      name: `Artist ${i}`,
      score: 1 - i * 0.02,
    })),
  );
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));
  const service = createSimilarArtistsService({ listenBrainzClient: lbClient, musicBrainzClient: mbClient });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid', limit: Number.NaN });

  assert.equal(result.similar.length, 20);
});

test('createSimilarArtistsService clamps limit exceeding max to 100', async () => {
  const lbClient = createTestListenBrainzClient(async () =>
    Array.from({ length: 50 }, (_, i) => ({
      mbid: `mb-${i}`,
      name: `Artist ${i}`,
      score: 1 - i * 0.01,
    })),
  );
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));
  const service = createSimilarArtistsService({ listenBrainzClient: lbClient, musicBrainzClient: mbClient });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid', limit: 999 });

  assert.equal(result.similar.length, 50);
});

// ---------------------------------------------------------------------------
// mergeSimilarArtists with Last.fm source
// ---------------------------------------------------------------------------

test('mergeSimilarArtists includes Last.fm artists', () => {
  const lastfmArtists = [
    { mbid: 'mb-lf-1', name: 'Last.fm Artist', score: 0.85 },
  ];

  const result = mergeSimilarArtists([], [], { limit: 20 }, lastfmArtists);

  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'lastfm');
  assert.equal(result[0].score, 0.85);
});

test('mergeSimilarArtists deduplicates Last.fm with other sources', () => {
  const lbArtists = [{ mbid: 'mb-shared', name: 'Shared', score: 0.9 }];
  const lastfmArtists = [{ mbid: 'mb-shared', name: 'Shared', score: 0.7 }];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 }, lastfmArtists);

  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'both');
  assert.equal(result[0].score, 0.9);
});

test('mergeSimilarArtists takes higher score from Last.fm when it wins', () => {
  const mbArtists = [{ mbid: 'mb-shared', name: 'Shared', score: 0.3 }];
  const lastfmArtists = [{ mbid: 'mb-shared', name: 'Shared', score: 0.8 }];

  const result = mergeSimilarArtists([], mbArtists, { limit: 20 }, lastfmArtists);

  assert.equal(result[0].score, 0.8);
  assert.equal(result[0].source, 'both');
});

test('mergeSimilarArtists works with all three sources', () => {
  const lbArtists = [{ mbid: 'mb-1', name: 'LB', score: 0.95 }];
  const mbArtists = [{ mbid: 'mb-2', name: 'MB', score: 0.7 }];
  const lastfmArtists = [{ mbid: 'mb-3', name: 'LF', score: 0.6 }];

  const result = mergeSimilarArtists(lbArtists, mbArtists, { limit: 20 }, lastfmArtists);

  assert.equal(result.length, 3);
  assert.equal(result[0].id, 'mb-1');
  assert.equal(result[1].id, 'mb-2');
  assert.equal(result[2].id, 'mb-3');
});

test('mergeSimilarArtists backward-compatible without lastfm parameter', () => {
  const lbArtists = [{ mbid: 'mb-1', name: 'LB', score: 0.9 }];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 });

  assert.equal(result.length, 1);
  assert.equal(result[0].source, 'listenbrainz');
});

// ---------------------------------------------------------------------------
// createSimilarArtistsService with Last.fm
// ---------------------------------------------------------------------------

test('createSimilarArtistsService merges all three sources', async () => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'mb-lb', name: 'LB Artist', score: 0.9 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => ({
    relations: [
      { type: 'similar artist', artist: { id: 'mb-mb', name: 'MB Artist' } },
    ],
  }));
  const lastFmClient = createTestLastFmClient(async () => [
    { mbid: 'mb-lf', name: 'Last.fm Artist', score: 0.75 },
  ]);

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  const ids = result.similar.map((a) => a.id);
  assert.ok(ids.includes('mb-lb'));
  assert.ok(ids.includes('mb-mb'));
  assert.ok(ids.includes('mb-lf'));
});

test('createSimilarArtistsService continues when Last.fm fails', async () => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'mb-lb', name: 'LB Artist', score: 0.9 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));
  const lastFmClient = createTestLastFmClient(async () => {
    throw Object.assign(new Error('Last.fm down'), { code: 'lastfm_unavailable' });
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 1);
  assert.equal(result.similar[0].source, 'listenbrainz');
});

test('createSimilarArtistsService returns Last.fm results when other sources are empty', async () => {
  const lbClient = createTestListenBrainzClient(async () => []);
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));
  const lastFmClient = createTestLastFmClient(async () => [
    { mbid: 'mb-lf-1', name: 'LF Artist 1', score: 0.8 },
    { mbid: 'mb-lf-2', name: 'LF Artist 2', score: 0.5 },
  ]);

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 2);
  assert.equal(result.similar[0].source, 'lastfm');
  assert.equal(result.similar[1].source, 'lastfm');
});

test('createSimilarArtistsService retries Last.fm with artist name when MBID returns empty', async () => {
  const lbClient = createTestListenBrainzClient(async () => []);
  const mbClient = createTestMusicBrainzClient(async () => ({
    name: 'Micah Tyler',
    relations: [],
  }));

  let callCount = 0;
  const lastFmClient = createTestLastFmClient(async (params) => {
    callCount += 1;
    if (params.mbid) {
      return [];
    }
    return [
      { mbid: 'mb-lf-name', name: 'Name Match Artist', score: 0.75 },
    ];
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(callCount, 2, 'Last.fm should be called twice (MBID then name)');
  assert.equal(result.similar.length, 1);
  assert.equal(result.similar[0].name, 'Name Match Artist');
  assert.equal(result.similar[0].source, 'lastfm');
});

test('createSimilarArtistsService skips name fallback when MB returns no name', async () => {
  const lbClient = createTestListenBrainzClient(async () => []);
  const mbClient = createTestMusicBrainzClient(async () => ({ relations: [] }));
  let lastfmCallCount = 0;
  const lastFmClient = createTestLastFmClient(async () => {
    lastfmCallCount += 1;
    return [];
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(lastfmCallCount, 1, 'only MBID call, no name fallback');
});

test('createSimilarArtistsService name fallback failure is non-fatal', async () => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'mb-lb', name: 'LB Artist', score: 0.9 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => ({
    name: 'Micah Tyler',
    relations: [],
  }));
  let callCount = 0;
  const lastFmClient = createTestLastFmClient(async () => {
    callCount += 1;
    if (callCount === 1) return [];
    throw Object.assign(new Error('Last.fm down'), { code: 'lastfm_unavailable' });
  });

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });

  assert.equal(result.similar.length, 1);
  assert.equal(result.similar[0].source, 'listenbrainz');
});

// ---------------------------------------------------------------------------
// Expanded MusicBrainz relationship weights
// ---------------------------------------------------------------------------

test('extractMbRelatedArtists maps "is person" at weight 0.9', () => {
  const relations = [
    { type: 'is person', artist: { id: 'mb-persona', name: 'Alternate Persona' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.9);
});

test('extractMbRelatedArtists maps "artist rename" at weight 0.85', () => {
  const relations = [
    { type: 'artist rename', artist: { id: 'mb-renamed', name: 'Renamed Project' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.85);
});

test('extractMbRelatedArtists maps "subgroup" at weight 0.6', () => {
  const relations = [
    { type: 'subgroup', artist: { id: 'mb-sub', name: 'Subgroup' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.6);
});

test('extractMbRelatedArtists maps "supporting musician" at weight 0.5', () => {
  const relations = [
    { type: 'supporting musician', artist: { id: 'mb-supp', name: 'Supporting Artist' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.5);
});

test('extractMbRelatedArtists maps "founder" at weight 0.5', () => {
  const relations = [
    { type: 'founder', artist: { id: 'mb-founder', name: 'Founder' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.5);
});

test('extractMbRelatedArtists maps "vocal supporting musician" at weight 0.5', () => {
  const relations = [
    { type: 'vocal supporting musician', artist: { id: 'mb-vocal', name: 'Vocal Support' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.5);
});

test('extractMbRelatedArtists maps "instrumental supporting musician" at weight 0.45', () => {
  const relations = [
    { type: 'instrumental supporting musician', artist: { id: 'mb-inst', name: 'Instrumental Support' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.45);
});

test('extractMbRelatedArtists maps "conductor position" at weight 0.3', () => {
  const relations = [
    { type: 'conductor position', artist: { id: 'mb-cond', name: 'Conductor' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.3);
});

test('extractMbRelatedArtists maps "tribute" at weight 0.2', () => {
  const relations = [
    { type: 'tribute', artist: { id: 'mb-trib', name: 'Tribute Band' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.2);
});

test('extractMbRelatedArtists maps "married" at weight 0.15', () => {
  const relations = [
    { type: 'married', artist: { id: 'mb-spouse', name: 'Spouse' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.15);
});

test('extractMbRelatedArtists maps "sibling" at weight 0.15', () => {
  const relations = [
    { type: 'sibling', artist: { id: 'mb-sib', name: 'Sibling' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.15);
});

test('extractMbRelatedArtists now includes "conductor position" which was previously skipped', () => {
  const relations = [
    { type: 'conductor position', artist: { id: 'mb-cond', name: 'Conductor' } },
    { type: 'similar artist', artist: { id: 'mb-sim', name: 'Similar' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 2);
  assert.equal(result[0].mbid, 'mb-cond');
  assert.equal(result[0].score, 0.3);
  assert.equal(result[1].mbid, 'mb-sim');
  assert.equal(result[1].score, 0.7);
});

test('extractMbRelatedArtists handles mix of mapped and unmapped relationship types', () => {
  const relations = [
    { type: 'similar artist', artist: { id: 'mb-1', name: 'Sim' } },
    { type: 'is person', artist: { id: 'mb-2', name: 'Persona' } },
    { type: 'teacher', artist: { id: 'mb-3', name: 'Teacher' } },
    { type: 'collaboration', artist: { id: 'mb-4', name: 'Collab' } },
    { type: 'voice actor', artist: { id: 'mb-5', name: 'Voice' } },
  ];

  const result = extractMbRelatedArtists(relations);

  assert.equal(result.length, 4);
  const byId = new Map(result.map((r) => [r.mbid, r]));
  assert.equal(byId.get('mb-1').score, 0.7);
  assert.equal(byId.get('mb-2').score, 0.9);
  assert.equal(byId.get('mb-4').score, 0.4);
  assert.equal(byId.get('mb-5').score, 0.1);
});

// ---------------------------------------------------------------------------
// extractMbGenreSignals
// ---------------------------------------------------------------------------

test('extractMbGenreSignals returns empty sets for null input', () => {
  const result = extractMbGenreSignals(null);
  assert.equal(result.genres.size, 0);
  assert.equal(result.tags.size, 0);
});

test('extractMbGenreSignals returns empty sets for undefined input', () => {
  const result = extractMbGenreSignals(undefined);
  assert.equal(result.genres.size, 0);
  assert.equal(result.tags.size, 0);
});

test('extractMbGenreSignals extracts genres from MB artist response', () => {
  const response = {
    name: 'Radiohead',
    genres: [
      { name: 'alternative rock', id: 'g1', count: 50 },
      { name: 'art rock', id: 'g2', count: 30 },
    ],
    tags: [
      { name: 'british', count: 10 },
    ],
  };

  const result = extractMbGenreSignals(response);
  assert.equal(result.genres.size, 2);
  assert.ok(result.genres.has('alternative rock'));
  assert.ok(result.genres.has('art rock'));
});

test('extractMbGenreSignals lowercases genre and tag names', () => {
  const response = {
    genres: [{ name: 'Alternative Rock', id: 'g1', count: 50 }],
    tags: [{ name: 'British', count: 10 }],
  };

  const result = extractMbGenreSignals(response);
  assert.ok(result.genres.has('alternative rock'));
  assert.ok(result.tags.has('british'));
});

test('extractMbGenreSignals skips empty genre and tag names', () => {
  const response = {
    genres: [{ name: '', id: 'g1', count: 0 }, { name: 'rock', id: 'g2', count: 5 }],
    tags: [{ name: '', count: 0 }, { name: 'indie', count: 3 }],
  };

  const result = extractMbGenreSignals(response);
  assert.equal(result.genres.size, 1);
  assert.ok(result.genres.has('rock'));
  assert.equal(result.tags.size, 1);
  assert.ok(result.tags.has('indie'));
});

test('extractMbGenreSignals returns empty sets when genres and tags are missing', () => {
  const response = { name: 'Unknown Artist' };
  const result = extractMbGenreSignals(response);
  assert.equal(result.genres.size, 0);
  assert.equal(result.tags.size, 0);
});

// ---------------------------------------------------------------------------
// computeGenreOverlapBonus
// ---------------------------------------------------------------------------

test('computeGenreOverlapBonus returns 0 when candidate has no genres or tags', () => {
  const seedGenres = new Set(['rock', 'alternative']);
  const result = computeGenreOverlapBonus(null, null, seedGenres, new Set());
  assert.equal(result, 0);
});

test('computeGenreOverlapBonus returns 0 when seed has no genres or tags', () => {
  const candidateGenres = new Set(['rock']);
  const result = computeGenreOverlapBonus(candidateGenres, new Set(), new Set(), new Set());
  assert.equal(result, 0);
});

test('computeGenreOverlapBonus adds bonus for each shared genre', () => {
  const seedGenres = new Set(['rock', 'alternative', 'electronic']);
  const candidateGenres = new Set(['rock', 'electronic', 'jazz']);
  const result = computeGenreOverlapBonus(candidateGenres, new Set(), seedGenres, new Set());
  assert.equal(result, 0.04 * 2);
});

test('computeGenreOverlapBonus adds bonus for shared tags at lower rate', () => {
  const seedTags = new Set(['british', '1990s']);
  const candidateTags = new Set(['british', '2020s']);
  const result = computeGenreOverlapBonus(new Set(), candidateTags, new Set(), seedTags);
  assert.equal(result, 0.02 * 1);
});

test('computeGenreOverlapBonus counts both genre and tag overlap', () => {
  const seedGenres = new Set(['rock']);
  const seedTags = new Set(['british']);
  const candidateGenres = new Set(['rock']);
  const candidateTags = new Set(['british']);
  const result = computeGenreOverlapBonus(candidateGenres, candidateTags, seedGenres, seedTags);
  assert.equal(result, 0.04 + 0.02);
});

test('computeGenreOverlapBonus returns empty sets gracefully', () => {
  const result = computeGenreOverlapBonus(new Set(), new Set(), new Set(), new Set());
  assert.equal(result, 0);
});

// ---------------------------------------------------------------------------
// mergeSimilarArtists with genre overlap bonus
// ---------------------------------------------------------------------------

test('mergeSimilarArtists applies genre overlap bonus via genreOverrides', () => {
  const lbArtists = [
    { mbid: 'mb-1', name: 'Shared Genre Artist', score: 0.5 },
  ];
  const seedGenres = new Set(['rock', 'electronic']);
  const candidateGenres = new Set(['rock']);
  const genreOverrides = new Map([
    ['mb-1', { genres: candidateGenres, tags: new Set() }],
  ]);

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 }, [], { seedGenres, genreOverrides });

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.5 + 0.04);
});

test('mergeSimilarArtists genre overlap bonus is additive across sources', () => {
  const mbArtists = [
    { mbid: 'mb-mb', name: 'MB Artist', score: 0.7 },
  ];
  const lastfmArtists = [
    { mbid: 'mb-lf', name: 'LF Artist', score: 0.6 },
  ];
  const seedGenres = new Set(['rock']);
  const genreOverrides = new Map([
    ['mb-mb', { genres: new Set(['rock']), tags: new Set() }],
    ['mb-lf', { genres: new Set(['rock']), tags: new Set() }],
  ]);

  const result = mergeSimilarArtists([], mbArtists, { limit: 20 }, lastfmArtists, { seedGenres, genreOverrides });

  assert.equal(result.length, 2);
  const mbEntry = result.find((r) => r.id === 'mb-mb');
  const lfEntry = result.find((r) => r.id === 'mb-lf');
  assert.equal(mbEntry.score, 0.7 + 0.04);
  assert.equal(lfEntry.score, 0.6 + 0.04);
});

test('mergeSimilarArtists without genreOverrides is backward-compatible', () => {
  const lbArtists = [{ mbid: 'mb-1', name: 'Artist A', score: 0.9 }];

  const result = mergeSimilarArtists(lbArtists, [], { limit: 20 });

  assert.equal(result.length, 1);
  assert.equal(result[0].score, 0.9);
  assert.equal(result[0].source, 'listenbrainz');
});

// ---------------------------------------------------------------------------
// createSimilarArtistsService with genre signals from MB response
// ---------------------------------------------------------------------------

test('createSimilarArtistsService extracts seed genres from MB response', async () => {
  const lbClient = createTestListenBrainzClient(async () => [
    { mbid: 'mb-lb', name: 'LB Artist', score: 0.9 },
  ]);
  const mbClient = createTestMusicBrainzClient(async () => ({
    name: 'Radiohead',
    genres: [
      { name: 'alternative rock', id: 'g1', count: 50 },
    ],
    relations: [
      { type: 'similar artist', artist: { id: 'mb-mb', name: 'MB Artist' } },
    ],
  }));

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });
  assert.ok(Array.isArray(result.similar));
  assert.ok(result.similar.length >= 1);
});

test('createSimilarArtistsService uses genre overlap from related artist data', async () => {
  const lbClient = createTestListenBrainzClient(async () => []);
  const mbClient = createTestMusicBrainzClient(async () => ({
    name: 'Radiohead',
    genres: [
      { name: 'alternative rock', id: 'g1', count: 50 },
      { name: 'art rock', id: 'g2', count: 30 },
    ],
    relations: [
      {
        type: 'similar artist',
        artist: {
          id: 'mb-mb',
          name: 'MB Artist with Genres',
          genres: [{ name: 'alternative rock', id: 'g3', count: 20 }],
          tags: [{ name: 'british', count: 5 }],
        },
      },
    ],
  }));
  const lastFmClient = createTestLastFmClient(async () => []);

  const service = createSimilarArtistsService({
    listenBrainzClient: lbClient,
    musicBrainzClient: mbClient,
    lastFmClient,
  });

  const result = await service.getSimilarArtists({ artistMbid: 'test-mbid' });
  const mbArtist = result.similar.find((a) => a.id === 'mb-mb');
  assert.ok(mbArtist, 'MB artist should be in results');
  assert.ok(mbArtist.score > 0.7, 'Score should include genre overlap bonus');
});
