import assert from 'node:assert/strict';
import test from 'node:test';
import { createFanartTvClient, selectArtistImages, selectAlbumImages } from '../../src/server/integrations/fanart-tv/fanart-client.js';

test('fetchArtistImages returns empty array for 404/null response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 404, headers: new Map() });
  const client = createFanartTvClient({
    fetchImpl,
    requestTimeoutMs: 5000,
  });

  const result = await client.fetchArtistImages({ mbid: 'nonexistent-mbid' });
  assert.deepEqual(result, []);
});

test('fetchArtistImages returns parsed artist images', async () => {
  const responseBody = {
    name: 'Radiohead',
    mbid_id: 'a74b1b7f-71a5-4011-9441-d0b5e4122711',
    artistthumb: [
      { id: '1', url: 'https://assets.fanart.tv/thumb1.jpg', lang: '', likes: '12' },
      { id: '2', url: 'https://assets.fanart.tv/thumb2.jpg', lang: 'en', likes: '5' },
    ],
    artistbackground: [
      { id: '3', url: 'https://assets.fanart.tv/bg1.jpg', lang: '', likes: '8' },
    ],
    hdmusiclogo: [],
    musiclogo: [
      { id: '4', url: 'https://assets.fanart.tv/logo1.png', lang: '', likes: '3' },
    ],
  };

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => responseBody,
  });

  const client = createFanartTvClient({
    fetchImpl,
    requestTimeoutMs: 5000,
  });

  const result = await client.fetchArtistImages({ mbid: 'a74b1b7f-71a5-4011-9441-d0b5e4122711' });
  assert.equal(result.length, 3);
  assert.equal(result[0].imageType, 'artistthumb');
  assert.equal(result[0].url, 'https://assets.fanart.tv/thumb1.jpg');
  assert.equal(result[0].likes, 12);
  assert.equal(result[1].imageType, 'artistbackground');
  assert.equal(result[2].imageType, 'musiclogo');
});

test('fetchAlbumImages returns parsed album images', async () => {
  const responseBody = {
    albumcover: [
      { id: '10', url: 'https://assets.fanart.tv/album1.jpg', lang: '', likes: '7' },
    ],
  };

  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => responseBody,
  });

  const client = createFanartTvClient({
    fetchImpl,
    requestTimeoutMs: 5000,
  });

  const result = await client.fetchAlbumImages({ mbid: 'rg-mbid-1' });
  assert.equal(result.length, 1);
  assert.equal(result[0].imageType, 'albumcover');
  assert.equal(result[0].url, 'https://assets.fanart.tv/album1.jpg');
});

test('fetchArtistImages throws for empty mbid', async () => {
  const client = createFanartTvClient({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    requestTimeoutMs: 5000,
  });

  await assert.rejects(
    () => client.fetchArtistImages({ mbid: '' }),
    (error) => error.code === 'fanarttv_validation_error',
  );
});

test('fetchArtistImages sends api-key and client-key headers', async () => {
  let sentHeaders = null;
  const fetchImpl = async (_url, options) => {
    sentHeaders = options.headers;
    return { ok: true, status: 200, headers: new Map(), json: async () => ({}) };
  };

  const client = createFanartTvClient({
    fetchImpl,
    requestTimeoutMs: 5000,
    resolveApiKey: async () => 'project-key-123',
    resolveClientKey: async () => 'personal-key-456',
  });

  await client.fetchArtistImages({ mbid: 'mbid-1' });
  assert.equal(sentHeaders['api-key'], 'project-key-123');
  assert.equal(sentHeaders['client-key'], 'personal-key-456');
});

test('fetchArtistImages retries on 503', async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount === 1) return { ok: false, status: 503, headers: new Map() };
    return { ok: true, status: 200, headers: new Map(), json: async () => ({}) };
  };

  const client = createFanartTvClient({
    fetchImpl,
    requestTimeoutMs: 5000,
    maxRetries: 2,
    sleepImpl: async () => {},
  });

  const result = await client.fetchArtistImages({ mbid: 'mbid-1' });
  assert.equal(callCount, 2);
  assert.deepEqual(result, []);
});

test('selectArtistImages prefers empty lang and highest likes', () => {
  const response = {
    artistthumb: [
      { id: '1', url: 'url1', lang: 'en', likes: '20' },
      { id: '2', url: 'url2', lang: '', likes: '10' },
      { id: '3', url: 'url3', lang: '', likes: '15' },
    ],
  };

  const result = selectArtistImages(response);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '3');
  assert.equal(result[0].likes, 15);
});

test('selectAlbumImages returns empty for null input', () => {
  assert.deepEqual(selectAlbumImages(null), []);
  assert.deepEqual(selectAlbumImages(undefined), []);
});
