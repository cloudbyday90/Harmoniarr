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
  getMusicQueueRelease,
  limitMusicQueueRead = skipRateLimitMiddleware,
  listMusicQueueReleases,
  requireSession = defaultRequestAuthDependencies.requireSession,
}) {
  app.get('/api/v1/acquisition/releases', limitMusicQueueRead, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const payload = await listMusicQueueReleases({
      appUserId: session.user?.id ?? session.appUserId,
      limit: sanitizePageLimit(request.query.limit, { default: 100, max: 500 }),
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
}
