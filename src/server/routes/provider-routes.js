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

import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute } from '../http.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

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

function withRequestOrigin(request, getRequestMetadata) {
  return {
    ...getRequestMetadata(request),
    origin: requestOrigin(request),
  };
}

function settingsRedirectUrl(provider, status, code = null) {
  const url = new URL('/app/settings', 'http://harmoniarr.local');
  url.searchParams.set(`${provider}OAuth`, status);
  if (code) {
    url.searchParams.set('code', code);
  }

  return `${url.pathname}${url.search}`;
}

export function registerProviderRoutes(app, {
  buildAppleMusicStatus,
  buildSpotifyOAuthStatus,
  buildYoutubeOAuthStatus,
  clearSpotifyAuthorization,
  clearYoutubeAuthorization,
  completeSpotifyAuthorization,
  completeYoutubeAuthorization,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  startSpotifyAuthorization,
  startYoutubeAuthorization,
}) {
  app.get('/api/v1/providers/status', asyncRoute(async (request, response) => {
    const session = await requireSession(request);

    const [spotify, youtube, appleMusic] = await Promise.all([
      buildSpotifyOAuthStatus(),
      buildYoutubeOAuthStatus(),
      buildAppleMusicStatus(),
    ]);

    response.json({
      appleMusic,
      spotify,
      youtube,
    });
  }));

  app.post('/api/v1/providers/spotify/oauth/start', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.status(202).json({
      ok: true,
      ...(await startSpotifyAuthorization({
        actorUserId: session.appUserId,
        requestMetadata: withRequestOrigin(request, getRequestMetadata),
      })),
    });
  }));

  app.post('/api/v1/providers/youtube/oauth/start', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.status(202).json({
      ok: true,
      ...(await startYoutubeAuthorization({
        actorUserId: session.appUserId,
        requestMetadata: withRequestOrigin(request, getRequestMetadata),
      })),
    });
  }));

  app.post('/api/v1/providers/spotify/oauth/clear', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.json({
      ok: true,
      ...(await clearSpotifyAuthorization({
        actorUserId: session.appUserId,
        requestMetadata: getRequestMetadata(request),
      })),
    });
  }));

  app.post('/api/v1/providers/youtube/oauth/clear', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.json({
      ok: true,
      ...(await clearYoutubeAuthorization({
        actorUserId: session.appUserId,
        requestMetadata: getRequestMetadata(request),
      })),
    });
  }));

  app.get('/api/v1/providers/spotify/oauth/callback', asyncRoute(async (request, response) => {
    try {
      await completeSpotifyAuthorization({
        code: request.query.code,
        requestMetadata: getRequestMetadata(request),
        state: request.query.state,
      });
      response.redirect(303, settingsRedirectUrl('spotify', 'linked'));
    } catch (error) {
      response.redirect(303, settingsRedirectUrl('spotify', 'failed', error?.code ?? 'spotify_oauth_failed'));
    }
  }));

  app.get('/api/v1/providers/youtube/oauth/callback', asyncRoute(async (request, response) => {
    try {
      await completeYoutubeAuthorization({
        code: request.query.code,
        requestMetadata: getRequestMetadata(request),
        state: request.query.state,
      });
      response.redirect(303, settingsRedirectUrl('youtube', 'linked'));
    } catch (error) {
      response.redirect(303, settingsRedirectUrl('youtube', 'failed', error?.code ?? 'youtube_oauth_failed'));
    }
  }));
}
