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
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerAcquisitionRoutes(app, {
  addMusicQueueReleaseToLibrary,
  allowMusicQueueReleaseFallbackQuality,
  executeIdempotentMutation = async ({ executeMutation }) => executeMutation(),
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getMusicQueueRelease,
  limitMusicQueueMutation = skipRateLimitMiddleware,
  limitMusicQueueRead = skipRateLimitMiddleware,
  listMusicQueueReleases,
  recheckMusicQueueReleaseSafeAdd,
  requestMusicQueueReleaseRediscovery,
  rejectMusicQueueMatch,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshSession = defaultRequestAuthDependencies.requireFreshSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  useMusicQueueMatch,
}) {
  app.get('/api/v1/acquisition/releases', limitMusicQueueRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await listMusicQueueReleases({
      appUserId: session.user?.id ?? session.appUserId,
      limit: sanitizePageLimit(request.query.limit, { default: 100, max: 500 }),
      metadataArtistId: typeof request.query.metadataArtistId === 'string'
        ? request.query.metadataArtistId.trim() || null
        : null,
      offset: sanitizePageOffset(request.query.offset),
    });
    response.json(payload);
  }));

  app.get('/api/v1/acquisition/releases/:wantedReleaseId', limitMusicQueueRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await getMusicQueueRelease({
      appUserId: session.user?.id ?? session.appUserId,
      wantedReleaseId: request.params.wantedReleaseId,
    });
    response.json(payload);
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/matches/:matchId/use', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const actorUserId = session.user?.id ?? session.appUserId;
    const result = await executeIdempotentMutation({
      actorUserId,
      executeMutation: async () => ({
        body: await useMusicQueueMatch({
          actorUserId,
          appUserId: actorUserId,
          matchId: request.params.matchId,
          reason: request.body?.reason,
          requestMetadata: getRequestMetadata(request),
          wantedReleaseId: request.params.wantedReleaseId,
        }),
        statusCode: 200,
      }),
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'acquisition.musicQueue.matches.use',
      requestPayload: {
        matchId: request.params.matchId,
        reason: request.body?.reason ?? null,
        wantedReleaseId: request.params.wantedReleaseId,
      },
    });

    response.status(result?.statusCode ?? 200).json({
      ok: true,
      ...(result?.body ?? {}),
    });
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/search-again', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const payload = await requestMusicQueueReleaseRediscovery({
      actorUserId: session.user?.id ?? session.appUserId,
      appUserId: session.user?.id ?? session.appUserId,
      requestMetadata: getRequestMetadata(request),
      wantedReleaseId: request.params.wantedReleaseId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/recheck-library-add', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const payload = await recheckMusicQueueReleaseSafeAdd({
      actorUserId: session.user?.id ?? session.appUserId,
      appUserId: session.user?.id ?? session.appUserId,
      requestMetadata: getRequestMetadata(request),
      wantedReleaseId: request.params.wantedReleaseId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/add-to-library', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const payload = await addMusicQueueReleaseToLibrary({
      actorUserId: session.user?.id ?? session.appUserId,
      appUserId: session.user?.id ?? session.appUserId,
      requestMetadata: getRequestMetadata(request),
      wantedReleaseId: request.params.wantedReleaseId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/allow-fallback-quality', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const payload = await allowMusicQueueReleaseFallbackQuality({
      actorUserId: session.user?.id ?? session.appUserId,
      appUserId: session.user?.id ?? session.appUserId,
      requestMetadata: getRequestMetadata(request),
      wantedReleaseId: request.params.wantedReleaseId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.post('/api/v1/acquisition/releases/:wantedReleaseId/matches/:matchId/reject', limitMusicQueueMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const payload = await rejectMusicQueueMatch({
      actorUserId: session.user?.id ?? session.appUserId,
      appUserId: session.user?.id ?? session.appUserId,
      matchId: request.params.matchId,
      reason: request.body?.reason,
      requestMetadata: getRequestMetadata(request),
      wantedReleaseId: request.params.wantedReleaseId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));
}
