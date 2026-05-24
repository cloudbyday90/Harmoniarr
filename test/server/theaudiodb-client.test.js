import assert from 'node:assert/strict';
import test from 'node:test';
import { selectArtistImages, createTheAudioDbClient } from '../../src/server/integrations/theaudiodb/theaudiodb-client.js';

test('selectArtistImages extracts all non-empty image URLs from artist data', () => {
  const artist = {
    strArtistThumb: 'https://r2.theaudiodb.com/images/media/artist/thumb/abc.jpg',
    strArtistWideThumb: 'https://r2.theaudiodb.com/images/media/artist/widethumb/def.jpg',
    strArtistFanart: 'https://r2.theaudiodb.com/images/media/artist/fanart/ghi.jpg',
    strArtistFanart2: 'https://r2.theaudiodb.com/images/media/artist/fanart/jkl.jpg',
    strArtistFanart3: null,
    strArtistFanart4: '',
    strArtistLogo: 'https://r2.theaudiodb.com/images/media/artist/logo/mno.png',
    strArtistClearart: null,
    strArtistBanner: undefined,
    strArtistCutout: 'https://r2.theaudiodb.com/images/media/artist/cutout/pqr.png',
  };

  const images = selectArtistImages(artist);

  assert.equal(images.length, 6);
  assert.equal(images[0].imageType, 'artistthumb');
  assert.equal(images[0].url, 'https://r2.theaudiodb.com/images/media/artist/thumb/abc.jpg');
  assert.equal(images[1].imageType, 'artistwidethumb');
  assert.equal(images[2].imageType, 'artistfanart');
  assert.equal(images[3].imageType, 'artistfanart2');
  assert.equal(images[4].imageType, 'artistlogo');
  assert.equal(images[5].imageType, 'artistcutout');
});

test('selectArtistImages returns empty array for null input', () => {
  assert.deepEqual(selectArtistImages(null), []);
  assert.deepEqual(selectArtistImages(undefined), []);
  assert.deepEqual(selectArtistImages({}), []);
});

test('selectArtistImages skips whitespace-only URLs', () => {
  const artist = {
    strArtistThumb: '  ',
    strArtistLogo: 'https://example.com/logo.png',
  };

  const images = selectArtistImages(artist);
  assert.equal(images.length, 1);
  assert.equal(images[0].imageType, 'artistlogo');
});

test('createTheAudioDbClient fetchArtistImages returns parsed images for a valid artist', async (t) => {
  const responses = t.mock.fn(async (url) => ({
    ok: true,
    json: async () => ({
      artists: [{
        strArtistThumb: 'https://r2.theaudiodb.com/images/media/artist/thumb/test.jpg',
        strArtistFanart: 'https://r2.theaudiodb.com/images/media/artist/fanart/test.jpg',
        strArtistLogo: null,
      }],
    }),
  }));

  const client = createTheAudioDbClient({
    apiKey: 'test-key',
    fetchImpl: responses,
  });

  const images = await client.fetchArtistImages({ mbid: 'cc2c9c3c-b7bc-4b8b-84d8-4fbd8779e493' });

  assert.equal(images.length, 2);
  assert.equal(images[0].imageType, 'artistthumb');
  assert.equal(images[0].url, 'https://r2.theaudiodb.com/images/media/artist/thumb/test.jpg');
  assert.equal(images[1].imageType, 'artistfanart');

  const calledUrl = responses.mock.calls[0].arguments[0].toString();
  assert.ok(calledUrl.includes('test-key/artist-mb.php'));
  assert.ok(calledUrl.includes('i=cc2c9c3c-b7bc-4b8b-84d8-4fbd8779e493'));
});

test('createTheAudioDbClient fetchArtistImages returns empty array when artist is not found', async (t) => {
  const responses = t.mock.fn(async () => ({
    ok: true,
    json: async () => ({ artists: null }),
  }));

  const client = createTheAudioDbClient({ fetchImpl: responses });
  const images = await client.fetchArtistImages({ mbid: '00000000-0000-0000-0000-000000000000' });

  assert.deepEqual(images, []);
});

test('createTheAudioDbClient fetchArtistImages returns empty array for empty artists array', async (t) => {
  const responses = t.mock.fn(async () => ({
    ok: true,
    json: async () => ({ artists: [] }),
  }));

  const client = createTheAudioDbClient({ fetchImpl: responses });
  const images = await client.fetchArtistImages({ mbid: '00000000-0000-0000-0000-000000000000' });

  assert.deepEqual(images, []);
});

test('createTheAudioDbClient fetchArtistImages throws validation error for empty mbid', async () => {
  const client = createTheAudioDbClient();
  await assert.rejects(
    () => client.fetchArtistImages({ mbid: '' }),
    (error) => error.code === 'theaudiodb_validation_error',
  );
});

test('createTheAudioDbClient fetchArtistImages throws validation error for non-string mbid', async () => {
  const client = createTheAudioDbClient();
  await assert.rejects(
    () => client.fetchArtistImages({ mbid: null }),
    (error) => error.code === 'theaudiodb_validation_error',
  );
});

test('createTheAudioDbClient retries on network failure then succeeds', async (t) => {
  let callCount = 0;
  const responses = t.mock.fn(async () => {
    callCount += 1;
    if (callCount === 1) throw new Error('Network timeout');
    return {
      ok: true,
      json: async () => ({
        artists: [{
          strArtistThumb: 'https://r2.theaudiodb.com/images/media/artist/thumb/retry.jpg',
        }],
      }),
    };
  });

  const client = createTheAudioDbClient({
    fetchImpl: responses,
    maxRetries: 2,
    sleepImpl: async () => {},
  });

  const images = await client.fetchArtistImages({ mbid: 'test-mbid' });

  assert.equal(images.length, 1);
  assert.equal(images[0].imageType, 'artistthumb');
  assert.equal(callCount, 2);
});

test('createTheAudioDbClient throws theaudiodb_unavailable after exhausting retries', async (t) => {
  const responses = t.mock.fn(async () => {
    throw new Error('Persistent network failure');
  });

  const client = createTheAudioDbClient({
    fetchImpl: responses,
    maxRetries: 1,
    sleepImpl: async () => {},
  });

  await assert.rejects(
    () => client.fetchArtistImages({ mbid: 'test-mbid' }),
    (error) => error.code === 'theaudiodb_unavailable',
  );
});

test('createTheAudioDbClient retries on 429 status', async (t) => {
  let callCount = 0;
  const responses = t.mock.fn(async () => {
    callCount += 1;
    if (callCount === 1) return { ok: false, status: 429, headers: { get: () => null } };
    return {
      ok: true,
      json: async () => ({
        artists: [{ strArtistThumb: 'https://example.com/thumb.jpg' }],
      }),
    };
  });

  const client = createTheAudioDbClient({
    fetchImpl: responses,
    maxRetries: 2,
    sleepImpl: async () => {},
  });

  const images = await client.fetchArtistImages({ mbid: 'test-mbid' });
  assert.equal(images.length, 1);
  assert.equal(callCount, 2);
});

test('createTheAudioDbClient retries on 5xx status', async (t) => {
  let callCount = 0;
  const responses = t.mock.fn(async () => {
    callCount += 1;
    if (callCount === 1) return { ok: false, status: 503, headers: { get: () => null } };
    return {
      ok: true,
      json: async () => ({
        artists: [{ strArtistFanart: 'https://example.com/fanart.jpg' }],
      }),
    };
  });

  const client = createTheAudioDbClient({
    fetchImpl: responses,
    maxRetries: 2,
    sleepImpl: async () => {},
  });

  const images = await client.fetchArtistImages({ mbid: 'test-mbid' });
  assert.equal(images[0].imageType, 'artistfanart');
});

test('createTheAudioDbClient throws theaudiodb_request_failed on 4xx status', async (t) => {
  const responses = t.mock.fn(async () => ({
    ok: false,
    status: 403,
    headers: { get: () => null },
  }));

  const client = createTheAudioDbClient({
    fetchImpl: responses,
    maxRetries: 0,
  });

  await assert.rejects(
    () => client.fetchArtistImages({ mbid: 'test-mbid' }),
    (error) => error.code === 'theaudiodb_request_failed',
  );
});

test('createTheAudioDbClient throws theaudiodb_misconfigured for invalid base URL', () => {
  assert.throws(
    () => createTheAudioDbClient({ baseUrl: 'ftp://invalid.example.com' }),
    (error) => error.code === 'theaudiodb_misconfigured',
  );
});
