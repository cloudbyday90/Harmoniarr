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

export function registerLibraryRoutes(app, {
  buildLibraryDiscoverySummary,
  buildLibraryReconciliationSummary,
  buildLibraryWantedSummary,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireSession = defaultRequestAuthDependencies.requireSession,
  startLibraryDiscoveryRun,
  startLibraryScan,
}) {
  app.get('/api/v1/library/discovery-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryDiscoverySummary());
  }));

  app.get('/api/v1/library/reconciliation-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryReconciliationSummary());
  }));

  app.get('/api/v1/library/wanted-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryWantedSummary());
  }));

  app.post('/api/v1/library/discovery-runs', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
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

  app.post('/api/v1/library/scan-runs', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
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
}