import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthModule, createRequestAuthDependencies } from '../../src/server/auth-module.js';

test('createRequestAuthDependencies exposes shared request auth helpers from overrides', () => {
  const overrides = {
    getRequestMetadata: () => {},
    getSessionFromRequest: () => {},
    requireAdminSession: () => {},
    requireFreshAdminSession: () => {},
    requireFreshSession: () => {},
    requireCsrf: () => {},
    requireSession: () => {},
  };

  const requestAuthDependencies = createRequestAuthDependencies(overrides);

  assert.deepEqual(requestAuthDependencies, overrides);
});

test('createAuthModule exposes shared auth route dependencies from overrides', () => {
  const changePassword = async () => {};
  const createActiveSessionsResponse = () => {};
  const createPasswordChangedResponse = () => {};
  const createRecentActivityResponse = () => {};
  const createSessionRevokedResponse = () => {};
  const listActiveSessions = async () => {};
  const listRecentActivity = async () => {};
  const revokeSession = async () => {};
  const overrides = {
    buildBootstrapStatusPayload: () => {},
    buildSessionPayload: () => {},
    changePassword,
    clearAuthCookies: () => {},
    createActiveSessionsResponse,
    createAuthenticatedResponse: () => {},
    createBootstrapAdmin: () => {},
    createBootstrapStatusResponse: () => {},
    createLogoutResponse: () => {},
    createPasswordChangedResponse,
    createRecentActivityResponse,
    createRefreshResponse: () => {},
    createSessionResponse: () => {},
    createSessionRevokedResponse,
    getRequestMetadata: () => {},
    getSessionFromRequest: () => {},
    isBootstrapRequired: () => {},
    listActiveSessions,
    listRecentActivity,
    loginUser: () => {},
    logoutSession: () => {},
    requireAdminSession: () => {},
    requireFreshAdminSession: () => {},
    requireFreshSession: () => {},
    requireCsrf: () => {},
    requireSession: () => {},
    revokeSession,
    rotateSession: () => {},
    setAuthCookies: () => {},
  };

  const accountSecurityService = {
    changePassword,
    listActiveSessions,
    listRecentActivity,
    revokeSession,
  };

  const authModule = createAuthModule({ accountSecurityService, ...overrides });

  assert.deepEqual(authModule.routeDependencies, overrides);
});