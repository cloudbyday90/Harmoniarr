import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdClient } from '../../src/server/integrations/slskd/slskd-client.js';

function createJsonResponse(body, { status = 200 } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

test('createSlskdClient sends API-key authenticated requests to the v0 API base', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    server: {
      state: 'Connected, LoggedIn',
      isConnected: true,
      isLoggedIn: true,
    },
  }));
  const client = createSlskdClient({
    apiKey: 'test-slskd-api-key',
    baseUrl: 'http://slskd.test:5030',
    fetchImpl,
    requestTimeoutMs: 1000,
  });

  const payload = await client.getApplicationState();

  assert.equal(fetchImpl.mock.callCount(), 1);
  const [url, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'http://slskd.test:5030/api/v0/application');
  assert.equal(options.method, 'GET');
  assert.equal(options.headers.Accept, 'application/json');
  assert.equal(options.headers['X-API-Key'], 'test-slskd-api-key');
  assert.deepEqual(payload, {
    server: {
      state: 'Connected, LoggedIn',
      isConnected: true,
      isLoggedIn: true,
    },
  });
});

test('createSlskdClient starts searches with normalized slskd request fields', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    id: 'search-1',
    searchText: 'autechre amber',
    state: 'Completed',
    isComplete: true,
  }));
  const client = createSlskdClient({
    apiKey: 'test-slskd-api-key',
    baseUrl: 'http://slskd.test:5030/api/v0',
    fetchImpl,
    requestTimeoutMs: 1000,
  });

  await client.startSearch({
    query: 'autechre amber',
    fileLimit: 20,
    filterResponses: true,
    responseLimit: 5,
    searchTimeoutMs: 15000,
  });

  const [url, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'http://slskd.test:5030/api/v0/searches');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(options.body), {
    id: null,
    searchText: 'autechre amber',
    fileLimit: 20,
    filterResponses: true,
    maximumPeerQueueLength: 1000000,
    minimumPeerUploadSpeed: 0,
    minimumResponseFileCount: 1,
    responseLimit: 5,
    searchTimeout: 15000,
  });
});

test('createSlskdClient classifies authentication failures', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'unauthorized' }, {
    status: 401,
  }));
  const client = createSlskdClient({
    apiKey: 'bad-api-key',
    baseUrl: 'http://slskd.test:5030',
    fetchImpl,
    requestTimeoutMs: 1000,
  });

  await assert.rejects(
    () => client.isAuthenticationValid(),
    (error) => {
      assert.equal(error.code, 'slskd_unauthorized');
      assert.equal(error.message, 'slskd session validation request was not authorized');
      assert.equal(error.details.status, 401);
      assert.equal(error.details.retryable, false);
      assert.equal(error.details.url, 'http://slskd.test:5030/api/v0/session');
      return true;
    },
  );
});

test('createSlskdClient classifies unavailable responses', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({ error: 'unavailable' }, {
    status: 503,
  }));
  const client = createSlskdClient({
    baseUrl: 'http://slskd.test:5030',
    fetchImpl,
    requestTimeoutMs: 1000,
  });

  await assert.rejects(
    () => client.getServerState(),
    (error) => {
      assert.equal(error.code, 'slskd_unavailable');
      assert.equal(error.message, 'slskd server state request failed with status 503');
      assert.equal(error.details.status, 503);
      assert.equal(error.details.retryable, true);
      return true;
    },
  );
});

test('createSlskdClient enqueues downloads through the transfers API', async (t) => {
  const fetchImpl = t.mock.fn(async () => createJsonResponse({
    Enqueued: [{
      id: 'transfer-1',
      username: 'source-user',
      filename: 'Autechre\\Amber\\01 Foil.flac',
      state: 'Queued, Remotely',
      size: 123456,
    }],
    Failed: [],
  }, {
    status: 201,
  }));
  const client = createSlskdClient({
    baseUrl: 'http://slskd.test:5030',
    fetchImpl,
    requestTimeoutMs: 1000,
  });

  await client.enqueueDownloads({
    files: [{
      filename: 'Autechre\\Amber\\01 Foil.flac',
      size: 123456,
    }],
    username: 'source-user',
  });

  const [url, options] = fetchImpl.mock.calls[0].arguments;
  assert.equal(url.toString(), 'http://slskd.test:5030/api/v0/transfers/downloads/source-user');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), [{
    filename: 'Autechre\\Amber\\01 Foil.flac',
    size: 123456,
  }]);
});
