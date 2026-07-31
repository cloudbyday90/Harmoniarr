import assert from 'node:assert/strict';
import test from 'node:test';
import { registerSlskdRoutes } from '../../src/server/routes/slskd-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createSlskdRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerSlskdRoutes(app, {
      getConnectionStatus: async () => ({
        provider: 'slskd',
        status: 'healthy',
        details: {
          isConnected: true,
          isLoggedIn: true,
          isTransitioning: false,
        },
      }),
      getSearchResponses: async ({ searchId }) => ({
        searchId,
        responses: [],
      }),
      getSearchState: async ({ searchId, includeResponses }) => ({
        id: searchId,
        query: 'Autechre Amber',
        state: includeResponses === 'true' ? 'Completed' : 'InProgress',
        isComplete: includeResponses === 'true',
        responses: [],
      }),
      requireAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      requireFreshAdminSession: async () => ({ appUserId: 'user-1', csrfToken: 'csrf-token' }),
      requireCsrf: () => {},
      startSearch: async ({ query, fileLimit, filterResponses, responseLimit, searchTimeoutMs }) => ({
        id: 'search-1',
        query,
        fileLimit,
        filterResponses,
        responseLimit,
        searchTimeoutMs,
        state: 'InProgress',
        isComplete: false,
        responses: [],
      }),
      ...overrides,
    });
  });
}

test('slskd status route returns shared connection status for authenticated admin sessions', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-20' }));
  const getConnectionStatus = t.mock.fn(async () => ({
    provider: 'slskd',
    status: 'degraded',
    message: 'slskd is connected but not logged in',
    details: {
      isConnected: true,
      isLoggedIn: false,
      isTransitioning: false,
    },
  }));
  const app = createSlskdRouteTestApp({ getConnectionStatus, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
    assert.equal(getConnectionStatus.mock.callCount(), 1);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'slskd',
      status: {
        provider: 'slskd',
        status: 'degraded',
        message: 'slskd is connected but not logged in',
        details: {
          isConnected: true,
          isLoggedIn: false,
          isTransitioning: false,
        },
      },
    });
  });
});

test('slskd search start route enforces csrf and delegates to the shared service', async (t) => {
  const requireCsrf = t.mock.fn();
  const requireFreshAdminSession = t.mock.fn(async () => ({ appUserId: 'user-21', csrfToken: 'csrf-token' }));
  const startSearch = t.mock.fn(async ({ query, fileLimit, filterResponses, responseLimit, searchTimeoutMs }) => ({
    id: 'search-1',
    query,
    fileLimit,
    filterResponses,
    responseLimit,
    searchTimeoutMs,
    state: 'InProgress',
    isComplete: false,
    responses: [],
  }));
  const app = createSlskdRouteTestApp({
    requireFreshAdminSession,
    requireCsrf,
    startSearch,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({
        query: 'Autechre Amber',
        fileLimit: 20,
        filterResponses: false,
        responseLimit: 5,
        searchTimeoutMs: 3000,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 202);
    assert.equal(requireFreshAdminSession.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[0].headers['x-csrf-token'], 'csrf-token');
    assert.deepEqual(requireCsrf.mock.calls[0].arguments[1], {
      appUserId: 'user-21',
      csrfToken: 'csrf-token',
    });
    assert.deepEqual(startSearch.mock.calls[0].arguments, [{
      query: 'Autechre Amber',
      fileLimit: 20,
      filterResponses: false,
      responseLimit: 5,
      searchTimeoutMs: 3000,
    }]);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'slskd',
      search: {
        id: 'search-1',
        query: 'Autechre Amber',
        fileLimit: 20,
        filterResponses: false,
        responseLimit: 5,
        searchTimeoutMs: 3000,
        state: 'InProgress',
        isComplete: false,
        responses: [],
      },
    });
  });
});

test('slskd search state route enforces admin sessions before querying provider state', async (t) => {
  const requireAdminSession = t.mock.fn(async () => ({ appUserId: 'user-22' }));
  const getSearchState = t.mock.fn(async ({ searchId, includeResponses }) => ({
    id: searchId,
    query: 'Autechre Amber',
    state: includeResponses === 'true' ? 'Completed' : 'InProgress',
    isComplete: includeResponses === 'true',
    responses: [],
  }));
  const app = createSlskdRouteTestApp({ getSearchState, requireAdminSession });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches/search-1?includeResponses=true`);

    assert.equal(response.status, 200);
    assert.equal(requireAdminSession.mock.callCount(), 1);
  });
});

test('slskd search state route passes includeResponses to the shared service', async (t) => {
  const getSearchState = t.mock.fn(async ({ searchId, includeResponses }) => ({
    id: searchId,
    query: 'Autechre Amber',
    state: includeResponses === 'true' ? 'Completed' : 'InProgress',
    isComplete: includeResponses === 'true',
    responses: [],
  }));
  const app = createSlskdRouteTestApp({ getSearchState });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches/search-1?includeResponses=true`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getSearchState.mock.calls[0].arguments, [{
      searchId: 'search-1',
      includeResponses: 'true',
    }]);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'slskd',
      search: {
        id: 'search-1',
        query: 'Autechre Amber',
        state: 'Completed',
        isComplete: true,
        responses: [],
      },
    });
  });
});

test('slskd search responses route returns normalized provider responses', async (t) => {
  const getSearchResponses = t.mock.fn(async ({ searchId }) => ({
    searchId,
    responses: [{
      username: 'source-user',
      fileCount: 1,
      files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 12345 }],
      lockedFiles: [],
    }],
  }));
  const app = createSlskdRouteTestApp({ getSearchResponses });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches/search-1/responses`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(getSearchResponses.mock.calls[0].arguments, [{ searchId: 'search-1' }]);
    assert.deepEqual(payload, {
      ok: true,
      provider: 'slskd',
      searchId: 'search-1',
      responses: [{
        username: 'source-user',
        fileCount: 1,
        files: [{ filename: 'Autechre\\Amber\\01 Foil.flac', size: 12345 }],
        lockedFiles: [],
      }],
    });
  });
});

test('slskd routes normalize provider unavailable errors to 503 responses', async () => {
  const app = createSlskdRouteTestApp({
    getSearchState: async () => {
      const error = new Error('slskd search state request failed with status 503');
      error.code = 'slskd_unavailable';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches/search-1`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unavailable',
        message: 'slskd is temporarily unavailable',
      },
    });
  });
});

test('slskd routes normalize provider authentication errors to 503 responses', async () => {
  const app = createSlskdRouteTestApp({
    startSearch: async () => {
      const error = new Error('slskd search start request was not authorized');
      error.code = 'slskd_unauthorized';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ query: 'Autechre Amber' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_unauthorized',
        message: 'slskd authentication failed',
      },
    });
  });
});

test('slskd status route redacts unexpected configuration details', async () => {
  const app = createSlskdRouteTestApp({
    getConnectionStatus: async () => {
      const error = new Error('http://private-slskd.example rejected secret-value');
      error.code = 'slskd_misconfigured';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/status`);
    const payload = await response.json();

    assert.equal(response.status, 503);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_misconfigured',
        message: 'Soulseek connection settings need review',
      },
    });
    assert.doesNotMatch(JSON.stringify(payload), /private-slskd|secret-value|https?:/i);
  });
});

test('slskd routes normalize provider request failures to 502 responses', async () => {
  const app = createSlskdRouteTestApp({
    getSearchResponses: async () => {
      const error = new Error('slskd search responses request failed with status 400');
      error.code = 'slskd_request_failed';
      throw error;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/slskd/searches/search-1/responses`);
    const payload = await response.json();

    assert.equal(response.status, 502);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'slskd_request_failed',
        message: 'Soulseek request failed. Try again.',
      },
    });
  });
});
