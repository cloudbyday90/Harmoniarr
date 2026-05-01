import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { registerAuthRoutes } from '../../src/server/routes/auth-routes.js';
import { createJsonTestApp, withServer } from '../../testing/server/http-test-helpers.js';

function createAuthRouteTestApp(overrides = {}) {
  return createJsonTestApp((app) => {
    registerAuthRoutes(app, {
      buildBootstrapStatusPayload: async () => ({ bootstrapRequired: false }),
      buildSessionPayload: async () => ({ bootstrapRequired: false, user: null, csrfToken: null }),
      clearAuthCookies: () => {},
      createAuthenticatedResponse: (user, issuedSession) => ({
        ok: true,
        bootstrapRequired: false,
        user,
        csrfToken: issuedSession.csrfToken,
      }),
      createBootstrapAdmin: async () => ({
        user: { id: 'user-1', username: 'admin' },
        issuedSession: { refreshToken: 'refresh-1', csrfToken: 'csrf-1' },
      }),
      createBootstrapStatusResponse: (payload) => ({ ok: true, ...payload }),
      createLogoutResponse: () => ({ ok: true }),
      createRefreshResponse: (user, issuedSession) => ({ ok: true, bootstrapRequired: false, user, csrfToken: issuedSession.csrfToken }),
      createSessionResponse: (payload) => ({ ok: true, ...payload }),
      getRequestMetadata: (request) => ({
        ipAddress: request.headers['x-forwarded-for'] ?? '127.0.0.1',
        userAgent: request.headers['user-agent'] ?? null,
      }),
      getSessionFromRequest: async () => null,
      loginUser: async ({ username, password, requestMetadata }) => ({
        user: { id: 'user-1', username, password },
        issuedSession: { refreshToken: 'refresh-1', csrfToken: requestMetadata.userAgent ?? 'csrf-1' },
      }),
      logoutSession: async () => {},
      requireCsrf: () => {},
      requireSession: async () => ({ appUserId: 'user-1', user: { id: 'user-1', username: 'admin' } }),
      rotateSession: async () => ({ refreshToken: 'refresh-2', csrfToken: 'csrf-2' }),
      setAuthCookies: () => {},
      ...overrides,
    });
  });
}

test('auth bootstrap status route returns the shared bootstrap response', async () => {
  const app = createAuthRouteTestApp({
    buildBootstrapStatusPayload: async () => ({
      bootstrapRequired: true,
      pathValidation: {
        checkedAt: '2026-04-30T21:00:00.000Z',
        configuredDownloadMappings: 1,
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
    }),
    createBootstrapStatusResponse: (payload) => ({ ok: true, ...payload, source: 'shared' }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/bootstrap/status`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      bootstrapRequired: true,
      pathValidation: {
        checkedAt: '2026-04-30T21:00:00.000Z',
        configuredDownloadMappings: 1,
        summary: {
          status: 'degraded',
          message: 'Validation needs attention',
        },
      },
      source: 'shared',
    });
  });
});

test('auth login route passes request metadata to the injected shared login service', async (t) => {
  const loginUser = t.mock.fn(async ({ username, password, requestMetadata }) => ({
    user: { id: 'user-4', username },
    issuedSession: { refreshToken: 'refresh-4', csrfToken: 'csrf-4', requestMetadata, password },
  }));
  const setAuthCookies = t.mock.fn();

  const app = createAuthRouteTestApp({
    loginUser,
    setAuthCookies,
    createAuthenticatedResponse: (user, issuedSession) => ({
      ok: true,
      bootstrapRequired: false,
      user,
      csrfToken: issuedSession.csrfToken,
      source: issuedSession.requestMetadata,
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.44',
        'user-agent': 'HarmoniarrAuthTest/1.0',
      },
      body: JSON.stringify({ username: 'admin', password: 'secret-pass' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(loginUser.mock.callCount(), 1);
    assert.equal(setAuthCookies.mock.callCount(), 1);
    assert.deepEqual(loginUser.mock.calls[0].arguments, [{
      username: 'admin',
      password: 'secret-pass',
      requestMetadata: {
        ipAddress: '203.0.113.44',
        userAgent: 'HarmoniarrAuthTest/1.0',
      },
    }]);
    assert.equal(setAuthCookies.mock.calls[0].arguments[1], 'refresh-4');
    assert.equal(setAuthCookies.mock.calls[0].arguments[2], 'csrf-4');
    assert.deepEqual(payload, {
      ok: true,
      bootstrapRequired: false,
      user: { id: 'user-4', username: 'admin' },
      csrfToken: 'csrf-4',
      source: {
        ipAddress: '203.0.113.44',
        userAgent: 'HarmoniarrAuthTest/1.0',
      },
    });
  });
});

test('auth bootstrap admin route creates the bootstrap user through shared dependencies', async (t) => {
  const createBootstrapAdmin = t.mock.fn(async ({ username, password, requestMetadata }) => ({
    user: { id: 'user-bootstrap', username },
    issuedSession: { refreshToken: 'refresh-bootstrap', csrfToken: 'csrf-bootstrap', password, requestMetadata },
  }));
  const setAuthCookies = t.mock.fn();

  const app = createAuthRouteTestApp({
    createBootstrapAdmin,
    setAuthCookies,
    createAuthenticatedResponse: (user, issuedSession) => ({
      ok: true,
      bootstrapRequired: false,
      user,
      csrfToken: issuedSession.csrfToken,
      requestMetadata: issuedSession.requestMetadata,
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/bootstrap/admin`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.20',
        'user-agent': 'HarmoniarrBootstrapTest/1.0',
      },
      body: JSON.stringify({ username: 'root-admin', password: 'bootstrap-pass' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(createBootstrapAdmin.mock.callCount(), 1);
    assert.equal(setAuthCookies.mock.callCount(), 1);
    assert.deepEqual(createBootstrapAdmin.mock.calls[0].arguments, [{
      username: 'root-admin',
      password: 'bootstrap-pass',
      requestMetadata: {
        ipAddress: '198.51.100.20',
        userAgent: 'HarmoniarrBootstrapTest/1.0',
      },
    }]);
    assert.equal(setAuthCookies.mock.calls[0].arguments[1], 'refresh-bootstrap');
    assert.equal(setAuthCookies.mock.calls[0].arguments[2], 'csrf-bootstrap');
    assert.deepEqual(payload, {
      ok: true,
      bootstrapRequired: false,
      user: { id: 'user-bootstrap', username: 'root-admin' },
      csrfToken: 'csrf-bootstrap',
      requestMetadata: {
        ipAddress: '198.51.100.20',
        userAgent: 'HarmoniarrBootstrapTest/1.0',
      },
    });
  });
});

test('auth refresh route rotates the session through shared dependencies', async (t) => {
  const session = { appUserId: 'user-8', user: { id: 'user-8', username: 'refresh-user' } };
  const requireSession = t.mock.fn(async () => session);
  const rotateSession = t.mock.fn(async (activeSession, requestMetadata) => ({
    refreshToken: 'refresh-next',
    csrfToken: 'csrf-next',
    activeSession,
    requestMetadata,
  }));
  const setAuthCookies = t.mock.fn();

  const app = createAuthRouteTestApp({
    requireSession,
    rotateSession,
    setAuthCookies,
    createRefreshResponse: (user, issuedSession) => ({
      ok: true,
      bootstrapRequired: false,
      user,
      csrfToken: issuedSession.csrfToken,
      requestMetadata: issuedSession.requestMetadata,
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.77',
        'user-agent': 'HarmoniarrRefreshTest/1.0',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requireSession.mock.callCount(), 1);
    assert.equal(rotateSession.mock.callCount(), 1);
    assert.equal(setAuthCookies.mock.callCount(), 1);
    assert.equal(rotateSession.mock.calls[0].arguments[0], session);
    assert.deepEqual(rotateSession.mock.calls[0].arguments[1], {
      ipAddress: '203.0.113.77',
      userAgent: 'HarmoniarrRefreshTest/1.0',
    });
    assert.equal(setAuthCookies.mock.calls[0].arguments[1], 'refresh-next');
    assert.equal(setAuthCookies.mock.calls[0].arguments[2], 'csrf-next');
    assert.deepEqual(payload, {
      ok: true,
      bootstrapRequired: false,
      user: { id: 'user-8', username: 'refresh-user' },
      csrfToken: 'csrf-next',
      requestMetadata: {
        ipAddress: '203.0.113.77',
        userAgent: 'HarmoniarrRefreshTest/1.0',
      },
    });
  });
});

test('auth logout route enforces csrf, records logout, and clears auth cookies when a session exists', async (t) => {
  const session = { sessionId: 'session-9', csrfToken: 'csrf-logout', user: { id: 'user-9', username: 'logout-user' } };
  const getSessionFromRequest = t.mock.fn(async () => session);
  const requireCsrf = t.mock.fn();
  const logoutSession = t.mock.fn(async () => {});
  const clearAuthCookies = t.mock.fn();

  const app = createAuthRouteTestApp({
    getSessionFromRequest,
    requireCsrf,
    logoutSession,
    clearAuthCookies,
    createLogoutResponse: () => ({ ok: true, source: 'shared-logout' }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.0.2.60',
        'user-agent': 'HarmoniarrLogoutTest/1.0',
        'x-csrf-token': 'csrf-logout',
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getSessionFromRequest.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 1);
    assert.equal(logoutSession.mock.callCount(), 1);
    assert.equal(clearAuthCookies.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.calls[0].arguments[1], session);
    assert.equal(logoutSession.mock.calls[0].arguments[0], session);
    assert.deepEqual(logoutSession.mock.calls[0].arguments[1], {
      ipAddress: '192.0.2.60',
      userAgent: 'HarmoniarrLogoutTest/1.0',
    });
    assert.deepEqual(payload, { ok: true, source: 'shared-logout' });
  });
});

test('auth logout route still clears auth cookies without session-dependent work when no session exists', async (t) => {
  const getSessionFromRequest = t.mock.fn(async () => null);
  const requireCsrf = t.mock.fn();
  const logoutSession = t.mock.fn(async () => {});
  const clearAuthCookies = t.mock.fn();

  const app = createAuthRouteTestApp({
    getSessionFromRequest,
    requireCsrf,
    logoutSession,
    clearAuthCookies,
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/logout`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(getSessionFromRequest.mock.callCount(), 1);
    assert.equal(requireCsrf.mock.callCount(), 0);
    assert.equal(logoutSession.mock.callCount(), 0);
    assert.equal(clearAuthCookies.mock.callCount(), 1);
    assert.deepEqual(payload, { ok: true });
  });
});

test('auth session route returns the shared session payload', async () => {
  const app = createAuthRouteTestApp({
    buildSessionPayload: async () => ({
      bootstrapRequired: false,
      user: { id: 'user-7', username: 'session-user' },
      csrfToken: 'csrf-session',
    }),
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/session`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
      ok: true,
      bootstrapRequired: false,
      user: { id: 'user-7', username: 'session-user' },
      csrfToken: 'csrf-session',
    });
  });
});

test('auth login route preserves injected api errors in the shared json error response', async () => {
  const app = createAuthRouteTestApp({
    loginUser: async () => {
      throw createApiError(401, 'invalid_credentials', 'Invalid username or password');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ username: 'admin', password: 'wrong-pass' }),
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'invalid_credentials',
        message: 'Invalid username or password',
      },
    });
  });
});

test('auth refresh route preserves auth-required failures from the injected session guard', async () => {
  const app = createAuthRouteTestApp({
    requireSession: async () => {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
    });
    const payload = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(payload, {
      ok: false,
      error: {
        code: 'auth_required',
        message: 'Authentication is required',
      },
    });
  });
});