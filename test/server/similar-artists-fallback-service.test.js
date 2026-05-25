import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMusicBrainzFallbackQueries,
  createSeedSignalProfile,
  createSimilarArtistsFallbackService,
  computeSignalOverlap,
  extractFallbackTagSignals,
  scoreMusicBrainzFallbackCandidate,
} from '../../src/server/metadata/similar-artists-fallback-service.js';

test('extractFallbackTagSignals prefers MusicBrainz tags and comment-derived hints', () => {
  const signals = extractFallbackTagSignals({
    disambiguation: 'Christian singer-songwriter',
    tags: [
      { name: 'ccm' },
      { name: 'contemporary christian' },
    ],
  });

  assert.deepEqual(signals.slice(0, 4), [
    { source: 'tag', tag: 'ccm', weight: 0.6 },
    { source: 'tag', tag: 'contemporary christian', weight: 0.6 },
    { source: 'comment', tag: 'christian', weight: 0.54 },
    { source: 'comment', tag: 'singer-songwriter', weight: 0.46 },
  ]);
});

test('buildMusicBrainzFallbackQueries uses tag, country, and type fields', () => {
  const queries = buildMusicBrainzFallbackQueries({
    country: 'US',
    disambiguation: 'Christian singer-songwriter',
    type: 'Person',
  });

  assert.deepEqual(queries, [
    {
      signal: { tags: ['christian', 'singer-songwriter'], weight: 0.66 },
      query: 'tag:"christian" AND tag:"singer-songwriter" AND country:us AND type:person',
    },
    {
      signal: { tags: ['christian'], weight: 0.54 },
      query: 'tag:"christian" AND country:us AND type:person',
    },
    {
      signal: { tags: ['singer-songwriter'], weight: 0.46 },
      query: 'tag:"singer-songwriter" AND country:us AND type:person',
    },
  ]);
});

test('scoreMusicBrainzFallbackCandidate rewards explicit tag matches', () => {
  const seedProfile = createSeedSignalProfile({
    disambiguation: 'Christian singer',
  });
  const score = scoreMusicBrainzFallbackCandidate({
    score: 96,
    tags: [
      { name: 'christian' },
    ],
  }, {
    tags: ['christian'],
    weight: 0.54,
  }, seedProfile);

  assert.ok(Math.abs(score - 0.5984) < 1e-9);
});

test('computeSignalOverlap detects shared christian/gospel tags', () => {
  const overlap = computeSignalOverlap(
    createSeedSignalProfile({
      genres: [{ name: 'gospel' }],
      tags: [{ name: 'christian' }],
    }),
    {
      tags: [{ name: 'christian' }, { name: 'gospel' }],
    },
  );

  assert.equal(overlap.count, 2);
  assert.equal(overlap.hasCandidateSignals, true);
});

test('createSimilarArtistsFallbackService searches MusicBrainz with derived Christian tag fallback', async (t) => {
  const searchArtists = t.mock.fn(async ({ query }) => {
    assert.equal(query, 'tag:"christian" AND country:us AND type:person');
    return {
      artists: [
        {
          id: 'artist-1',
          name: 'Michael W. Smith',
          score: 100,
          tags: [{ name: 'christian' }],
        },
        {
          id: 'artist-2',
          name: 'Steven Curtis Chapman',
          score: 97,
          tags: [{ name: 'christian' }],
        },
        {
          id: 'seed-mbid',
          name: 'Chris Rice',
          score: 100,
          tags: [{ name: 'christian' }],
        },
      ],
    };
  });

  const service = createSimilarArtistsFallbackService({
    musicBrainzClient: { searchArtists },
  });

  const results = await service.searchMusicBrainzFallbackArtists({
    artistMbid: 'seed-mbid',
    limit: 5,
    seedArtist: {
      country: 'US',
      disambiguation: 'Christian singer',
      type: 'Person',
    },
  });

  assert.deepEqual(results, [
    { mbid: 'artist-1', name: 'Michael W. Smith', score: 0.62 },
    { mbid: 'artist-2', name: 'Steven Curtis Chapman', score: 0.6038 },
  ]);
});

test('createSimilarArtistsFallbackService returns ListenBrainz radio fallback artists when available', async () => {
  const service = createSimilarArtistsFallbackService({
    listenBrainzClient: {
      getRadioSimilarArtists: async () => [
        { mbid: 'artist-1', name: 'Michael W. Smith', score: 0.8 },
      ],
    },
  });

  const results = await service.getListenBrainzRadioFallback({ artistMbid: 'seed-mbid', limit: 5 });

  assert.deepEqual(results, [
    { mbid: 'artist-1', name: 'Michael W. Smith', score: 0.8 },
  ]);
});

test('createSimilarArtistsFallbackService downranks ListenBrainz radio candidates with explicit metadata mismatch', async () => {
  const service = createSimilarArtistsFallbackService({
    listenBrainzClient: {
      getRadioSimilarArtists: async () => [
        { mbid: 'artist-1', name: 'P!nk', score: 0.8 },
        { mbid: 'artist-2', name: 'Phil Wickham', score: 0.72 },
      ],
    },
    musicBrainzClient: {
      lookupArtistRelations: async ({ artistId }) => {
        if (artistId === 'artist-1') {
          return { tags: [{ name: 'pop' }] };
        }

        return { tags: [{ name: 'christian' }, { name: 'gospel' }] };
      },
    },
  });

  const results = await service.getListenBrainzRadioFallback({
    artistMbid: 'seed-mbid',
    limit: 5,
    seedArtist: {
      tags: [{ name: 'christian' }, { name: 'gospel' }],
    },
  });

  assert.deepEqual(results, [
    { mbid: 'artist-2', name: 'Phil Wickham', score: 0.82 },
    { mbid: 'artist-1', name: 'P!nk', score: 0.34 },
  ]);
});
