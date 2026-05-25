import assert from 'node:assert/strict';
import test from 'node:test';
import { createListenBrainzClient } from '../../src/server/integrations/listenbrainz/listenbrainz-client.js';

function createJsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

function createTestClient({ fetchImpl, sleepImpl = async () => {} } = {}) {
  return createListenBrainzClient({
    allowedHosts: ['api.listenbrainz.test'],
    baseUrl: 'https://api.listenbrainz.test',
    fetchImpl,
    maxRetries: 1,
    minIntervalMs: 1000,
    requestTimeoutMs: 1000,
    sleepImpl,
  });
}

const SIMILAR_ARTISTS_RESPONSE = [
  { artist_mbid: 'mb-artist-1', artist_name: 'Boards of Canada', score: 0.95 },
  { artist_mbid: 'mb-artist-2', artist_name: 'Autechre', score: 0.82 },
];

test('ListenBrainz client returns similar artists for a valid MBID', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse(SIMILAR_ARTISTS_RESPONSE));
  const client = createTestClient({ fetchImpl });

  const result = await client.getSimilarArtists({ mbid: 'test-artist-mbid' });

  assert.equal(fetchImpl.mock.callCount(), 1);
  assert.deepEqual(result, [
    { mbid: 'mb-artist-1', name: 'Boards of Canada', score: 0.95 },
    { mbid: 'mb-artist-2', name: 'Autechre', score: 0.82 },
  ]);

  const [url] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'https://api.listenbrainz.test/1/popularity/similar-to-artist/test-artist-mbid');
});

test('ListenBrainz client normalises payload-wrapped response envelope', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    payload: SIMILAR_ARTISTS_RESPONSE,
  }));
  const client = createTestClient({ fetchImpl });

  const result = await client.getSimilarArtists({ mbid: 'test-artist-mbid' });

  assert.equal(result.length, 2);
  assert.equal(result[0].mbid, 'mb-artist-1');
  assert.equal(result[1].mbid, 'mb-artist-2');
});

test('ListenBrainz client returns empty array when endpoint responds with 404', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'not found' }, { status: 404 }));
  const client = createTestClient({ fetchImpl });

  const result = await client.getSimilarArtists({ mbid: 'unknown-mbid' });

  assert.deepEqual(result, []);
  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('ListenBrainz client filters out items missing artist_mbid', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse([
    { artist_mbid: 'mb-artist-1', artist_name: 'Valid Artist', score: 0.9 },
    { artist_name: 'No MBID Artist', score: 0.8 },
    { artist_mbid: '', artist_name: 'Empty MBID', score: 0.7 },
    { artist_mbid: 'mb-artist-4', score: 0.6 },
  ]));
  const client = createTestClient({ fetchImpl });

  const result = await client.getSimilarArtists({ mbid: 'test-mbid' });

  assert.equal(result.length, 2);
  assert.equal(result[0].mbid, 'mb-artist-1');
  assert.equal(result[1].mbid, 'mb-artist-4');
  assert.equal(result[1].name, null);
});

test('ListenBrainz client enforces limit parameter', async (t) => {
  const items = Array.from({ length: 20 }, (_, i) => ({
    artist_mbid: `mb-artist-${i}`,
    artist_name: `Artist ${i}`,
    score: 1 - i * 0.04,
  }));
  const fetchImpl = t.mock.fn(async () => createJsonResponse(items));
  const client = createTestClient({ fetchImpl });

  const result = await client.getSimilarArtists({ mbid: 'test-mbid', limit: 5 });

  assert.equal(result.length, 5);
  assert.equal(result[0].mbid, 'mb-artist-0');
});

test('ListenBrainz client retries on 503 and succeeds on second attempt', async (t) => {
  const sleepDelays = [];
  let requestCount = 0;
  const fetchImpl = t.mock.fn(async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return createJsonResponse({ error: 'service unavailable' }, { status: 503 });
    }

    return createJsonResponse(SIMILAR_ARTISTS_RESPONSE);
  });

  const client = createTestClient({
    fetchImpl,
    sleepImpl: async (delayMs) => {
      sleepDelays.push(delayMs);
    },
  });

  const result = await client.getSimilarArtists({ mbid: 'test-mbid' });

  assert.equal(fetchImpl.mock.callCount(), 2);
  assert.equal(sleepDelays.length, 1);
  assert.equal(result.length, 2);
});

test('ListenBrainz client throws listenbrainz_unavailable when retries exhausted on 503', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'service unavailable' }, { status: 503 }));
  const client = createTestClient({ fetchImpl, sleepImpl: async () => {} });

  await assert.rejects(
    () => client.getSimilarArtists({ mbid: 'test-mbid' }),
    (error) => {
      assert.equal(error.code, 'listenbrainz_unavailable');
      assert.equal(error.details.retryable, true);
      assert.equal(error.details.status, 503);
      return true;
    },
  );
  assert.equal(fetchImpl.mock.callCount(), 2); // initial + 1 retry
});

test('ListenBrainz client throws listenbrainz_request_failed for non-retryable errors', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'bad request' }, { status: 400 }));
  const client = createTestClient({ fetchImpl });

  await assert.rejects(
    () => client.getSimilarArtists({ mbid: 'test-mbid' }),
    (error) => {
      assert.equal(error.code, 'listenbrainz_request_failed');
      assert.equal(error.details.retryable, false);
      assert.equal(error.details.status, 400);
      assert.equal(error.details.throttled, false);
      return true;
    },
  );
});

test('ListenBrainz client throws listenbrainz_unavailable on 429 when retries exhausted', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse(
    { error: 'too many requests' },
    {
      status: 429,
      headers: { 'x-ratelimit-reset-in': '5' },
    },
  ));

  const client = createListenBrainzClient({
    allowedHosts: ['api.listenbrainz.test'],
    baseUrl: 'https://api.listenbrainz.test',
    fetchImpl,
    maxRetries: 0,
    minIntervalMs: 1000,
    requestTimeoutMs: 1000,
    sleepImpl: async () => {},
  });

  await assert.rejects(
    () => client.getSimilarArtists({ mbid: 'test-mbid' }),
    (error) => {
      assert.equal(error.code, 'listenbrainz_unavailable');
      assert.equal(error.details.throttled, true);
      assert.equal(error.details.status, 429);
      return true;
    },
  );
});

test('ListenBrainz client waits for rate-limit reset before next request after budget exhausted', async (t) => {
  const sleepDelays = [];
  let requestCount = 0;

  const fetchImpl = t.mock.fn(async () => {
    requestCount += 1;
    if (requestCount === 1) {
      // First response: budget is now exhausted, resets in 3 seconds
      return createJsonResponse(
        [{ artist_mbid: 'mb-a', artist_name: 'Artist A', score: 0.9 }],
        {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset-in': '3',
          },
        },
      );
    }

    return createJsonResponse([{ artist_mbid: 'mb-b', artist_name: 'Artist B', score: 0.8 }]);
  });

  const client = createListenBrainzClient({
    allowedHosts: ['api.listenbrainz.test'],
    baseUrl: 'https://api.listenbrainz.test',
    fetchImpl,
    maxRetries: 0,
    minIntervalMs: 100,
    requestTimeoutMs: 1000,
    sleepImpl: async (delayMs) => {
      sleepDelays.push(delayMs);
    },
  });

  // First call populates rate-limit reset state.
  await client.getSimilarArtists({ mbid: 'mb-artist-1' });

  // Second call should respect the rate-limit reset window (~3000 ms).
  await client.getSimilarArtists({ mbid: 'mb-artist-2' });

  assert.equal(fetchImpl.mock.callCount(), 2);
  // The second enqueue must have slept for at least the rate-limit reset window.
  const rateLimitSleep = sleepDelays.find((d) => d >= 2900);
  assert.ok(rateLimitSleep != null, `Expected a sleep of ~3000ms, got: ${JSON.stringify(sleepDelays)}`);
});

test('ListenBrainz client sends no Authorization header', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse([]));
  const client = createTestClient({ fetchImpl });

  await client.getSimilarArtists({ mbid: 'test-mbid' });

  const [, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(options.headers.Authorization, undefined);
});

test('ListenBrainz client returns radio-neighborhood similar artists', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    'seed-mbid': [
      { similar_artist_mbid: 'seed-mbid', similar_artist_name: 'Seed Artist', total_listen_count: 126 },
    ],
    'artist-1': [
      { similar_artist_mbid: 'artist-1', similar_artist_name: 'Michael W. Smith', total_listen_count: 4471 },
    ],
    'artist-2': [
      { similar_artist_mbid: 'artist-2', similar_artist_name: 'Caedmon’s Call', total_listen_count: 3584 },
    ],
  }));
  const client = createTestClient({ fetchImpl });

  const result = await client.getRadioSimilarArtists({ mbid: 'seed-mbid', limit: 5 });

  assert.equal(result.length, 2);
  assert.deepEqual(result[0], { mbid: 'artist-1', name: 'Michael W. Smith', score: 0.8 });
  assert.equal(result[1].mbid, 'artist-2');
  assert.equal(result[1].name, 'Caedmon’s Call');
  assert.ok(result[1].score > 0.79 && result[1].score < 0.791);

  const [url] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'https://api.listenbrainz.test/1/lb-radio/artist/seed-mbid?max_recordings_per_artist=1&max_similar_artists=5&mode=easy&pop_begin=0&pop_end=100');
});

test('ListenBrainz client returns empty radio-neighborhood list for invalid payloads', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse([]));
  const client = createTestClient({ fetchImpl });

  const result = await client.getRadioSimilarArtists({ mbid: 'seed-mbid' });

  assert.deepEqual(result, []);
});

test('ListenBrainz client throws listenbrainz_misconfigured for an invalid base URL', () => {
  assert.throws(
    () => createListenBrainzClient({
      allowedHosts: ['api.listenbrainz.test'],
      baseUrl: 'http://api.listenbrainz.test',
      fetchImpl: async () => {},
    }),
    (error) => {
      assert.equal(error.code, 'listenbrainz_misconfigured');
      return true;
    },
  );
});

test('ListenBrainz client throws listenbrainz_unavailable when network request fails and retries exhausted', async (t) => {
  const networkError = new Error('ECONNREFUSED');
  const fetchImpl = t.mock.fn(async () => {
    throw networkError;
  });

  const client = createTestClient({ fetchImpl, sleepImpl: async () => {} });

  await assert.rejects(
    () => client.getSimilarArtists({ mbid: 'test-mbid' }),
    (error) => {
      assert.equal(error.code, 'listenbrainz_unavailable');
      assert.equal(error.details.cause, networkError);
      assert.equal(error.details.retryable, true);
      return true;
    },
  );
});
