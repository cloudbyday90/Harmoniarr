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

export function registerOperationsRoutes(app, {
  buildOperationHistory,
  buildOperationRunDetail,
  requestOperationRunCancellation,
  requestOperationRunRetry,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
}) {
  app.get('/api/v1/operations/history', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildOperationHistory({
      limit: request.query.limit,
    }));
  }));

  app.get('/api/v1/operations/runs/:runId', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json({
      ok: true,
      operationRun: await buildOperationRunDetail({
        auditLimit: request.query.auditLimit,
        runId: request.params.runId,
      }),
    });
  }));

  app.post('/api/v1/operations/runs/:runId/cancel', asyncRoute(async (request, response) => {
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

  app.post('/api/v1/operations/runs/:runId/retry', asyncRoute(async (request, response) => {
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