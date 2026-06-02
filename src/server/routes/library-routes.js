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
import { createApiError } from '../auth.js';
import { hasAppUserPermission } from '../app-user-permission-service.js';
import { asyncRoute, sanitizePageLimit, sanitizePageOffset } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerLibraryRoutes(app, {
  buildLibraryDiscoveryRunDetail,
  buildLibraryDiscoverySummary,
  buildLibraryFilterOptions,
  buildLibraryOrganizePreview,
  buildLibraryReleases,
  buildLibraryWantedReleases,
  buildLibraryReconciliationSummary,
  buildLibraryScanRunDetail,
  buildLibraryWantedSummary,
  buildMediaRequestDetail,
  buildMediaRequestPipeline,
  buildMediaRequestSummary,
  buildReleaseRadar,
  bulkCancelMediaRequests,
  cancelMediaRequest,
  createMediaRequest,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getMediaRequestReassignmentHistory,
  limitLibraryDiscoveryRun = skipRateLimitMiddleware,
  limitLibraryOrganizeApplyRun = skipRateLimitMiddleware,
  limitLibraryScanRun = skipRateLimitMiddleware,
  limitMediaRequestMutation = skipRateLimitMiddleware,
  limitMediaRequestAdminMutation = skipRateLimitMiddleware,
  limitMediaRequestBulkCancel = skipRateLimitMiddleware,
  listMediaRequestEventsPage,
  listMediaRequests,
  reassignMediaRequest,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  retryDownloadRecoveryDiscoveryRequest = async () => {
    throw new Error('retryDownloadRecoveryDiscoveryRequest dependency is required');
  },
  startLibraryOrganizeApplyRun,
  startLibraryDiscoveryRun,
  startLibraryScan,
}) {
  function resolveMediaRequestScope(session, requestedScope) {
    if (session?.user?.role === 'admin') {
      return requestedScope === 'mine' ? 'mine' : 'all';
    }

    return 'mine';
  }

  function ensureMediaRequestPermission(session, permission, message) {
    if (!hasAppUserPermission(session?.user, permission)) {
      throw createApiError(403, 'forbidden', message);
    }
  }

  app.get('/api/v1/library/discovery-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryDiscoverySummary());
  }));

  app.get('/api/v1/library/media-request-summary', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const scope = resolveMediaRequestScope(session, request.query.scope);
    response.json({
      ok: true,
      scope,
      ...(await buildMediaRequestSummary({
        requestedForUserId: scope === 'mine' ? session.appUserId : null,
      })),
    });
  }));

  app.get('/api/v1/library/media-requests', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const scope = resolveMediaRequestScope(session, request.query.scope);
    const requestedForUserId = scope === 'mine' ? session.appUserId : null;
    const { requestState, requestKind, search, limit, offset, cursor } = request.query;
    const listResult = await listMediaRequests({
      limit: limit ? sanitizePageLimit(limit, { default: 100, max: 100 }) : undefined,
      offset: offset ? sanitizePageOffset(offset) : undefined,
      cursor: typeof cursor === 'string' && cursor.length > 0 ? cursor : null,
      requestKind: typeof requestKind === 'string' && requestKind.length > 0 ? requestKind : null,
      requestedForUserId,
      requestState: typeof requestState === 'string' && requestState.length > 0 ? requestState : null,
      search: typeof search === 'string' && search.trim().length > 0 ? search.trim() : null,
    });

    const payload = {
      mediaRequests: listResult.mediaRequests,
      ok: true,
      scope,
    };

    if (cursor) {
      payload.hasMore = listResult.hasMore ?? false;
      payload.nextCursor = listResult.nextCursor ?? null;
    } else {
      payload.totalCount = listResult.totalCount;
    }

    response.json(payload);
  }));

  app.get('/api/v1/library/media-requests/:mediaRequestId', asyncRoute(async (request, response) => {
    await requireSession(request);

    const detail = await buildMediaRequestDetail({
      mediaRequestId: request.params.mediaRequestId,
    });

    response.json({
      events: detail.events,
      hasMoreEvents: detail.hasMoreEvents,
      mediaRequest: detail.mediaRequest,
      nextCursor: detail.nextCursor,
      ok: true,
    });
  }));

  app.get('/api/v1/library/media-requests/:mediaRequestId/pipeline', asyncRoute(async (request, response) => {
    await requireSession(request);

    const pipeline = await buildMediaRequestPipeline({
      mediaRequestId: request.params.mediaRequestId,
    });

    response.json({
      candidates: pipeline.candidates,
      ok: true,
    });
  }));

  app.get('/api/v1/library/media-requests/:mediaRequestId/events', asyncRoute(async (request, response) => {
    await requireSession(request);
    const { cursor, limit } = request.query;
    const result = await listMediaRequestEventsPage({
      mediaRequestId: request.params.mediaRequestId,
      cursor: typeof cursor === 'string' && cursor.length > 0 ? cursor : null,
      limit: sanitizePageLimit(limit, { default: 50, max: 100 }),
    });
    response.json({
      events: result.events,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
      ok: true,
    });
  }));

  app.get('/api/v1/library/discovery-runs/:runId', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json({
      ok: true,
      libraryDiscoveryRun: await buildLibraryDiscoveryRunDetail({
        runId: request.params.runId,
      }),
    });
  }));

  app.get('/api/v1/library/reconciliation-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryReconciliationSummary());
  }));

  app.get('/api/v1/library/organize-preview', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryOrganizePreview());
  }));

  app.get('/api/v1/library/wanted-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryWantedSummary());
  }));

  app.get('/api/v1/library/release-radar', asyncRoute(async (request, response) => {
    await requireSession(request);
    const { recentDays = '30', upcomingDays = '90', limit = '100' } = request.query;
    response.json({
      ok: true,
      ...(await buildReleaseRadar({
        limit: sanitizePageLimit(limit, { default: 100, max: 200 }),
        recentDays: Number.parseInt(String(recentDays), 10) || 30,
        upcomingDays: Number.parseInt(String(upcomingDays), 10) || 90,
      })),
    });
  }));

  app.get('/api/v1/library/releases', asyncRoute(async (request, response) => {
    await requireSession(request);
    const { status: reconciliationStatus = null, limit = '500' } = request.query;
    const validStatuses = ['complete', 'partial', 'duplicate'];
    response.json(await buildLibraryReleases({
      limit: sanitizePageLimit(limit, { default: 500, max: 2000 }),
      reconciliationStatus: validStatuses.includes(reconciliationStatus) ? reconciliationStatus : null,
    }));
  }));

  app.get('/api/v1/library/filter-options', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryFilterOptions());
  }));

  app.get('/api/v1/library/wanted-releases', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    const { status: wantedStatus = null, limit = '500' } = request.query;
    response.json(await buildLibraryWantedReleases({
      includeDiscoveryRequestDetails: session?.user?.role === 'admin',
      limit: sanitizePageLimit(limit, { default: 500, max: 2000 }),
      wantedStatus: wantedStatus === 'missing' || wantedStatus === 'partial' ? wantedStatus : null,
    }));
  }));

  app.post('/api/v1/library/media-requests', limitMediaRequestMutation, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);
    ensureMediaRequestPermission(session, 'media.request', 'The current user cannot create music requests');

    if (request.body?.requestKind === 'external_url') {
      ensureMediaRequestPermission(session, 'playlist.submit', 'The current user cannot submit playlist or collection URLs');
    }

    const mediaRequest = await createMediaRequest({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      payload: request.body,
      requestMetadata: getRequestMetadata(request),
    });

    const linked = mediaRequest.linked ?? false;
    const fanOut = mediaRequest.fanOut ?? null;
    const responseBody = { ...mediaRequest };
    delete responseBody.fanOut;

    if (linked) {
      responseBody.linkedMessage = 'Someone has already requested this — you\'ve been added to the queue.';
    }

    if (fanOut && fanOut.childCount > 0) {
      responseBody.fanOutMessage = `Request created for ${fanOut.totalTargets} user${fanOut.totalTargets === 1 ? '' : 's'} (${fanOut.childCount} additional target${fanOut.childCount === 1 ? '' : 's'}).`;
      responseBody.fanOutChildIds = fanOut.children;
      responseBody.fanOutChildCount = fanOut.childCount;
      if (fanOut.ineligible.length > 0) {
        responseBody.fanOutIneligibleTargets = fanOut.ineligible;
      }
    }

    response.status(201).json({
      mediaRequest: responseBody,
      ok: true,
    });
  }));

  app.post('/api/v1/library/media-requests/bulk-cancel', limitMediaRequestBulkCancel, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);

    const result = await bulkCancelMediaRequests({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      mediaRequestIds: request.body?.mediaRequestIds,
      reason: request.body?.reason,
      requestMetadata: getRequestMetadata(request),
    });

    response.json({
      ...result,
      ok: true,
    });
  }));

  app.get('/api/v1/library/scan-runs/:runId', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json({
      ok: true,
      libraryScanRun: await buildLibraryScanRunDetail({
        runId: request.params.runId,
      }),
    });
  }));

  app.post('/api/v1/library/discovery-runs', limitLibraryDiscoveryRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startLibraryDiscoveryRun({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/library/discovery-requests/:metadataReleaseId/retry-download-recovery', limitLibraryDiscoveryRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await retryDownloadRecoveryDiscoveryRequest({
      metadataReleaseId: request.params.metadataReleaseId,
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/library/organize-runs', limitLibraryOrganizeApplyRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startLibraryOrganizeApplyRun({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/library/scan-runs', limitLibraryScanRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startLibraryScan({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/cancel', limitMediaRequestMutation, asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);

    const cancelledRequest = await cancelMediaRequest({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      mediaRequestId: request.params.mediaRequestId,
      reason: request.body?.reason,
      requestMetadata: getRequestMetadata(request),
    });

    response.json({
      mediaRequest: cancelledRequest,
      ok: true,
    });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/reassign', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const reassignedRequest = await reassignMediaRequest({
      actorUserId: session.appUserId,
      actorUserRole: session.user?.role ?? null,
      mediaRequestId: request.params.mediaRequestId,
      newRequestedForUserId: request.body?.newRequestedForUserId,
      reason: request.body?.reason,
      requestMetadata: getRequestMetadata(request),
    });

    response.json({
      mediaRequest: reassignedRequest,
      ok: true,
    });
  }));

  app.get('/api/v1/library/media-requests/:mediaRequestId/reassignment-history', asyncRoute(async (request, response) => {
    const session = await requireSession(request);

    if (session?.user?.role !== 'admin') {
      throw createApiError(403, 'forbidden', 'Only administrators can view reassignment history');
    }

    const events = await getMediaRequestReassignmentHistory({
      mediaRequestId: request.params.mediaRequestId,
    });

    response.json({
      events,
      ok: true,
    });
  }));
}
