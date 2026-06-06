import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchDownloaderQueue } from '../../src/client/lib/downloader-api.js';

function createJsonResponse({ payload = { ok: true } } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok: true,
    status: 200,
    async json() {
      return payload;
    },
  };
}

test('downloader-api fetchDownloaderQueue returns the downloader read model', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    payload: {
      downloader: {
        provider: 'slskd',
        transfers: [{ transferKey: 'source::transfer-1' }],
      },
    },
  }));

  const result = await fetchDownloaderQueue();

  assert.deepEqual(result, {
    provider: 'slskd',
    transfers: [{ transferKey: 'source::transfer-1' }],
  });
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/downloader/queue');
});

test('downloader-api fetchDownloaderQueue includes includeRemoved query when requested', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: { downloader: {} } }));

  await fetchDownloaderQueue({ includeRemoved: true });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/downloader/queue?includeRemoved=true');
});

test('downloader-api fetchDownloaderQueue returns null when the payload is absent', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({ payload: {} }));

  const result = await fetchDownloaderQueue();

  assert.equal(result, null);
});
