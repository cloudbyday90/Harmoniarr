import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoverArtArchiveClient } from '../../src/server/integrations/cover-art-archive/cover-art-archive-client.js';

function createFakeResponse({ status = 200, headers = {}, body = null, url = 'https://coverartarchive.org/release/test-mbid/front' }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)),
    url,
    arrayBuffer: async () => body ?? new ArrayBuffer(0),
    json: async () => body,
  };
}

test('createCoverArtArchiveClient falls back to a default contact when none is configured', () => {
  assert.doesNotThrow(
    () => createCoverArtArchiveClient({ contactEmail: undefined, contactUrl: undefined }),
  );
});

test('fetchFrontImage returns null for 404 response', async () => {
  const fetchImpl = async () => createFakeResponse({ status: 404 });
  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
  });

  const result = await client.fetchFrontImage({ mbid: 'nonexistent-mbid' });
  assert.equal(result, null);
});

test('fetchFrontImage returns image buffer on success', async () => {
  const imageBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
  const fetchImpl = async () => createFakeResponse({
    status: 200,
    headers: { 'content-type': 'image/jpeg' },
    body: imageBuffer.buffer,
    url: 'https://archive.org/download/test/image.jpg',
  });

  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
  });

  const result = await client.fetchFrontImage({ mbid: 'test-mbid' });
  assert.ok(result);
  assert.equal(result.contentType, 'image/jpeg');
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.equal(result.sourceUrl, 'https://archive.org/download/test/image.jpg');
});

test('fetchFrontImage throws for empty mbid', async () => {
  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl: async () => createFakeResponse({ status: 200 }),
    minIntervalMs: 1,
  });

  await assert.rejects(
    () => client.fetchFrontImage({ mbid: '' }),
    (error) => error.code === 'coverartarchive_validation_error',
  );
});

test('fetchFrontImage throws coverartarchive_unavailable on network error after retries', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl,
    maxRetries: 1,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
    sleepImpl: async () => {},
  });

  await assert.rejects(
    () => client.fetchFrontImage({ mbid: 'test-mbid' }),
    (error) => error.code === 'coverartarchive_unavailable',
  );
});

test('fetchFrontImage retries on 503 and succeeds on second attempt', async () => {
  let callCount = 0;
  const imageBuffer = Buffer.from([0xFF, 0xD8]);
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount === 1) {
      return createFakeResponse({ status: 503 });
    }
    return createFakeResponse({
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      body: imageBuffer.buffer,
    });
  };

  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl,
    maxRetries: 2,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
    sleepImpl: async () => {},
  });

  const result = await client.fetchFrontImage({ mbid: 'test-mbid' });
  assert.ok(result);
  assert.equal(callCount, 2);
});

test('fetchFrontImage supports release-group mbidType', async () => {
  let requestedUrl = null;
  const fetchImpl = async (url) => {
    requestedUrl = url.toString();
    return createFakeResponse({ status: 404 });
  };

  const client = createCoverArtArchiveClient({
    contactEmail: 'test@example.com',
    fetchImpl,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
  });

  await client.fetchFrontImage({ mbid: 'rg-mbid', mbidType: 'release-group' });
  assert.ok(requestedUrl.includes('/release-group/rg-mbid/front'));
});

test('fetchFrontImage sends User-Agent header', async () => {
  let sentHeaders = null;
  const fetchImpl = async (_url, options) => {
    sentHeaders = options.headers;
    return createFakeResponse({ status: 404 });
  };

  const client = createCoverArtArchiveClient({
    applicationName: 'TestApp',
    applicationVersion: '1.0',
    contactEmail: 'test@example.com',
    fetchImpl,
    minIntervalMs: 1,
    requestTimeoutMs: 5000,
  });

  await client.fetchFrontImage({ mbid: 'test-mbid' });
  assert.ok(sentHeaders['User-Agent'].startsWith('TestApp/1.0'));
});
