import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthModule, createRequestAuthDependencies } from '../../src/server/auth-module.js';

test('createRequestAuthDependencies exposes shared request auth helpers from overrides', () => {
  const overrides = {
    getRequestMetadata: () => {},
    getSessionFromRequest: () => {},
    requireCsrf: () => {},
    requireSession: () => {},
  };

  const requestAuthDependencies = createRequestAuthDependencies(overrides);

  assert.deepEqual(requestAuthDependencies, overrides);
});

test('createAuthModule exposes shared auth route dependencies from overrides', () => {
  const overrides = {
    buildBootstrapStatusPayload: () => {},
    buildSessionPayload: () => {},
    clearAuthCookies: () => {},
    createAuthenticatedResponse: () => {},
    createBootstrapAdmin: () => {},
    createBootstrapStatusResponse: () => {},
    createLogoutResponse: () => {},
    createRefreshResponse: () => {},
    createSessionResponse: () => {},
    getRequestMetadata: () => {},
    getSessionFromRequest: () => {},
    isBootstrapRequired: () => {},
    loginUser: () => {},
    logoutSession: () => {},
    requireCsrf: () => {},
    requireSession: () => {},
    rotateSession: () => {},
    setAuthCookies: () => {},
  };

  const authModule = createAuthModule(overrides);

  assert.deepEqual(authModule.routeDependencies, overrides);
});