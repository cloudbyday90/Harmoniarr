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
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerArtworkRoutes(app, {
  buildArtworkCleanupHistory,
  buildArtworkCleanupRunDetail,
  buildArtworkSummary,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  limitArtworkCleanupRun = skipRateLimitMiddleware,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  startArtworkCleanupRun,
}) {
  app.get('/api/v1/artwork/summary', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkSummary());
  }));

  app.get('/api/v1/artwork/cleanup-runs', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkCleanupHistory({
      limit: request.query.limit,
    }));
  }));

  app.get('/api/v1/artwork/cleanup-runs/:runId', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkCleanupRunDetail({
      runId: request.params.runId,
    }));
  }));

  app.post('/api/v1/artwork/cleanup-runs', limitArtworkCleanupRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startArtworkCleanupRun({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));
}