/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { asyncRoute } from '../http.js';
import { normalizeExternalRequestReviewError } from '../library/library-external-request-review-error.js';

export function registerLibraryExternalRequestReviewRoutes(app, {
  externalRequestReviewService, externalRequestCollectionReviewService, requireSession, requireFreshAdminSession,
  requireCsrf, limitMediaRequestAdminMutation, getRequestMetadata,
}) {
  async function review(work) {
    try {
      return await work();
    } catch (error) {
      throw normalizeExternalRequestReviewError(error);
    }
  }

  async function requireReviewSession(request, fresh = false) {
    const session = await (fresh ? requireFreshAdminSession(request) : requireSession(request));
    if (session.user?.role !== 'admin') throw createApiError(403, 'forbidden', 'Only administrators can review external requests');
    return session;
  }

  app.get('/api/v1/library/media-requests/:mediaRequestId/external-review', asyncRoute(async (request, response) => {
    await requireReviewSession(request);
    response.json({ ok: true, ...await review(() => externalRequestReviewService.buildReview({
      mediaRequestId: request.params.mediaRequestId, cursor: request.query.cursor, limit: request.query.limit,
    })) });
  }));

  app.get('/api/v1/library/media-requests/:mediaRequestId/external-review/releases', asyncRoute(async (request, response) => {
    await requireReviewSession(request);
    response.json({ ok: true, ...await review(() => externalRequestReviewService.searchReleases({
      mediaRequestId: request.params.mediaRequestId, artistName: request.query.artistName, releaseTitle: request.query.releaseTitle,
    })) });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/external-review/approve', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireReviewSession(request, true);
    requireCsrf(request, session);
    response.status(202).json({ ok: true, ...await review(() => externalRequestReviewService.approveRelease({
      mediaRequestId: request.params.mediaRequestId,
      providerIngestRequestId: request.body?.providerIngestRequestId,
      metadataReleaseId: request.body?.metadataReleaseId,
      expectedRevision: request.body?.expectedRevision,
      actorUserId: session.appUserId, requestMetadata: getRequestMetadata(request),
    })) });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/external-review/recover', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireReviewSession(request, true);
    requireCsrf(request, session);
    response.status(202).json({ ok: true, ...await review(() => externalRequestReviewService.recoverPreparation({
      mediaRequestId: request.params.mediaRequestId, actorUserId: session.appUserId, requestMetadata: getRequestMetadata(request),
    })) });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/external-review/collection/start', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireReviewSession(request, true);
    requireCsrf(request, session);
    response.status(202).json({ ok: true, ...await review(() => externalRequestCollectionReviewService.startCollection({
      mediaRequestId: request.params.mediaRequestId, restart: request.body?.restart,
      actorUserId: session.appUserId, requestMetadata: getRequestMetadata(request),
    })) });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/external-review/collection/items/:collectionItemId/exclude', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireReviewSession(request, true);
    requireCsrf(request, session);
    response.json({ ok: true, ...await review(() => externalRequestCollectionReviewService.excludeItem({
      mediaRequestId: request.params.mediaRequestId, collectionItemId: request.params.collectionItemId,
      reason: request.body?.reason, expectedRevision: request.body?.expectedRevision,
      actorUserId: session.appUserId, requestMetadata: getRequestMetadata(request),
    })) });
  }));

  app.post('/api/v1/library/media-requests/:mediaRequestId/external-review/collection/finalize', limitMediaRequestAdminMutation, asyncRoute(async (request, response) => {
    const session = await requireReviewSession(request, true);
    requireCsrf(request, session);
    response.json({ ok: true, ...await review(() => externalRequestCollectionReviewService.finalizeCollection({
      mediaRequestId: request.params.mediaRequestId, expectedRevision: request.body?.expectedRevision,
      actorUserId: session.appUserId, requestMetadata: getRequestMetadata(request),
    })) });
  }));
}
