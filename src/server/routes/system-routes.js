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

export function registerSystemRoutes(app, {
  appPort,
  buildLibraryScanSummary,
  buildOnboardingSummary,
  getOverview,
  buildSettingsPayload,
  updateSettings,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireSession = defaultRequestAuthDependencies.requireSession,
}) {
  app.get('/healthz', asyncRoute(async (_request, response) => {
    const overview = await getOverview({ includeDependencies: false });
    response.json({
      ok: true,
      service: overview.service.name,
      startedAt: overview.service.startedAt,
      appPort,
      database: overview.database.name,
      pendingMigrations: overview.database.pendingMigrations,
      postgresDataDir: process.env.PGDATA ?? '/app/data/postgres/18/data',
    });
  }));

  app.get('/api/v1/settings', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json({
      ok: true,
      ...(await buildSettingsPayload()),
    });
  }));

  app.put('/api/v1/settings', asyncRoute(async (request, response) => {
    const session = await requireSession(request);
    requireCsrf(request, session);
    const updateResult = await updateSettings({
      patch: request.body,
      actorUserId: session.appUserId,
      requestMetadata: getRequestMetadata(request),
    });

    response.json({
      ok: true,
      ...updateResult,
    });
  }));

  app.get('/api/v1/system/overview', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await getOverview({ includeDependencies: true }));
  }));

  app.get('/api/v1/system/onboarding', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildOnboardingSummary());
  }));

  app.get('/api/v1/system/library-scan-summary', asyncRoute(async (request, response) => {
    await requireSession(request);
    response.json(await buildLibraryScanSummary());
  }));
}
