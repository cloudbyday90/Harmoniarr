/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { asyncRoute } from '../http.js';

export function registerProviderCollectionAccessRoutes(app, {
  checkProviderCollectionAccess, limitProviderAccessCheck, requireCsrf, requireFreshAdminSession,
}) {
  app.post('/api/v1/providers/collection-access-check', asyncRoute(async (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    const session = await requireFreshAdminSession(request);
    if (session.user?.role !== 'admin') throw createApiError(403, 'admin_required', 'Administrator access is required');
    requireCsrf(request, session);
    next();
  }), limitProviderAccessCheck, asyncRoute(async (request, response) => {
    const body = request.body;
    if (!body || Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.sourceUrl !== 'string') {
      throw createApiError(400, 'validation_error', 'Provide only a sourceUrl for this collection check');
    }
    try {
      response.json({ ok: true, check: await checkProviderCollectionAccess({ sourceUrl: body.sourceUrl }) });
    } catch (error) {
      if (error?.code === 'validation_error' && error.status === 400) {
        throw createApiError(400, 'validation_error', 'sourceUrl must identify a supported provider playlist or artist collection');
      }
      if (error?.code === 'provider_diagnostic_busy' && error.status === 409) {
        throw createApiError(409, 'provider_diagnostic_busy', 'A provider access check is already running. Wait for it to finish.');
      }
      throw createApiError(500, 'provider_check_failed', 'The provider access check could not be completed');
    }
  }));
}
