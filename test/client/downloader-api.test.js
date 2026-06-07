import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearCompletedDownloaderTransfers,
  fetchDownloaderQueue,
  requestDownloaderTransferAction,
} from '../../src/client/lib/downloader-api.js';

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

test('downloader-api requestDownloaderTransferAction posts csrf-protected transfer actions', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    payload: {
      downloaderAction: {
        action: 'cancel',
        id: 'transfer/1',
        ok: true,
        provider: 'slskd',
        sourceUser: 'source user',
      },
    },
  }));

  const result = await requestDownloaderTransferAction({
    action: 'cancel',
    id: 'transfer/1',
    username: 'source user',
  });

  const [path, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(path, '/api/v1/downloader/transfers/source%20user/transfer%2F1/actions');
  assert.equal(options.method, 'POST');
  assert.equal(options.credentials, 'same-origin');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.body, JSON.stringify({ action: 'cancel' }));
  assert.deepEqual(result, {
    action: 'cancel',
    id: 'transfer/1',
    ok: true,
    provider: 'slskd',
    sourceUser: 'source user',
  });
});

test('downloader-api clearCompletedDownloaderTransfers posts csrf-protected queue actions', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-token' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    payload: {
      downloaderAction: {
        action: 'clear_completed',
        ok: true,
        provider: 'slskd',
      },
    },
  }));

  const result = await clearCompletedDownloaderTransfers();

  const [path, options] = globalThis.fetch.mock.calls[0].arguments;
  assert.equal(path, '/api/v1/downloader/actions/clear-completed');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.get('X-CSRF-Token'), 'csrf-token');
  assert.equal(options.body, JSON.stringify({}));
  assert.deepEqual(result, {
    action: 'clear_completed',
    ok: true,
    provider: 'slskd',
  });
});
