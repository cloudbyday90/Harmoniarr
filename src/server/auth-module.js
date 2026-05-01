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

import {
  buildSessionPayload,
  clearAuthCookies,
  createBootstrapAdmin,
  getRequestMetadata,
  getSessionFromRequest,
  isBootstrapRequired,
  loginUser,
  logoutSession,
  requireCsrf,
  requireSession,
  rotateSession,
  setAuthCookies,
} from './auth.js';
import { createBootstrapStatusService } from './bootstrap-status-service.js';
import {
  createAuthenticatedResponse,
  createBootstrapStatusResponse,
  createLogoutResponse,
  createRefreshResponse,
  createSessionResponse,
} from './auth-response.js';

export function createRequestAuthDependencies(overrides = {}) {
  return {
    getRequestMetadata,
    getSessionFromRequest,
    requireCsrf,
    requireSession,
    ...overrides,
  };
}

export function createAuthModule({
  bootstrapStatusService,
  settingsService,
  ...overrides
} = {}) {
  const resolvedBootstrapStatusService = bootstrapStatusService
    ?? createBootstrapStatusService({ settingsService });

  return {
    routeDependencies: {
      buildSessionPayload,
      buildBootstrapStatusPayload: resolvedBootstrapStatusService.buildBootstrapStatusPayload,
      clearAuthCookies,
      createAuthenticatedResponse,
      createBootstrapAdmin,
      createBootstrapStatusResponse,
      createLogoutResponse,
      createRefreshResponse,
      createSessionResponse,
      isBootstrapRequired,
      loginUser,
      logoutSession,
      rotateSession,
      setAuthCookies,
      ...createRequestAuthDependencies(),
      ...overrides,
    },
  };
}