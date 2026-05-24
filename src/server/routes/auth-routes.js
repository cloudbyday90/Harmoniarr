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
import { createAccountSecurityService } from '../account-security-service.js';
import { createBootstrapStatusService } from '../bootstrap-status-service.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import {
  createActiveSessionsResponse as defaultCreateActiveSessionsResponse,
  createAuthenticatedResponse as defaultCreateAuthenticatedResponse,
  createBootstrapStatusResponse as defaultCreateBootstrapStatusResponse,
  createClaimCompletedResponse as defaultCreateClaimCompletedResponse,
  createLogoutResponse as defaultCreateLogoutResponse,
  createPasswordChangedResponse as defaultCreatePasswordChangedResponse,
  createRecentActivityResponse as defaultCreateRecentActivityResponse,
  createRefreshResponse as defaultCreateRefreshResponse,
  createSessionResponse as defaultCreateSessionResponse,
  createSessionRevokedResponse as defaultCreateSessionRevokedResponse,
} from '../auth-response.js';
import { asyncRoute } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultAccountSecurityService = createAccountSecurityService();
const defaultRequestAuthDependencies = createRequestAuthDependencies();
const defaultBootstrapStatusService = createBootstrapStatusService();

function requestOrigin(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const proto = typeof forwardedProto === 'string'
    ? forwardedProto.split(',')[0].trim()
    : request.protocol;
  const host = typeof forwardedHost === 'string'
    ? forwardedHost.split(',')[0].trim()
    : request.headers.host;

  return host ? `${proto}://${host}` : null;
}

export function registerAuthRoutes(app, {
  buildSessionPayload = defaultBuildSessionPayload,
  buildBootstrapStatusPayload = defaultBootstrapStatusService.buildBootstrapStatusPayload,
  changePassword = defaultAccountSecurityService.changePassword,
  clearAuthCookies = defaultClearAuthCookies,
  completePlexSignIn = null,
  completeAppUserClaim = null,
  createActiveSessionsResponse = defaultCreateActiveSessionsResponse,
  createAuthenticatedResponse = defaultCreateAuthenticatedResponse,
  createBootstrapAdmin = defaultCreateBootstrapAdmin,
  createBootstrapStatusResponse = defaultCreateBootstrapStatusResponse,
  createClaimCompletedResponse = defaultCreateClaimCompletedResponse,
  createLogoutResponse = defaultCreateLogoutResponse,
  createPasswordChangedResponse = defaultCreatePasswordChangedResponse,
  createRecentActivityResponse = defaultCreateRecentActivityResponse,
  createRefreshResponse = defaultCreateRefreshResponse,
  createSessionResponse = defaultCreateSessionResponse,
  createSessionRevokedResponse = defaultCreateSessionRevokedResponse,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getSessionFromRequest = defaultRequestAuthDependencies.getSessionFromRequest,
  listActiveSessions = defaultAccountSecurityService.listActiveSessions,
  listRecentActivity = defaultAccountSecurityService.listRecentActivity,
  limitBootstrapAdmin = skipRateLimitMiddleware,
  limitChangePassword = skipRateLimitMiddleware,
  limitClaimComplete = skipRateLimitMiddleware,
  limitLogin = skipRateLimitMiddleware,
  limitPlexSignInCallback = skipRateLimitMiddleware,
  limitPlexSignInStart = skipRateLimitMiddleware,
  limitRefresh = skipRateLimitMiddleware,
  limitSessionRevoke = skipRateLimitMiddleware,
  loginUser = defaultLoginUser,
  logoutSession = defaultLogoutSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshSession = defaultRequestAuthDependencies.requireFreshSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  revokeSession = defaultAccountSecurityService.revokeSession,
  rotateSession = defaultRotateSession,
  setAuthCookies = defaultSetAuthCookies,
  startPlexSignIn = null,
} = {}) {
  function loginRedirectUrl({ code = null, reason = null, redirect = null } = {}) {
    const url = new URL('/login', 'http://harmoniarr.local');
    if (reason) {
      url.searchParams.set('reason', reason);
    }
    if (code) {
      url.searchParams.set('code', code);
    }
    if (redirect) {
      url.searchParams.set('redirect', redirect);
    }

    return `${url.pathname}${url.search}`;
  }

  app.get('/api/v1/bootstrap/status', asyncRoute(async (_request, response) => {
    response.json(createBootstrapStatusResponse(await buildBootstrapStatusPayload()));
  }));

  app.post('/api/v1/bootstrap/admin', limitBootstrapAdmin, asyncRoute(async (request, response) => {
    const requestMetadata = getRequestMetadata(request);
    const { user, issuedSession } = await createBootstrapAdmin({
      claimCode: request.body?.claimCode,
      email: request.body?.email,
      username: request.body?.username,
      password: request.body?.password,
      requestMetadata,
    });
    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.status(201).json(createAuthenticatedResponse(user, issuedSession));
  }));

  app.post('/api/v1/auth/login', limitLogin, asyncRoute(async (request, response) => {
    const requestMetadata = getRequestMetadata(request);
    const { user, issuedSession } = await loginUser({
      username: request.body?.username,
      password: request.body?.password,
      requestMetadata,
    });
    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.json(createAuthenticatedResponse(user, issuedSession));
  }));

  if (typeof startPlexSignIn === 'function') {
    app.post('/api/v1/auth/plex/start', limitPlexSignInStart, asyncRoute(async (request, response) => {
      const requestMetadata = getRequestMetadata(request);
      response.status(202).json({
        ok: true,
        ...(await startPlexSignIn({
          redirectTo: request.body?.redirect,
          requestMetadata: {
            ...requestMetadata,
            origin: requestOrigin(request),
          },
        })),
      });
    }));
  }

  if (typeof completePlexSignIn === 'function') {
    app.get('/api/v1/auth/plex/callback', limitPlexSignInCallback, asyncRoute(async (request, response) => {
      try {
        const { issuedSession, redirectTo } = await completePlexSignIn({
          requestMetadata: getRequestMetadata(request),
          state: request.query.state,
        });
        setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);
        response.redirect(303, redirectTo);
      } catch (error) {
        response.redirect(303, loginRedirectUrl({
          code: error?.code ?? 'plex_sign_in_failed',
          reason: error?.code === 'plex_sign_in_restricted_account'
            ? 'plex-sign-in-restricted'
            : error?.code === 'plex_sign_in_not_linked'
              ? 'plex-sign-in-not-linked'
              : 'plex-sign-in-failed',
        }));
      }
    }));
  }

  app.post('/api/v1/auth/refresh', limitRefresh, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    const requestMetadata = getRequestMetadata(request);
    const issuedSession = await rotateSession(session, requestMetadata);

    setAuthCookies(response, issuedSession.refreshToken, issuedSession.csrfToken);

    response.json(createRefreshResponse(session.user, issuedSession));
  }));

  app.post('/api/v1/auth/change-password', limitChangePassword, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);
    const requestMetadata = getRequestMetadata(request);
    const result = await changePassword({
      currentPassword: request.body?.currentPassword,
      newPassword: request.body?.newPassword,
      requestMetadata,
      session,
    });

    setAuthCookies(response, result.issuedSession.refreshToken, result.issuedSession.csrfToken);
    response.json(createPasswordChangedResponse(result.user, result.issuedSession));
  }));

  if (typeof completeAppUserClaim === 'function') {
    app.post('/api/v1/auth/claim', limitClaimComplete, asyncRoute(async (request, response) => {
      response.status(201).json(createClaimCompletedResponse(await completeAppUserClaim({
        claimCode: request.body?.claimCode,
        password: request.body?.password,
        requestMetadata: getRequestMetadata(request),
        username: request.body?.username,
      })));
    }));
  }

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

  app.get('/api/v1/auth/sessions', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    response.json(createActiveSessionsResponse({
      sessions: await listActiveSessions({ session }),
    }));
  }));

  app.get('/api/v1/auth/activity', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    response.json(createRecentActivityResponse({
      events: await listRecentActivity({
        limit: request.query?.limit,
        session,
      }),
    }));
  }));

  app.post('/api/v1/auth/sessions/:refreshTokenId/revoke', limitSessionRevoke, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);
    response.json(createSessionRevokedResponse(await revokeSession({
      refreshTokenId: request.params.refreshTokenId,
      requestMetadata: getRequestMetadata(request),
      session,
    })));
  }));
}
