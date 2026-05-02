/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createAccountSecurityService } from './account-security-service.js';
import {
  buildSessionPayload,
  clearAuthCookies,
  createBootstrapAdmin,
  getRequestMetadata,
  getSessionFromRequest,
  isBootstrapRequired,
  loginUser,
  logoutSession,
  requireAdminSession,
  requireCsrf,
  requireFreshAdminSession,
  requireFreshSession,
  requireSession,
  rotateSession,
  setAuthCookies,
} from './auth.js';
import {
  createActiveSessionsResponse,
  createAuthenticatedResponse,
  createBootstrapStatusResponse,
  createLogoutResponse,
  createPasswordChangedResponse,
  createRecentActivityResponse,
  createRefreshResponse,
  createSessionResponse,
  createSessionRevokedResponse,
} from './auth-response.js';
import { createBootstrapStatusService } from './bootstrap-status-service.js';

export function createRequestAuthDependencies(overrides = {}) {
  return {
    getRequestMetadata,
    getSessionFromRequest,
    requireAdminSession,
    requireFreshAdminSession,
    requireFreshSession,
    requireCsrf,
    requireSession,
    ...overrides,
  };
}

export function createAuthModule({
  accountSecurityService,
  bootstrapStatusService,
  settingsService,
  ...overrides
} = {}) {
  const resolvedAccountSecurityService = accountSecurityService
    ?? createAccountSecurityService();
  const resolvedBootstrapStatusService = bootstrapStatusService
    ?? createBootstrapStatusService({ settingsService });

  return {
    routeDependencies: {
      buildSessionPayload,
      buildBootstrapStatusPayload: resolvedBootstrapStatusService.buildBootstrapStatusPayload,
      changePassword: resolvedAccountSecurityService.changePassword,
      clearAuthCookies,
      createActiveSessionsResponse,
      createAuthenticatedResponse,
      createBootstrapAdmin,
      createBootstrapStatusResponse,
      createLogoutResponse,
      createPasswordChangedResponse,
      createRecentActivityResponse,
      createRefreshResponse,
      createSessionResponse,
      createSessionRevokedResponse,
      isBootstrapRequired,
      listActiveSessions: resolvedAccountSecurityService.listActiveSessions,
      listRecentActivity: resolvedAccountSecurityService.listRecentActivity,
      loginUser,
      logoutSession,
      revokeSession: resolvedAccountSecurityService.revokeSession,
      rotateSession,
      setAuthCookies,
      ...createRequestAuthDependencies(),
      ...overrides,
    },
  };
}