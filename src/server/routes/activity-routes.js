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

/**
 * Registers the household activity feed routes.
 *
 * @param {import('express').Application} app
 * @param {object} deps
 * @param {function} deps.buildActivityFeed
 * @param {function} [deps.requireSession]
 */
export function registerActivityRoutes(app, {
  buildActivityFeed,
  blockSourceUser,
  listBlockedSourceUsers,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  unblockSourceUser,
}) {
  /**
   * GET /api/v1/activity/feed
   *
   * Returns the household-level activity event stream. All authenticated users
   * (admin and requester) can access the full household stream. Scope
   * (full-page vs. compact panel) is controlled at the client rendering layer.
   *
   * Query params:
   *   limit      {number}  Max events to return (1–200, default 50).
   *   eventType  {string}  Filter by event type (optional).
   */
  app.get('/api/v1/activity/feed', asyncRoute(async (request, response) => {
    await requireSession(request);

    const limit = request.query.limit !== undefined
      ? Number(request.query.limit)
      : undefined;

    const eventType = typeof request.query.eventType === 'string'
      ? request.query.eventType
      : null;

    const feed = await buildActivityFeed({ limit, eventType });

    response.json({
      ok: true,
      ...feed,
    });
  }));

  app.get('/api/v1/activity/blocklist', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const query = typeof request.query.q === 'string'
      ? request.query.q
      : null;

    const blocklist = await listBlockedSourceUsers({ query });

    response.json({
      ok: true,
      ...blocklist,
    });
  }));

  app.post('/api/v1/activity/blocklist', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await blockSourceUser({
      actorUserId: session.appUserId,
      operatorNotes: request.body?.operatorNotes,
      reason: request.body?.reason,
      username: request.body?.username,
    });

    response.status(201).json({
      ok: true,
      ...result,
    });
  }));

  app.delete('/api/v1/activity/blocklist/:username', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await unblockSourceUser({
      actorUserId: session.appUserId,
      username: request.params.username,
    });

    response.json({
      ok: true,
      ...result,
    });
  }));
}
