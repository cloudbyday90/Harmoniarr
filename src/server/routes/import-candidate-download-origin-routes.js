/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError, getRequestMetadata, requireCsrf, requireSession } from '../auth.js';
import { createRequestAuthDependencies } from '../auth-module.js';
import { asyncRoute } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';
import { createControlPlaneIdempotencyService } from '../recovery/control-plane-idempotency-service.js';
import { normalizeDownloadOriginCommand } from '../import-candidates/import-candidate-download-origin-policy.js';

const auth = createRequestAuthDependencies({ getRequestMetadata, requireCsrf, requireSession });
const idempotency = createControlPlaneIdempotencyService();
const prefix = '/api/v1/import-candidates/execution-runs/:runId/items/:importCandidateId';
const boundedRoute = (handler) => asyncRoute(async (request, response) => {
  try { await handler(request, response); }
  catch (error) {
    if (error?.code?.startsWith('slskd_')) throw createApiError(503, 'download_origin_provider_unavailable', 'Downloader evidence is unavailable. Try the review again.');
    throw error;
  }
});

export function registerImportCandidateDownloadOriginRoutes(app, { getDownloadOriginReview, resolveDownloadOrigin,
  requireAdminSession = auth.requireAdminSession, requireFreshAdminSession = auth.requireFreshAdminSession,
  requireCsrf: requireCsrfFn = auth.requireCsrf, getRequestMetadata: getRequestMetadataFn = auth.getRequestMetadata,
  executeIdempotentMutation = idempotency.executeIdempotentMutation,
  limitDownloadOriginReview = skipRateLimitMiddleware, limitDownloadOriginMutation = skipRateLimitMiddleware } = {}) {
  const context = (request, session) => ({ operationRunId: request.params.runId, importCandidateId: request.params.importCandidateId,
    actorUserId: session.appUserId, refreshTokenId: session.refreshTokenId });
  app.get(`${prefix}/download-origin-review`, limitDownloadOriginReview, boundedRoute(async (request, response) => {
    const session = await requireAdminSession(request);
    response.json({ ok: true, ...await getDownloadOriginReview(context(request, session)) });
  }));
  app.post(`${prefix}/download-origin-resolution`, limitDownloadOriginMutation, boundedRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrfFn(request, session);
    const command = normalizeDownloadOriginCommand(request.body);
    const key = request.headers['idempotency-key'];
    if (typeof key !== 'string' || !key.trim()) throw createApiError(400, 'idempotency_key_required', 'Keep the same command key when retrying download resolution');
    const owner = context(request, session);
    const result = await executeIdempotentMutation({ actorUserId: session.appUserId, idempotencyKey: key,
      operationScope: 'import-candidates.download-origin-resolution', requestPayload: { operationRunId: owner.operationRunId,
        importCandidateId: owner.importCandidateId, ...command }, executeMutation: async () => ({ statusCode: 200,
        body: await resolveDownloadOrigin({ ...owner, command, requestMetadata: getRequestMetadataFn(request) }) }) });
    const body = result.body ?? {};
    response.status(result.statusCode ?? 200).json({ ok: true, ...body,
      ...(result.replayed && body.downloadOriginResolution ? { downloadOriginResolution: { ...body.downloadOriginResolution, replayed: true } } : {}) });
  }));
}
