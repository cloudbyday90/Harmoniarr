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

function optionalQueryString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildActorUser(session) {
  return {
    id: session.appUserId,
    isDisabled: session.user?.isDisabled === true,
    role: session.user?.role ?? null,
    username: session.user?.username ?? null,
  };
}

export function registerMissingMusicRoutes(app, {
  executeIdempotentMutation = async ({ executeMutation }) => executeMutation(),
  getMissingMusicDecisionDetail,
  getMissingMusicDownloaderHandoff,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  limitMissingMusicDecisionDetailRead = skipRateLimitMiddleware,
  limitMissingMusicDecisionDownloadStart = skipRateLimitMiddleware,
  limitMissingMusicDecisionRead = skipRateLimitMiddleware,
  limitMissingMusicDecisionMutation = skipRateLimitMiddleware,
  listMissingMusicDecisions,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireFreshSession = defaultRequestAuthDependencies.requireFreshSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  selectMissingMusicDecisionMatch,
  startMissingMusicDecisionDownload,
} = {}) {
  if (typeof getMissingMusicDecisionDetail !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires getMissingMusicDecisionDetail');
  }

  if (typeof getMissingMusicDownloaderHandoff !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires getMissingMusicDownloaderHandoff');
  }

  if (typeof listMissingMusicDecisions !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires listMissingMusicDecisions');
  }

  if (typeof selectMissingMusicDecisionMatch !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires selectMissingMusicDecisionMatch');
  }

  if (typeof startMissingMusicDecisionDownload !== 'function') {
    throw new TypeError('registerMissingMusicRoutes requires startMissingMusicDecisionDownload');
  }

  app.get('/api/v1/missing-music/decisions', limitMissingMusicDecisionRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await listMissingMusicDecisions({
      accountStatus: optionalQueryString(request.query.accountStatus),
      actorUser: buildActorUser(session),
      limit: sanitizePageLimit(request.query.limit, { default: 50, max: 100 }),
      offset: sanitizePageOffset(request.query.offset),
      q: optionalQueryString(request.query.q),
      requestedForUserId: optionalQueryString(request.query.requestedForUserId),
      scope: optionalQueryString(request.query.scope),
      state: optionalQueryString(request.query.state),
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.get('/api/v1/missing-music/decisions/:decisionId', limitMissingMusicDecisionDetailRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await getMissingMusicDecisionDetail({
      actorUser: buildActorUser(session),
      decisionId: request.params.decisionId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.get('/api/v1/missing-music/decisions/:decisionId/downloader-handoff', limitMissingMusicDecisionDetailRead, asyncRoute(async (request, response) => {
    const session = await requireAdminSession(request);
    const payload = await getMissingMusicDownloaderHandoff({
      actorUser: buildActorUser(session),
      decisionId: request.params.decisionId,
    });

    response.json({
      ok: true,
      ...payload,
    });
  }));

  app.post('/api/v1/missing-music/decisions/:decisionId/matches/:matchId/select', limitMissingMusicDecisionMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshSession(request);
    requireCsrf(request, session);
    const actorUser = buildActorUser(session);
    const result = await executeIdempotentMutation({
      actorUserId: actorUser.id,
      executeMutation: async () => ({
        body: await selectMissingMusicDecisionMatch({
          actorUser,
          decisionId: request.params.decisionId,
          matchId: request.params.matchId,
          requestMetadata: getRequestMetadata(request),
        }),
        statusCode: 200,
      }),
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'missing-music.decisions.matches.select',
      requestPayload: {
        decisionId: request.params.decisionId,
        matchId: request.params.matchId,
      },
    });

    response.status(result?.statusCode ?? 200).json({
      ok: true,
      ...(result?.body ?? {}),
    });
  }));

  app.post('/api/v1/missing-music/decisions/:decisionId/start-download', limitMissingMusicDecisionDownloadStart, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);
    const actorUser = buildActorUser(session);
    const result = await executeIdempotentMutation({
      actorUserId: actorUser.id,
      executeMutation: async () => ({
        body: await startMissingMusicDecisionDownload({
          actorUser,
          decisionId: request.params.decisionId,
          requestMetadata: getRequestMetadata(request),
        }),
        statusCode: 202,
      }),
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'missing-music.decisions.download.start',
      requestPayload: {
        decisionId: request.params.decisionId,
      },
    });

    response.status(result?.statusCode ?? 202).json({
      ok: true,
      ...(result?.body ?? {}),
    });
  }));
}
