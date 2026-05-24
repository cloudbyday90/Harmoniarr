import assert from 'node:assert/strict';
import test from 'node:test';
import { createLastFmClient } from '../../src/server/integrations/lastfm/lastfm-client.js';

test('createLastFmClient returns no-op client when apiKey is not set', async () => {
  const client = createLastFmClient({ apiKey: '' });

  const result = await client.getSimilarArtists({ mbid: 'test-mbid' });

  assert.deepEqual(result, []);
});

test('createLastFmClient returns no-op client when apiKey is undefined', async () => {
  const client = createLastFmClient({ apiKey: undefined });

  const result = await client.getSimilarArtists({ mbid: 'test-mbid' });

  assert.deepEqual(result, []);
});

test('createLastFmClient returns no-op client by default (no env var)', async () => {
  const original = process.env.LASTFM_API_KEY;
  delete process.env.LASTFM_API_KEY;
  try {
    const client = createLastFmClient();
    const result = await client.getSimilarArtists({ mbid: 'test-mbid' });
    assert.deepEqual(result, []);
  } finally {
    if (original !== undefined) process.env.LASTFM_API_KEY = original;
  }
});

test('createLastFmClient getSimilarArtists returns empty when no mbid or artistName', async () => {
  const client = createLastFmClient({ apiKey: 'test-key' });

  const result = await client.getSimilarArtists({});

  assert.deepEqual(result, []);
});

test('createLastFmClient getSimilarArtists parses similar artists response', async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({
        similarartists: {
          artist: [
            { name: 'Artist A', mbid: 'mb-a', match: '0.95' },
            { name: 'Artist B', mbid: 'mb-b', match: '0.7' },
          ],
        },
      }),
    },
  ];

  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async () => responses.shift(),
  });

  const result = await client.getSimilarArtists({ mbid: 'seed-mbid' });

  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Artist A');
  assert.equal(result[0].mbid, 'mb-a');
  assert.equal(result[0].score, 0.95);
  assert.equal(result[1].name, 'Artist B');
  assert.equal(result[1].score, 0.7);
});

test('createLastFmClient getSimilarArtists handles missing mbid gracefully', async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({
        similarartists: {
          artist: [
            { name: 'No MBID Artist', match: '0.5' },
            { name: 'Has MBID', mbid: 'mb-valid', match: '0.8' },
          ],
        },
      }),
    },
  ];

  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async () => responses.shift(),
  });

  const result = await client.getSimilarArtists({ mbid: 'seed-mbid' });

  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'No MBID Artist');
  assert.equal(result[0].mbid, 'no mbid artist');
  assert.equal(result[1].mbid, 'mb-valid');
});

test('createLastFmClient getSimilarArtists returns empty on missing similarartists key', async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({ error: 6, message: 'Artist not found' }),
    },
  ];

  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async () => responses.shift(),
  });

  const result = await client.getSimilarArtists({ mbid: 'seed-mbid' });

  assert.deepEqual(result, []);
});

test('createLastFmClient getSimilarArtists clamps score to 0-1 range', async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({
        similarartists: {
          artist: [
            { name: 'High', mbid: 'mb-high', match: '2.5' },
            { name: 'Low', mbid: 'mb-low', match: '-0.3' },
            { name: 'NaN', mbid: 'mb-nan', match: 'notanumber' },
          ],
        },
      }),
    },
  ];

  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async () => responses.shift(),
  });

  const result = await client.getSimilarArtists({ mbid: 'seed-mbid' });

  assert.equal(result[0].score, 1);
  assert.equal(result[1].score, 0);
  assert.equal(result[2].score, 0);
});

test('createLastFmClient getSimilarArtists accepts artistName as fallback', async () => {
  const responses = [
    {
      ok: true,
      json: async () => ({
        similarartists: {
          artist: [
            { name: 'Similar', mbid: 'mb-s', match: '0.6' },
          ],
        },
      }),
    },
  ];

  const client = createLastFmClient({
    apiKey: 'test-key',
    fetchImpl: async () => responses.shift(),
  });

  const result = await client.getSimilarArtists({ artistName: 'Test Artist' });

  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Similar');
});

test('createLastFmClient getSimilarArtists returns empty on non-retryable error', async () => {
  const client = createLastFmClient({
    apiKey: 'test-key',
    maxRetries: 0,
    fetchImpl: async () => ({ ok: false, status: 403 }),
  });

  const result = await client.getSimilarArtists({ mbid: 'seed-mbid' });

  assert.deepEqual(result, []);
});

test('createLastFmClient throws lastfm_misconfigured for invalid base URL', () => {
  assert.throws(
    () => createLastFmClient({ apiKey: 'test-key', baseUrl: 'http://evil.com' }),
    (error) => error.code === 'lastfm_misconfigured',
  );
});
