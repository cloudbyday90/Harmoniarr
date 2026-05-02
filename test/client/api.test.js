import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest, setAuthFailureHandler } from '../../src/client/lib/api.js';

function createJsonResponse({ ok, status, payload }) {
  return {
    ok,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    async json() {
      return payload;
    },
    async text() {
      return JSON.stringify(payload);
    },
  };
}

test('apiRequest invokes the shared auth failure handler for auth_required responses', async (t) => {
  const authFailureHandler = t.mock.fn(async () => {});
  setAuthFailureHandler(authFailureHandler);
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    ok: false,
    status: 401,
    payload: {
      error: {
        code: 'auth_required',
        message: 'Authentication is required',
      },
    },
  }));

  await assert.rejects(
    () => apiRequest('/api/v1/settings'),
    (error) => error?.status === 401 && error?.code === 'auth_required',
  );

  assert.equal(authFailureHandler.mock.callCount(), 1);
  assert.deepEqual(authFailureHandler.mock.calls[0].arguments[1], {
    method: 'GET',
    path: '/api/v1/settings',
  });

  setAuthFailureHandler(null);
});

test('apiRequest does not invoke the shared auth failure handler for invalid login credentials', async (t) => {
  const authFailureHandler = t.mock.fn(async () => {});
  setAuthFailureHandler(authFailureHandler);
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    ok: false,
    status: 401,
    payload: {
      error: {
        code: 'invalid_credentials',
        message: 'Username or password is incorrect',
      },
    },
  }));

  await assert.rejects(
    () => apiRequest('/api/v1/auth/login', {
      method: 'POST',
      body: { username: 'operator', password: 'wrong-password' },
    }),
    (error) => error?.status === 401 && error?.code === 'invalid_credentials',
  );

  assert.equal(authFailureHandler.mock.callCount(), 0);

  setAuthFailureHandler(null);
});

test('apiRequest forwards AbortSignal to fetch', async (t) => {
  const controller = new AbortController();
  globalThis.fetch = t.mock.fn(async () => createJsonResponse({
    ok: true,
    status: 200,
    payload: { ok: true },
  }));

  await apiRequest('/api/v1/metadata/artists/local-artist-1', {
    signal: controller.signal,
  });

  assert.equal(globalThis.fetch.mock.callCount(), 1);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].signal, controller.signal);
});

test('apiRequest tags aborted fetch errors with request_aborted', async (t) => {
  globalThis.fetch = t.mock.fn(async () => {
    const error = new Error('The operation was aborted');
    error.name = 'AbortError';
    throw error;
  });

  await assert.rejects(
    () => apiRequest('/api/v1/metadata/artists/local-artist-1'),
    (error) => error?.name === 'AbortError' && error?.code === 'request_aborted',
  );
});