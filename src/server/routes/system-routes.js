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
import { asyncRoute, sanitizePageLimit } from '../http.js';
import { skipRateLimitMiddleware } from '../request-rate-limiter.js';
import { readdir } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';

const defaultRequestAuthDependencies = createRequestAuthDependencies();

export function registerSystemRoutes(app, {
  appPort,
  createBackupExport,
  deleteBackupExportById,
  getActivityFeed,
  getBackupExportById,
  getBackupExportDownloadById,
  enterMaintenanceLock,
  getBackupRestorePreview,
  getDiagnosticsExportDownload,
  getMaintenanceLockStatus,
  getQueueDiagnostics,
  getRecoveryDiagnostics,
  releaseMaintenanceLockById,
  startBackupRestoreApply,
  getOperatorNotifications,
  acknowledgeAllOperatorNotifications,
  listBackupExports,
  limitBackupExport = skipRateLimitMiddleware,
  limitDiagnosticsExport = skipRateLimitMiddleware,
  limitOperatorNotificationFanoutRun = skipRateLimitMiddleware,
  limitSettingsUpdate = skipRateLimitMiddleware,
  limitMaintenanceLockMutation = skipRateLimitMiddleware,
  limitBackupMutation = skipRateLimitMiddleware,
  buildLibraryScanSummary,
  buildOnboardingSummary,
  executeIdempotentMutation = async ({ executeMutation }) => executeMutation(),
  getOverview,
  startOperatorNotificationFanoutRun,
  buildSettingsPayload,
  updateSettings,
  getRequestMetadata = defaultRequestAuthDependencies.getRequestMetadata,
  requireAdminSession = defaultRequestAuthDependencies.requireAdminSession,
  requireCsrf = defaultRequestAuthDependencies.requireCsrf,
  requireFreshAdminSession = defaultRequestAuthDependencies.requireFreshAdminSession,
}) {
  async function runIdempotentMutation({
    actorUserId,
    executeMutation,
    idempotencyKey,
    operationScope,
    requestPayload,
    statusCode,
  }) {
    const result = await executeIdempotentMutation({
      actorUserId,
      executeMutation,
      idempotencyKey,
      operationScope,
      requestPayload,
    });

    return {
      body: result?.body ?? {},
      statusCode: result?.statusCode ?? statusCode,
    };
  }

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

  app.put('/api/v1/settings', limitSettingsUpdate, asyncRoute(async (request, response) => {
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
      limit: sanitizePageLimit(request.query.limit, { default: 10, max: 25 }),
    }));
  }));

  app.get('/api/v1/system/operator-notifications', asyncRoute(async (request, response) => {
    const session = await requireAdminSession(request);
    response.json(await getOperatorNotifications({
      limit: sanitizePageLimit(request.query.limit, { default: 20, max: 25 }),
      userId: session.appUserId,
    }));
  }));

  app.post('/api/v1/system/operator-notifications/acknowledge-all', asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);
    const result = await acknowledgeAllOperatorNotifications(session.appUserId);
    response.json(result);
  }));

  app.get('/api/v1/recovery/maintenance-locks', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const lockTypes = typeof request.query.lockTypes === 'string'
      ? request.query.lockTypes.split(',')
      : [];

    response.json({
      ok: true,
      ...await getMaintenanceLockStatus({ lockTypes }),
    });
  }));

  app.post('/api/v1/recovery/maintenance-locks', limitMaintenanceLockMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await runIdempotentMutation({
      actorUserId: session.appUserId,
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'recovery.maintenanceLocks.enter',
      requestPayload: {
        expiresAt: request.body?.expiresAt ?? null,
        lockType: request.body?.lockType,
        reason: request.body?.reason ?? null,
      },
      statusCode: 202,
      executeMutation: async () => ({
        body: await enterMaintenanceLock({
          expiresAt: request.body?.expiresAt ?? null,
          lockType: request.body?.lockType,
          reason: request.body?.reason ?? null,
          requestMetadata: getRequestMetadata(request),
          triggeredByUserId: session.appUserId,
        }),
        statusCode: 202,
      }),
    });

    response.status(result.statusCode).json({
      ok: true,
      ...result.body,
    });
  }));

  app.post('/api/v1/recovery/maintenance-locks/:lockId/release', limitMaintenanceLockMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await runIdempotentMutation({
      actorUserId: session.appUserId,
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'recovery.maintenanceLocks.release',
      requestPayload: { lockId: request.params.lockId },
      statusCode: 200,
      executeMutation: async () => ({
        body: await releaseMaintenanceLockById({
          lockId: request.params.lockId,
          requestMetadata: getRequestMetadata(request),
          triggeredByUserId: session.appUserId,
        }),
        statusCode: 200,
      }),
    });

    response.json({
      ok: true,
      ...result.body,
    });
  }));

  app.get('/api/v1/recovery/backups', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...await listBackupExports({
        limit: sanitizePageLimit(request.query.limit, { default: 25, max: 50 }),
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

  app.get('/api/v1/recovery/backups/:backupArtifactId/download', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const download = await getBackupExportDownloadById({
      backupArtifactId: request.params.backupArtifactId,
    });

    const safeFilename = String(download.filename ?? 'backup.json')
      .replaceAll('"', '')
      .replaceAll('\r', '')
      .replaceAll('\n', '');

    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    response.setHeader('Content-Type', download.contentType ?? 'application/octet-stream');
    response.send(download.content);
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

    const result = await runIdempotentMutation({
      actorUserId: session.appUserId,
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'recovery.backups.create',
      requestPayload: null,
      statusCode: 202,
      executeMutation: async () => ({
        body: await createBackupExport({
          requestMetadata: getRequestMetadata(request),
          triggeredByUserId: session.appUserId,
        }),
        statusCode: 202,
      }),
    });

    response.status(result.statusCode).json({
      ok: true,
      ...result.body,
    });
  }));

  app.delete('/api/v1/recovery/backups/:backupArtifactId', limitBackupMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await runIdempotentMutation({
      actorUserId: session.appUserId,
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'recovery.backups.delete',
      requestPayload: {
        backupArtifactId: request.params.backupArtifactId,
      },
      statusCode: 200,
      executeMutation: async () => ({
        body: await deleteBackupExportById({
          backupArtifactId: request.params.backupArtifactId,
          requestMetadata: getRequestMetadata(request),
          triggeredByUserId: session.appUserId,
        }),
        statusCode: 200,
      }),
    });

    response.json({
      ok: true,
      ...result.body,
    });
  }));

  app.post('/api/v1/recovery/backups/:backupArtifactId/restore-apply', limitBackupMutation, asyncRoute(async (request, response) => {
    const session = await requireFreshAdminSession(request);
    requireCsrf(request, session);

    const result = await runIdempotentMutation({
      actorUserId: session.appUserId,
      idempotencyKey: request.headers['idempotency-key'],
      operationScope: 'recovery.backups.restoreApply',
      requestPayload: {
        backupArtifactId: request.params.backupArtifactId,
        expectedPayloadSha256: request.body?.expectedPayloadSha256 ?? null,
      },
      statusCode: 202,
      executeMutation: async () => ({
        body: await startBackupRestoreApply({
          backupArtifactId: request.params.backupArtifactId,
          expectedPayloadSha256: request.body?.expectedPayloadSha256,
          requestMetadata: getRequestMetadata(request),
          triggeredByUserId: session.appUserId,
        }),
        statusCode: 202,
      }),
    });

    response.status(result.statusCode).json({
      ok: true,
      ...result.body,
    });
  }));

  app.get('/api/v1/system/diagnostics/queue-state', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    response.json({
      ok: true,
      ...await getQueueDiagnostics({
        runLimit: sanitizePageLimit(request.query.runLimit, { default: 20, max: 50 }),
      }),
    });
  }));

  app.get('/api/v1/system/diagnostics/recovery-state', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const lockTypes = typeof request.query.lockTypes === 'string'
      ? request.query.lockTypes.split(',')
      : [];

    response.json({
      ok: true,
      ...await getRecoveryDiagnostics({
        auditLimit: sanitizePageLimit(request.query.auditLimit, { default: 15, max: 25 }),
        lockTypes,
        runLimit: sanitizePageLimit(request.query.runLimit, { default: 20, max: 50 }),
      }),
    });
  }));

  app.get('/api/v1/system/diagnostics/export', limitDiagnosticsExport, asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const lockTypes = typeof request.query.lockTypes === 'string'
      ? request.query.lockTypes.split(',')
      : [];
    const download = await getDiagnosticsExportDownload({
      activityLimit: sanitizePageLimit(request.query.activityLimit, { default: 20, max: 50 }),
      auditLimit: sanitizePageLimit(request.query.auditLimit, { default: 15, max: 25 }),
      lockTypes,
      notificationLimit: sanitizePageLimit(request.query.notificationLimit, { default: 20, max: 25 }),
      runLimit: sanitizePageLimit(request.query.runLimit, { default: 20, max: 50 }),
    });
    const safeFilename = String(download.filename ?? 'harmoniarr_diagnostics.json')
      .replaceAll('"', '')
      .replaceAll('\r', '')
      .replaceAll('\n', '');

    response.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    response.setHeader('Content-Type', download.contentType ?? 'application/json; charset=utf-8');
    response.send(download.content);
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

  app.get('/api/v1/system/fs/browse', asyncRoute(async (request, response) => {
    await requireAdminSession(request);

    const rawPath = String(request.query.path ?? '/');
    const safePath = resolve(rawPath);
    const parentPath = safePath === sep ? null : dirname(safePath);

    let entries = [];
    let errorMessage = null;
    let errorStatus = null;

    try {
      const dirents = await readdir(safePath, { withFileTypes: true });
      entries = dirents
        .filter((d) => d.isDirectory())
        .map((d) => ({ name: d.name, path: resolve(safePath, d.name) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } catch (error) {
      switch (error?.code) {
        case 'EACCES':
          errorStatus = 403;
          errorMessage = 'Permission denied.';
          break;
        case 'ENOENT':
          errorStatus = 404;
          errorMessage = 'Folder not found.';
          break;
        case 'ENOTDIR':
          errorStatus = 400;
          errorMessage = 'That path is a file, not a folder.';
          break;
        default:
          errorStatus = 500;
          errorMessage = 'Could not read this folder.';
          break;
      }
    }

    if (errorStatus) {
      return response.status(errorStatus).json({
        ok: false,
        path: safePath,
        parent: parentPath,
        entries,
        error: errorMessage,
      });
    }

    response.json({
      ok: true,
      path: safePath,
      parent: parentPath,
      entries,
    });
  }));
}
