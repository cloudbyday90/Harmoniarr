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

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerSystemRoutes(app, {
  appPort,
  createBackupExport,
  getActivityFeed,
  getBackupExportById,
  getBackupRestorePreview,
  startBackupRestoreApply,
  getOperatorNotifications,
  listBackupExports,
  limitBackupExport = skipRateLimitMiddleware,
  limitOperatorNotificationFanoutRun = skipRateLimitMiddleware,
  buildLibraryScanSummary,
  buildOnboardingSummary,
  getOverview,
  startOperatorNotificationFanoutRun,
  buildSettingsPayload,
  updateSettings,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
  requireSession = defaultRequestAuthDependencies.requireSession,
}) {
  app.get('/healthz', asyncRoute(async (_request, response) => {
    const overview = await getOverview({ includeArtworkMaintenance: false, includeDependencies: false });
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
    await requireAdminSession(request);
    response.json({
      ok: true,
      ...(await buildSettingsPayload()),
    });
  }));

  app.put('/api/v1/settings', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
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
    await requireAdminSession(request);
    response.json(await getOverview({ includeDependencies: true }));
  }));

  app.get('/api/v1/system/activity-feed', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await getActivityFeed({
      before: request.query.before,
      limit: request.query.limit,
    }));
  }));

  app.get('/api/v1/system/operator-notifications', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await getOperatorNotifications({
      limit: request.query.limit,
    }));
  }));

  app.get('/api/v1/recovery/backups', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...await listBackupExports({
        limit: request.query.limit,
      }),
    });
  }));

  app.get('/api/v1/recovery/backups/:backupArtifactId', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...await getBackupExportById({
        backupArtifactId: request.params.backupArtifactId,
      }),
    });
  }));

  app.get('/api/v1/recovery/backups/:backupArtifactId/restore-preview', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...await getBackupRestorePreview({
        backupArtifactId: request.params.backupArtifactId,
      }),
    });
  }));

  app.post('/api/v1/recovery/backups', limitBackupExport, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.status(202).json({
      ok: true,
      ...await createBackupExport({
        requestMetadata: getRequestMetadata(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/recovery/backups/:backupArtifactId/restore-apply', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    response.status(202).json({
      ok: true,
      ...await startBackupRestoreApply({
        backupArtifactId: request.params.backupArtifactId,
        expectedPayloadSha256: request.body?.expectedPayloadSha256,
        requestMetadata: getRequestMetadata(request),
        triggeredByUserId: session.appUserId,
      }),
    });
  }));

  app.post('/api/v1/system/operator-notification-fanout-runs', limitOperatorNotificationFanoutRun, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await startOperatorNotificationFanoutRun({
      requestMetadata: getRequestMetadata(request),
      triggeredByUserId: session.appUserId,
    });

    response.status(202).json({
      ok: true,
      ...result,
    });
  }));

  app.get('/api/v1/system/onboarding', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildOnboardingSummary());
  }));

  app.get('/api/v1/system/library-scan-summary', asyncRoute(async (request, response) => {
    await requireAdminSession(request);
    response.json(await buildLibraryScanSummary());
  }));
}
