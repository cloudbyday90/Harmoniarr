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
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';
import { createReadStream } from 'node:fs';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerArtworkRoutes(app, {
  buildArtworkCleanupHistory,
  buildArtworkCleanupRunDetail,
  buildArtworkSummary,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  getQuotaHistory,
  getQuotaStatus,
  limitArtworkCleanupRun = skipRateLimitMiddleware,
  limitArtworkResolveBatch = skipRateLimitMiddleware,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
  resolveArtwork,
  resolveArtworkBatch,
  serveArtworkFile,
  startArtworkCleanupRun,
  writeDominantColor,
}) {
  app.get('/api/v1/artwork/summary', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkSummary());
  }));

  app.get('/api/v1/artwork/cleanup-runs', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkCleanupHistory({
      limit: request.query.limit,
    }));
  }));

  app.get('/api/v1/artwork/cleanup-runs/:runId', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildArtworkCleanupRunDetail({
      runId: request.params.runId,
    }));
  }));

  app.post('/api/v1/artwork/cleanup-runs', limitArtworkCleanupRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startArtworkCleanupRun({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.patch('/api/v1/artwork/assets/:assetId/dominant-color', asyncRoute(async (request, response) => {
    await requireSession(request);
    const { hue, chroma, lightness } = request.body ?? {};

    const result = await writeDominantColor({
      artworkAssetId: request.params.assetId,
      hue: Number(hue),
      chroma: Number(chroma),
      lightness: Number(lightness),
    });

    response.json({ ok: result.ok, updated: result.updated });
  }));

  app.get('/api/v1/artwork/assets/:assetId/file', asyncRoute(async (request, response) => {
    await requireSession(request);

    const { absolutePath, mimeType, fileSize } = await serveArtworkFile({
      assetId: request.params.assetId,
    });

    response.setHeader('Content-Type', mimeType);
    response.setHeader('Content-Length', fileSize);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    createReadStream(absolutePath).pipe(response);
  }));

  app.get('/api/v1/artwork/resolve', asyncRoute(async (request, response) => {
    await requireSession(request);

    const { owner_type, owner_id, artwork_role, refresh } = request.query;
    if (!owner_type || !owner_id) {
      response.status(400).json({
        ok: false,
        error: { code: 'validation_error', message: 'owner_type and owner_id are required' },
      });
      return;
    }

    const result = await resolveArtwork({
      artworkRole: artwork_role ?? 'cover_front',
      ownerId: owner_id,
      ownerType: owner_type,
      refresh: refresh === 'true' || refresh === '1',
    });

    response.json(result);
  }));

  app.post('/api/v1/artwork/resolve-batch', limitArtworkResolveBatch, asyncRoute(async (request, response) => {
    await requireSession(request);

    const { requests: batchRequests } = request.body ?? {};
    if (!Array.isArray(batchRequests) || batchRequests.length === 0) {
      response.status(400).json({
        ok: false,
        error: { code: 'validation_error', message: 'requests must be a non-empty array' },
      });
      return;
    }

    if (batchRequests.length > 50) {
      response.status(400).json({
        ok: false,
        error: { code: 'validation_error', message: 'Batch size must not exceed 50 items' },
      });
      return;
    }

    const results = await resolveArtworkBatch(batchRequests.map((r) => ({
      artworkRole: r.artworkRole ?? r.artwork_role ?? 'cover_front',
      ownerId: r.ownerId ?? r.owner_id,
      ownerType: r.ownerType ?? r.owner_type,
      refresh: r.refresh === true || r.refresh === 'true' || r.refresh === 1 || r.refresh === '1',
    })));

    response.json({ resolved: results });
  }));

  app.get('/api/v1/artwork/quota', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await getQuotaStatus());
  }));

  app.get('/api/v1/artwork/quota/history', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    const days = Math.min(Math.max(Number(request.query.days) || 30, 1), 90);
    response.json(await getQuotaHistory({ days }));
  }));
}