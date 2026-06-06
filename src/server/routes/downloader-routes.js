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
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

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

function downloaderRoute(handler) {
  return asyncRoute(async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      throw normalizeSlskdError(error);
    }
  });
}

export function registerDownloaderRoutes(app, {
  buildDownloaderQueue,
  limitDownloaderQueueRead = skipRateLimitMiddleware,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
}) {
  app.get('/api/v1/downloader/queue', limitDownloaderQueueRead, downloaderRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json({
      ok: true,
      downloader: await buildDownloaderQueue({
        includeRemoved: request.query.includeRemoved,
      }),
    });
  }));
}
