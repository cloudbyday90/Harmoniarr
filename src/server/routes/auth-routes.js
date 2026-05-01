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
  buildSessionPayload as defaultBuildSessionPayload,
  clearAuthCookies as defaultClearAuthCookies,
  createBootstrapAdmin as defaultCreateBootstrapAdmin,
  loginUser as defaultLoginUser,
  logoutSession as defaultLogoutSession,
  rotateSession as defaultRotateSession,
  setAuthCookies as defaultSetAuthCookies,
} from '../auth.js';
import { createBootstrapStatusService } from '../bootstrap-status-service.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import {
  createAuthenticatedResponse as defaultCreateAuthenticatedResponse,
  createBootstrapStatusResponse as defaultCreateBootstrapStatusResponse,
  createLogoutResponse as defaultCreateLogoutResponse,
  createRefreshResponse as defaultCreateRefreshResponse,
  createSessionResponse as defaultCreateSessionResponse,
} from '../auth-response.js';
import { asyncRoute } from '../http.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();
const defaultBootstrapStatusService = createBootstrapStatusService();

export function registerAuthRoutes(app, {
  buildSessionPayload = defaultBuildSessionPayload,
  buildBootstrapStatusPayload = defaultBootstrapStatusService.buildBootstrapStatusPayload,
  clearAuthCookies = defaultClearAuthCookies,
  createAuthenticatedResponse = defaultCreateAuthenticatedResponse,
  createBootstrapAdmin = defaultCreateBootstrapAdmin,
  createBootstrapStatusResponse = defaultCreateBootstrapStatusResponse,
  createLogoutResponse = defaultCreateLogoutResponse,
  createRefreshResponse = defaultCreateRefreshResponse,
  createSessionResponse = defaultCreateSessionResponse,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getSessionFromRequest = defaultRequestAuthDependencies.getSessionFromRequest,
  loginUser = defaultLoginUser,
  logoutSession = defaultLogoutSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireSession = defaultRequestAuthDependencies.requireSession,
  rotateSession = defaultRotateSession,
  setAuthCookies = defaultSetAuthCookies,
} = {}) {
  app.get('/api/v1/bootstrap/status', asyncRoute(async (_request, response) => {
    response.json(createBootstrapStatusResponse(await buildBootstrapStatusPayload()));
  }));

  app.post('/api/v1/bootstrap/admin', asyncRoute(async (request, response) => {
    const requestMetadata = getRequestMetadata(request);
    const { user, issuedSession } = await createBootstrapAdmin({
      username: request.body?.username,
      password: request.body?.password,
      requestMetadata,
    });
    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.status(201).json(createAuthenticatedResponse(user, issuedSession));
  }));

  app.post('/api/v1/auth/login', asyncRoute(async (request, response) => {
    const requestMetadata = getRequestMetadata(request);
    const { user, issuedSession } = await loginUser({
      username: request.body?.username,
      password: request.body?.password,
      requestMetadata,
    });
    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.json(createAuthenticatedResponse(user, issuedSession));
  }));

  app.post('/api/v1/auth/refresh', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const requestMetadata = getRequestMetadata(request);
    const issuedSession = await rotateSession(session, requestMetadata);

    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.json(createRefreshResponse(session.user, issuedSession));
  }));

  app.post('/api/v1/auth/logout', asyncRoute(async (request, response) => {
    const session = await getSessionFromRequest(request);
    if (session) {
      requireCsrf(request, session);
      await logoutSession(session, getRequestMetadata(request));
    }

    clearAuthCookies(response);
    response.json(createLogoutResponse());
  }));

  app.get('/api/v1/auth/session', asyncRoute(async (request, response) => {
    response.json(createSessionResponse(await buildSessionPayload(request)));
  }));
}