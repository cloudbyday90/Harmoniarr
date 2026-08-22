import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicBrainzClient } from '../../src/server/integrations/musicbrainz/musicbrainz-client.js';

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
  return createMusicBrainzClient({
    allowedHosts: ['musicbrainz.test'],
    baseUrl: 'https://musicbrainz.test/ws/2',
    contactUrl: 'https://harmoniarr.test/contact',
    fetchImpl,
    maxRetries: 1,
    minIntervalMs: 1000,
    requestTimeoutMs: 1000,
    sleepImpl,
  });
}

function waitForNextTurn() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test('MusicBrainz client does not start an expired queued request', async (t) => {
  let resolveFirstRequest;
  const fetchImpl = t.mock.fn(() => new Promise((resolve) => {
    resolveFirstRequest = resolve;
  }));
  const client = createTestClient({ fetchImpl });

  const firstRequest = client.lookupArtistRelations({ artistId: 'artist-1' });
  await waitForNextTurn();
  assert.equal(fetchImpl.mock.callCount(), 1);

  const controller = new AbortController();
  const abortReason = new Error('related artists response budget exhausted');
  const expiredQueuedRequest = client.lookupArtistRelations({
    artistId: 'artist-2',
    signal: controller.signal,
  });
  controller.abort(abortReason);

  await assert.rejects(expiredQueuedRequest, (error) => error === abortReason);
  resolveFirstRequest(createJsonResponse({ relations: [] }));
  await firstRequest;
  await waitForNextTurn();

  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('MusicBrainz client does not retry a request cancelled by the response budget', async (t) => {
  let markRequestStarted;
  const requestStarted = new Promise((resolve) => {
    markRequestStarted = resolve;
  });
  const sleepImpl = t.mock.fn(async () => {});
  const fetchImpl = t.mock.fn((_, { signal }) => new Promise((resolve, reject) => {
    markRequestStarted();
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  const client = createTestClient({ fetchImpl, sleepImpl });
  const controller = new AbortController();
  const abortReason = new Error('related artists response budget exhausted');

  const request = client.lookupArtistRelations({ artistId: 'artist-1', signal: controller.signal });
  await requestStarted;
  controller.abort(abortReason);

  await assert.rejects(request, (error) => error === abortReason);
  assert.equal(fetchImpl.mock.callCount(), 1);
  assert.equal(sleepImpl.mock.callCount(), 0);
});

test('MusicBrainz client retries throttled responses using Retry-After metadata', async (t) => {
  const sleepDelays = [];
  let requestCount = 0;
  const fetchImpl = t.mock.fn(async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return createJsonResponse({ error: 'rate limited' }, {
        status: 503,
        headers: {
          'retry-after': '3',
        },
      });
    }

    return createJsonResponse({
      count: 1,
      offset: 0,
      artists: [{ id: 'mb-artist-1', name: 'Autechre' }],
    });
  });

  const client = createTestClient({
    fetchImpl,
    sleepImpl: async (delayMs) => {
      sleepDelays.push(delayMs);
    },
  });

  const payload = await client.searchArtists({ query: 'Autechre', limit: 1 });

  assert.equal(fetchImpl.mock.callCount(), 2);
  assert.deepEqual(sleepDelays, [3000]);
  assert.deepEqual(payload, {
    count: 1,
    offset: 0,
    artists: [{ id: 'mb-artist-1', name: 'Autechre' }],
  });

  const [url, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'https://musicbrainz.test/ws/2/artist?fmt=json&query=Autechre&limit=1&offset=0');
  assert.equal(options.headers.Accept, 'application/json');
  assert.equal(options.headers['User-Agent'], 'Harmoniarr/0.1.0-beta (https://harmoniarr.test/contact)');
  assert.equal(options.redirect, 'error');
});

test('MusicBrainz client exposes throttling details when retries are exhausted', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'rate limited' }, {
    status: 429,
    headers: {
      'retry-after': '2',
    },
  }));
  const client = createMusicBrainzClient({
    allowedHosts: ['musicbrainz.test'],
    baseUrl: 'https://musicbrainz.test/ws/2',
    contactEmail: 'ops@harmoniarr.test',
    fetchImpl,
    maxRetries: 0,
    minIntervalMs: 1000,
    requestTimeoutMs: 1000,
    sleepImpl: async () => {},
  });

  await assert.rejects(
    () => client.searchReleases({ query: 'release:"Amber"', limit: 1 }),
    (error) => {
      assert.equal(error.code, 'musicbrainz_unavailable');
      assert.equal(error.message, 'MusicBrainz release search request failed with status 429');
      assert.equal(error.details.attempts, 1);
      assert.equal(error.details.maxRetries, 0);
      assert.equal(error.details.retryable, true);
      assert.equal(error.details.retryAfterMs, 2000);
      assert.equal(error.details.status, 429);
      assert.equal(error.details.throttled, true);
      assert.equal(error.details.url, 'https://musicbrainz.test/ws/2/release?fmt=json&query=release%3A%22Amber%22&limit=1&offset=0');
      return true;
    },
  );
});

test('MusicBrainz client classifies non-retryable upstream failures as request failures', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'bad request' }, {
    status: 400,
  }));
  const client = createTestClient({ fetchImpl });

  await assert.rejects(
    () => client.lookupArtist({ artistId: 'bad-artist-id' }),
    (error) => {
      assert.equal(error.code, 'musicbrainz_request_failed');
      assert.equal(error.message, 'MusicBrainz artist lookup request failed with status 400');
      assert.equal(error.details.attempts, 1);
      assert.equal(error.details.maxRetries, 1);
      assert.equal(error.details.retryable, false);
      assert.equal(error.details.status, 400);
      assert.equal(error.details.throttled, false);
      assert.equal(error.details.url, 'https://musicbrainz.test/ws/2/artist/bad-artist-id?fmt=json&inc=aliases');
      return true;
    },
  );

  assert.equal(fetchImpl.mock.callCount(), 1);
});

test('MusicBrainz client rejects insecure or private override base URLs', async () => {
  assert.throws(
    () => createMusicBrainzClient({
      baseUrl: 'http://127.0.0.1:8080/ws/2',
      contactUrl: 'https://harmoniarr.test/contact',
      fetchImpl: async () => createJsonResponse({}),
    }),
    (error) => error?.code === 'musicbrainz_misconfigured'
      && error?.message === 'Invalid MusicBrainz base URL: http://127.0.0.1:8080/ws/2',
  );
});

test('MusicBrainz client falls back to the project contact when none is configured', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    count: 1,
    offset: 0,
    artists: [{ id: 'mb-artist-1', name: 'Autechre' }],
  }));
  const client = createMusicBrainzClient({
    allowedHosts: ['musicbrainz.test'],
    baseUrl: 'https://musicbrainz.test/ws/2',
    contactEmail: undefined,
    contactUrl: undefined,
    fetchImpl,
    maxRetries: 0,
    minIntervalMs: 1000,
    requestTimeoutMs: 1000,
    sleepImpl: async () => {},
  });

  await client.searchArtists({ query: 'Autechre', limit: 1 });

  const [, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(
    options.headers['User-Agent'],
    'Harmoniarr/0.1.0-beta (https://github.com/cloudbyday90/harmoniarr)',
  );
});
