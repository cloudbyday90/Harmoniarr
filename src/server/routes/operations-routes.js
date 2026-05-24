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
import { asyncRoute, sanitizePageLimit } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerOperationsRoutes(app, {
  buildOperationHistory,
  buildOperationRunDetail,
  limitOperationRunMutation = skipRateLimitMiddleware,
  requestOperationRunCancellation,
  requestOperationRunRetry,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
}) {
  app.get('/api/v1/operations/history', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildOperationHistory({
      limit: sanitizePageLimit(request.query.limit, { default: 20, max: 25 }),
    }));
  }));

  app.get('/api/v1/operations/runs/:runId', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json({
      ok: true,
      operationRun: await buildOperationRunDetail({
        auditLimit: sanitizePageLimit(request.query.auditLimit, { default: 20, max: 25 }),
        runId: request.params.runId,
      }),
    });
  }));

  app.post('/api/v1/operations/runs/:runId/cancel', limitOperationRunMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);
    response.json({
      ok: true,
      operationRun: await requestOperationRunCancellation({
        requestedByUserId: session.appUserId,
        runId: request.params.runId,
      }),
    });
  }));

  app.post('/api/v1/operations/runs/:runId/retry', limitOperationRunMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);
    response.json({
      ok: true,
      operationRun: await requestOperationRunRetry({
        requestedByUserId: session.appUserId,
        runId: request.params.runId,
      }),
    });
  }));
}