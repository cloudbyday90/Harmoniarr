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

import { createApiError } from '../auth.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute } from '../http.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

function normalizeSlskdError(error) {
  switch (error?.code) {
    case 'slskd_misconfigured':
      return createApiError(503, error.code, error.message);
    case 'slskd_unauthorized':
      return createApiError(503, error.code, 'slskd authentication failed');
    case 'slskd_unavailable':
      return createApiError(503, error.code, 'slskd is temporarily unavailable');
    case 'slskd_request_failed':
      return createApiError(502, error.code, error.message);
    default:
      return error;
  }
}

function slskdRoute(handler) {
  return asyncRoute(async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      throw normalizeSlskdError(error);
    }
  });
}

export function registerSlskdRoutes(app, {
  getConnectionStatus,
  getSearchResponses,
  getSearchState,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireSession = defaultRequestAuthDependencies.requireSession,
  startSearch,
}) {
  app.get('/api/v1/slskd/status', slskdRoute(async (request, response) => {
    await requireSession(request);
    response.json({
      ok: true,
      provider: 'slskd',
      status: await getConnectionStatus(),
    });
  }));

  app.post('/api/v1/slskd/searches', slskdRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);

    response.status(202).json({
      ok: true,
      provider: 'slskd',
      search: await startSearch({
        query: request.body?.query,
        fileLimit: request.body?.fileLimit,
        filterResponses: request.body?.filterResponses,
        responseLimit: request.body?.responseLimit,
        searchTimeoutMs: request.body?.searchTimeoutMs,
      }),
    });
  }));

  app.get('/api/v1/slskd/searches/:searchId', slskdRoute(async (request, response) => {
    await requireSession(request);
    response.json({
      ok: true,
      provider: 'slskd',
      search: await getSearchState({
        searchId: request.params.searchId,
        includeResponses: request.query.includeResponses,
      }),
    });
  }));

  app.get('/api/v1/slskd/searches/:searchId/responses', slskdRoute(async (request, response) => {
    await requireSession(request);
    const result = await getSearchResponses({
      searchId: request.params.searchId,
    });

    response.json({
      ok: true,
      provider: 'slskd',
      searchId: result.searchId,
      responses: result.responses,
    });
  }));
}
