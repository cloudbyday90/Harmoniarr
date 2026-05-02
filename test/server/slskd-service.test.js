import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';

function createProviderError() {
  const error = new Error('slskd server state request failed with status 503');
  error.code = 'slskd_unavailable';
  error.details = {
    operation: 'server state',
    retryable: true,
    status: 503,
    url: 'http://slskd.test:5030/api/v0/server',
  };
  return error;
}

test('createSlskdService normalizes connection status from application state', async (t) => {
  const getApplicationState = t.mock.fn(async () => ({
    version: {
      current: '0.23.0',
    },
    pendingRestart: false,
    server: {
      address: 'vps.slsknet.org',
      state: 'Connected, LoggedIn',
      isConnected: true,
      isLoggedIn: true,
      isTransitioning: false,
    },
  }));
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createSlskdService({
    providerHealthRecorder,
    slskdClient: {
      getApplicationState,
    },
  });

  const status = await service.getConnectionStatus();

  assert.equal(getApplicationState.mock.callCount(), 1);
  assert.deepEqual(providerHealthRecorder.recordSuccess.mock.calls[0].arguments, ['slskd']);
  assert.equal(providerHealthRecorder.recordError.mock.callCount(), 0);
  assert.deepEqual(status, {
    provider: 'slskd',
    status: 'healthy',
    details: {
      isConnected: true,
      isLoggedIn: true,
      isTransitioning: false,
    },
    version: '0.23.0',
    pendingRestart: false,
    server: {
      address: 'vps.slsknet.org',
      state: 'Connected, LoggedIn',
      isConnected: true,
      isLoggedIn: true,
      isTransitioning: false,
    },
  });
});

test('createSlskdService maps disconnected server state to provider health status', async () => {
  const service = createSlskdService({
    slskdClient: {
      getApplicationState: async () => ({
        server: {
          state: 'Disconnected',
          isConnected: false,
          isLoggedIn: false,
          isTransitioning: false,
        },
      }),
    },
  });

  assert.deepEqual(await service.getConnectionStatus(), {
    provider: 'slskd',
    status: 'unavailable',
    message: 'slskd is not connected to Soulseek',
    details: {
      isConnected: false,
      isLoggedIn: false,
      isTransitioning: false,
    },
    version: null,
    pendingRestart: null,
    server: {
      address: null,
      state: 'Disconnected',
      isConnected: false,
      isLoggedIn: false,
      isTransitioning: false,
    },
  });
});

test('createSlskdService maps connected unauthenticated server state to degraded health status', async () => {
  const service = createSlskdService({
    slskdClient: {
      getApplicationState: async () => ({
        server: {
          state: 'Connected',
          isConnected: true,
          isLoggedIn: false,
          isTransitioning: false,
        },
      }),
    },
  });

  assert.deepEqual(await service.getConnectionStatus(), {
    provider: 'slskd',
    status: 'degraded',
    message: 'slskd is connected but not logged in',
    details: {
      isConnected: true,
      isLoggedIn: false,
      isTransitioning: false,
    },
    version: null,
    pendingRestart: null,
    server: {
      address: null,
      state: 'Connected',
      isConnected: true,
      isLoggedIn: false,
      isTransitioning: false,
    },
  });
});

test('createSlskdService builds provider clients from shared runtime config when a static client is not injected', async (t) => {
  const getClientConfig = t.mock.fn(async () => ({
    apiKey: 'stored-api-key',
    baseUrl: 'http://slskd.internal:5030',
    requestTimeoutMs: 15000,
  }));
  const createSlskdClientFn = t.mock.fn(() => ({
    getApplicationState: async () => ({
      server: {
        state: 'Connected, LoggedIn',
        isConnected: true,
        isLoggedIn: true,
        isTransitioning: false,
      },
    }),
  }));
  const service = createSlskdService({
    createSlskdClientFn,
    getClientConfig,
  });

  await service.getConnectionStatus();

  assert.equal(getClientConfig.mock.callCount(), 1);
  assert.deepEqual(createSlskdClientFn.mock.calls[0].arguments[0], {
    apiKey: 'stored-api-key',
    baseUrl: 'http://slskd.internal:5030',
    requestTimeoutMs: 15000,
  });
});

test('createSlskdService validates search requests before calling slskd', async (t) => {
  const startSearch = t.mock.fn(async () => ({ id: 'search-1' }));
  const service = createSlskdService({
    slskdClient: {
      startSearch,
    },
  });

  await assert.rejects(
    () => service.startSearch({ query: '   ' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'query is required');
      return true;
    },
  );
  assert.equal(startSearch.mock.callCount(), 0);
});

test('createSlskdService normalizes search requests and search responses', async (t) => {
  const startSearch = t.mock.fn(async ({
    query,
    fileLimit,
    filterResponses,
    responseLimit,
    searchTimeoutMs,
  }) => {
    assert.equal(query, 'Autechre Amber');
    assert.equal(fileLimit, 20);
    assert.equal(filterResponses, false);
    assert.equal(responseLimit, 5);
    assert.equal(searchTimeoutMs, 3000);

    return {
      id: 'search-1',
      searchText: query,
      state: 'Completed',
      token: 1234,
      isComplete: true,
      responseCount: 1,
      fileCount: 1,
      lockedFileCount: 0,
      responses: [{
        username: 'source-user',
        hasFreeUploadSlot: true,
        queueLength: 0,
        uploadSpeed: 200000,
        fileCount: 1,
        lockedFileCount: 0,
        files: [{
          filename: 'Autechre\\Amber\\01 Foil.flac',
          size: 123456,
          extension: '.flac',
          bitRate: 900,
          bitDepth: 16,
          length: 360,
          sampleRate: 44100,
          isLocked: false,
        }],
      }],
    };
  });
  const service = createSlskdService({
    slskdClient: {
      startSearch,
    },
  });

  const result = await service.startSearch({
    query: '  Autechre   Amber ',
    fileLimit: '20',
    filterResponses: 'false',
    responseLimit: '5',
    searchTimeoutMs: '3000',
  });

  assert.equal(startSearch.mock.callCount(), 1);
  assert.deepEqual(result, {
    id: 'search-1',
    query: 'Autechre Amber',
    state: 'Completed',
    token: 1234,
    isComplete: true,
    startedAt: null,
    endedAt: null,
    responseCount: 1,
    fileCount: 1,
    lockedFileCount: 0,
    responses: [{
      username: 'source-user',
      hasFreeUploadSlot: true,
      queueLength: 0,
      uploadSpeed: 200000,
      fileCount: 1,
      lockedFileCount: 0,
      files: [{
        filename: 'Autechre\\Amber\\01 Foil.flac',
        size: 123456,
        extension: '.flac',
        bitRate: 900,
        bitDepth: 16,
        length: 360,
        sampleRate: 44100,
        isLocked: false,
      }],
      lockedFiles: [],
    }],
  });
});

test('createSlskdService normalizes search state polling requests', async (t) => {
  const getSearchState = t.mock.fn(async ({ searchId, includeResponses }) => {
    assert.equal(searchId, 'search-1');
    assert.equal(includeResponses, true);

    return {
      id: searchId,
      searchText: 'Autechre Amber',
      state: 'InProgress',
      token: 1234,
      isComplete: false,
      responseCount: 0,
      fileCount: 0,
      lockedFileCount: 0,
    };
  });
  const service = createSlskdService({
    slskdClient: {
      getSearchState,
    },
  });

  const result = await service.getSearchState({
    searchId: ' search-1 ',
    includeResponses: 'true',
  });

  assert.equal(getSearchState.mock.callCount(), 1);
  assert.deepEqual(result, {
    id: 'search-1',
    query: 'Autechre Amber',
    state: 'InProgress',
    token: 1234,
    isComplete: false,
    startedAt: null,
    endedAt: null,
    responseCount: 0,
    fileCount: 0,
    lockedFileCount: 0,
    responses: [],
  });
});

test('createSlskdService validates search ids before polling slskd', async (t) => {
  const getSearchState = t.mock.fn();
  const getSearchResponses = t.mock.fn();
  const service = createSlskdService({
    slskdClient: {
      getSearchResponses,
      getSearchState,
    },
  });

  await assert.rejects(
    () => service.getSearchState({ searchId: '   ' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'searchId is required');
      return true;
    },
  );
  await assert.rejects(
    () => service.getSearchResponses({ searchId: null }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'validation_error');
      assert.equal(error.message, 'searchId must be a string');
      return true;
    },
  );
  assert.equal(getSearchState.mock.callCount(), 0);
  assert.equal(getSearchResponses.mock.callCount(), 0);
});

test('createSlskdService normalizes search responses from slskd', async (t) => {
  const getSearchResponses = t.mock.fn(async ({ searchId }) => {
    assert.equal(searchId, 'search-1');

    return [{
      username: 'source-user',
      hasFreeUploadSlot: true,
      queueLength: 1,
      uploadSpeed: 100000,
      fileCount: 1,
      lockedFileCount: 0,
      files: [{
        filename: 'Boards of Canada\\Music Has the Right to Children\\01 Wildlife Analysis.flac',
        size: 12345,
        extension: '.flac',
      }],
    }];
  });
  const service = createSlskdService({
    slskdClient: {
      getSearchResponses,
    },
  });

  assert.deepEqual(await service.getSearchResponses({ searchId: ' search-1 ' }), {
    searchId: 'search-1',
    responses: [{
      username: 'source-user',
      hasFreeUploadSlot: true,
      queueLength: 1,
      uploadSpeed: 100000,
      fileCount: 1,
      lockedFileCount: 0,
      files: [{
        filename: 'Boards of Canada\\Music Has the Right to Children\\01 Wildlife Analysis.flac',
        size: 12345,
        extension: '.flac',
        bitRate: null,
        bitDepth: null,
        length: null,
        sampleRate: null,
        isLocked: false,
      }],
      lockedFiles: [],
    }],
  });
});

test('createSlskdService preserves slskd provider failure details', async (t) => {
  const providerError = createProviderError();
  const providerHealthRecorder = {
    recordError: t.mock.fn(),
    recordSuccess: t.mock.fn(),
  };
  const service = createSlskdService({
    providerHealthRecorder,
    slskdClient: {
      getApplicationState: async () => {
        throw providerError;
      },
    },
  });

  await assert.rejects(
    () => service.getConnectionStatus(),
    (error) => {
      assert.equal(error, providerError);
      assert.equal(error.code, 'slskd_unavailable');
      assert.equal(error.details.status, 503);
      return true;
    },
  );
  assert.equal(providerHealthRecorder.recordSuccess.mock.callCount(), 0);
  assert.deepEqual(providerHealthRecorder.recordError.mock.calls[0].arguments, ['slskd', providerError]);
});

test('createSlskdService validates and normalizes download enqueue responses', async (t) => {
  const enqueueDownloads = t.mock.fn(async ({ files, username }) => {
    assert.equal(username, 'source-user');
    assert.deepEqual(files, [{
      filename: 'Autechre\\Amber\\01 Foil.flac',
      size: 123456,
    }]);

    return {
      Enqueued: [{
        id: 'transfer-1',
        username,
        filename: files[0].filename,
        state: 'Queued, Remotely',
        size: files[0].size,
      }],
      Failed: [],
    };
  });
  const service = createSlskdService({
    slskdClient: {
      enqueueDownloads,
    },
  });

  const result = await service.enqueueDownloads({
    files: [{
      filename: 'Autechre\\Amber\\01 Foil.flac',
      size: '123456',
    }],
    username: 'source-user',
  });

  assert.equal(enqueueDownloads.mock.callCount(), 1);
  assert.deepEqual(result, {
    enqueued: [{
      averageSpeed: null,
      bytesTransferred: null,
      directory: null,
      endedAt: null,
      enqueuedAt: null,
      exception: null,
      filename: 'Autechre\\Amber\\01 Foil.flac',
      id: 'transfer-1',
      placeInQueue: null,
      requestedAt: null,
      size: 123456,
      startedAt: null,
      state: 'Queued, Remotely',
      username: 'source-user',
    }],
    failed: [],
  });
});
