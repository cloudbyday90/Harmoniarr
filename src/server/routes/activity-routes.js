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

/**
 * Registers the household activity feed routes.
 *
 * @param {import('express').Application} app
 * @param {object} deps
 * @param {function} deps.buildActivityFeed
 * @param {function} [deps.requireSession]
 */
export function registerActivityRoutes(app, {
  applyIgnoreSuggestion,
  blockSourceUser,
  bulkBlockSourceUsers,
  bulkUpdateSourceUserTrust,
  buildActivityFeed,
  exportSourceUserTrustHistory,
  getSourceUserCollusionReport,
  getSourceUserDetail,
  limitActivitySourceUserMutations = skipRateLimitMiddleware,
  limitActivityBlocklistMutations = skipRateLimitMiddleware,
  listBlockedSourceUsers,
  listIgnoredSourceUsers,
  listSourceUserAutoIgnoreSuggestions,
  listSourceUsers,
  processSpectralBacklog,
  removeIgnoredSourceUser,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  scanLibrarySpectral,
  simulateSourceUserTrustPolicy,
  updateSourceUserTrust,
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

    const limit = sanitizePageLimit(request.query.limit, { default: 10, max: 25 });

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

  app.get('/api/v1/activity/ignored-source-users', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const ignoredSourceUsers = await listIgnoredSourceUsers();

    response.json({
      ok: true,
      ignoredSourceUsers: Array.isArray(ignoredSourceUsers) ? ignoredSourceUsers : [],
    });
  }));

  app.get('/api/v1/activity/source-user-ignore-suggestions', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...(await listSourceUserAutoIgnoreSuggestions()),
    });
  }));

  app.get('/api/v1/activity/source-users', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const query = typeof request.query.q === 'string'
      ? request.query.q
      : null;
    const trustState = typeof request.query.trustState === 'string'
      ? request.query.trustState
      : null;

    const sourceUsers = await listSourceUsers({ query, trustState });

    response.json({
      ok: true,
      ...sourceUsers,
    });
  }));

  app.get('/api/v1/activity/source-users/:username', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...(await getSourceUserDetail({
        username: request.params.username,
        historyLimit: sanitizePageLimit(request.query.historyLimit, { default: 20, max: 100 }),
        historyOffset: sanitizePageOffset(request.query.historyOffset),
      })),
    });
  }));

  app.get('/api/v1/activity/source-users/:username/export', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const result = await exportSourceUserTrustHistory({
      accept: request.headers.accept,
      format: request.query.format,
      username: request.params.username,
    });

    if (result.mediaType === 'text/csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      response.send(result.payload);
    } else {
      response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      response.json({
        ok: true,
        ...result.payload,
      });
    }
  }));

  app.patch('/api/v1/activity/source-users/:username', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.json({
      ok: true,
      ...(await updateSourceUserTrust({
        actorUserId: session.appUserId,
        operatorNotes: request.body?.operatorNotes,
        reason: request.body?.reason,
        trustState: request.body?.trustState,
        username: request.params.username,
      })),
    });
  }));

  app.post('/api/v1/activity/source-users/bulk-trust', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.json({
      ok: true,
      ...(await bulkUpdateSourceUserTrust({
        actorUserId: session.appUserId,
        operatorNotes: request.body?.operatorNotes,
        reason: request.body?.reason,
        trustState: request.body?.trustState,
        usernames: request.body?.usernames,
      })),
    });
  }));

  /**
   * GET /api/v1/activity/source-user-collusion
   *
   * Read-only cross-peer collusion report: confirmed-transcode content
   * fingerprints shared by two or more distinct peers, grouped into rings.
   */
  app.get('/api/v1/activity/source-user-collusion', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const minDistinctUsers = typeof request.query.minDistinctUsers === 'string'
      ? Number.parseInt(request.query.minDistinctUsers, 10)
      : undefined;

    const report = await getSourceUserCollusionReport({ minDistinctUsers });

    response.json({
      ok: true,
      ...report,
    });
  }));

  /**
   * POST /api/v1/activity/source-user-trust-policy-simulation
   *
   * Read-only "what-if": projects how a proposed set of review thresholds would
   * reclassify the current peer population. Performs no mutation.
   */
  app.post('/api/v1/activity/source-user-trust-policy-simulation', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const simulation = await simulateSourceUserTrustPolicy({
      thresholds: request.body?.thresholds ?? {},
    });

    response.json({
      ok: true,
      ...simulation,
    });
  }));

  /**
   * POST /api/v1/activity/source-user-spectral-rescan
   *
   * Enqueues a bounded batch of lossless library files for retroactive spectral
   * re-grading, then drains a batch immediately for operator feedback. The
   * content-addressed cache means already-measured files skip a second decode.
   */
  app.post('/api/v1/activity/source-user-spectral-rescan', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const limit = typeof request.body?.limit === 'number' ? request.body.limit : undefined;
    const scan = await scanLibrarySpectral({ limit });

    let processed = null;
    if (typeof processSpectralBacklog === 'function') {
      processed = await processSpectralBacklog({ limit: 8 });
    }

    response.json({
      ok: true,
      scan,
      processed,
    });
  }));

  app.post('/api/v1/activity/blocklist', limitActivityBlocklistMutations, asyncRoute(async (request, response) => {
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

  app.post('/api/v1/activity/blocklist/bulk', limitActivityBlocklistMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.json({
      ok: true,
      ...(await bulkBlockSourceUsers({
        actorUserId: session.appUserId,
        operatorNotes: request.body?.operatorNotes,
        reason: request.body?.reason,
        usernames: request.body?.usernames,
      })),
    });
  }));

  app.delete('/api/v1/activity/blocklist/:username', limitActivityBlocklistMutations, asyncRoute(async (request, response) => {
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

  app.post('/api/v1/activity/ignored-source-users', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await applyIgnoreSuggestion({
      actorUserId: session.appUserId,
      reason: request.body?.reason,
      suggestionSignals: request.body?.suggestionSignals,
      username: request.body?.username,
    });

    response.status(201).json({
      ok: true,
      ...result,
    });
  }));

  app.delete('/api/v1/activity/ignored-source-users/:username', limitActivitySourceUserMutations, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await removeIgnoredSourceUser({
      actorUserId: session.appUserId,
      username: request.params.username,
    });

    response.json({
      ok: true,
      ...result,
    });
  }));
}
