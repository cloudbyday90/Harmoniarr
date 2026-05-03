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

import { createControlPlaneRedactionService } from './control-plane-redaction-service.js';

function normalizeLimit(limit, { defaultLimit = 10, maxLimit = 25 } = {}) {
  const parsed = Number.parseInt(limit, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultLimit;
  }

  return Math.min(parsed, maxLimit);
}

function normalizeLockTypeFilter(lockTypes) {
  if (!Array.isArray(lockTypes)) {
    return [];
  }

  return lockTypes
    .filter((lockType) => typeof lockType === 'string' && lockType.trim().length > 0)
    .map((lockType) => lockType.trim().toLowerCase());
}

function formatExportTimestamp(dateValue) {
  return dateValue.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function summarizeActivityEntries(entries, controlPlaneRedactionService) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.map((entry) => ({
    entityId: entry.entityId ?? null,
    entityType: entry.entityType ?? null,
    entryType: entry.entryType ?? null,
    eventType: entry.eventType ?? null,
    id: entry.id,
    message: controlPlaneRedactionService.redactLogMessage(entry.message ?? null),
    occurredAt: entry.occurredAt ?? null,
    operationType: entry.operationType ?? null,
    runId: entry.runId ?? null,
    status: entry.status ?? null,
    title: entry.title ?? null,
  }));
}

function summarizeNotifications(notifications, controlPlaneRedactionService) {
  if (!Array.isArray(notifications)) {
    return [];
  }

  return notifications.map((notification) => ({
    category: notification.category ?? null,
    id: notification.id,
    message: controlPlaneRedactionService.redactLogMessage(notification.message ?? null),
    occurredAt: notification.occurredAt ?? null,
    requiresAction: notification.requiresAction ?? false,
    severity: notification.severity ?? null,
    title: notification.title ?? null,
  }));
}

function summarizeOverview(overview, controlPlaneRedactionService) {
  if (!overview || typeof overview !== 'object') {
    return null;
  }

  return {
    artworkMaintenance: overview.artworkMaintenance ?? null,
    database: overview.database ?? null,
    dependencies: Array.isArray(overview.dependencies)
      ? overview.dependencies.map((dependency) => ({
        code: dependency.code ?? null,
        details: controlPlaneRedactionService.redactValue(dependency.details ?? null),
        message: controlPlaneRedactionService.redactLogMessage(dependency.message ?? null),
        observedAt: dependency.observedAt ?? null,
        provider: dependency.provider ?? null,
        status: dependency.status ?? null,
      }))
      : [],
    heartbeats: Array.isArray(overview.heartbeats)
      ? overview.heartbeats.map((heartbeat) => ({
        intervalLabel: heartbeat.intervalLabel ?? null,
        intervalMs: heartbeat.intervalMs ?? null,
        key: heartbeat.key,
        label: heartbeat.label ?? null,
        lastErrorMessage: controlPlaneRedactionService.redactLogMessage(heartbeat.lastErrorMessage ?? null),
        lastPauseProvider: heartbeat.lastPauseProvider ?? null,
        lastSkipReason: heartbeat.lastSkipReason ?? null,
        lastTickAt: heartbeat.lastTickAt ?? null,
        lastTriggeredAt: heartbeat.lastTriggeredAt ?? null,
        message: controlPlaneRedactionService.redactLogMessage(heartbeat.message ?? null),
        mode: heartbeat.mode ?? null,
        nextRetryAt: heartbeat.nextRetryAt ?? null,
        source: heartbeat.source ?? null,
        status: heartbeat.status ?? null,
      }))
      : [],
    pathValidation: overview.pathValidation ?? null,
    runtime: overview.runtime
      ? {
        configuration: overview.runtime.configuration
          ? {
            mediaCommands: overview.runtime.configuration.mediaCommands ?? null,
            processMonitoring: overview.runtime.configuration.processMonitoring ?? null,
            sharp: overview.runtime.configuration.sharp ?? null,
            threading: overview.runtime.configuration.threading ?? null,
          }
          : null,
        latestSample: overview.runtime.latestSample ?? null,
        message: controlPlaneRedactionService.redactLogMessage(overview.runtime.message ?? null),
        status: overview.runtime.status ?? null,
        warnings: Array.isArray(overview.runtime.warnings)
          ? overview.runtime.warnings.map((warning) => ({
            ...warning,
            message: controlPlaneRedactionService.redactLogMessage(warning.message ?? null),
          }))
          : [],
      }
      : null,
    service: overview.service ?? null,
  };
}

function summarizeQueueDiagnostics(queueDiagnostics, controlPlaneRedactionService) {
  if (!queueDiagnostics || typeof queueDiagnostics !== 'object') {
    return null;
  }

  return {
    checkedAt: queueDiagnostics.checkedAt ?? null,
    queueState: queueDiagnostics.queueState ?? null,
    recentRuns: Array.isArray(queueDiagnostics.recentRuns)
      ? queueDiagnostics.recentRuns.map((run) => ({
        errorMessage: controlPlaneRedactionService.redactErrorMessage(run.errorMessage ?? null),
        finishedAt: run.finishedAt ?? null,
        id: run.id,
        operationType: run.operationType ?? null,
        startedAt: run.startedAt ?? null,
        status: run.status ?? null,
        summary: controlPlaneRedactionService.redactOperationSummary(run.summary ?? {}),
        triggeredByUserId: run.triggeredByUserId ?? null,
      }))
      : [],
  };
}

export function createDiagnosticsExportService({
  controlPlaneRedactionService = createControlPlaneRedactionService(),
  getOperatorNotifications = async () => ({
    checkedAt: new Date().toISOString(),
    counts: {
      actionable: 0,
      byCategory: {},
      total: 0,
    },
    notifications: [],
  }),
  getOverview = async () => ({}),
  getQueueDiagnostics = async () => ({}),
  getRecoveryDiagnostics = async () => ({}),
  nowFn = () => new Date(),
} = {}) {
  async function buildDiagnosticsExport({
    activityLimit,
    auditLimit,
    lockTypes,
    notificationLimit,
    runLimit,
  } = {}) {
    const normalizedActivityLimit = normalizeLimit(activityLimit, { defaultLimit: 20, maxLimit: 50 });
    const normalizedAuditLimit = normalizeLimit(auditLimit, { defaultLimit: 15, maxLimit: 25 });
    const normalizedNotificationLimit = normalizeLimit(notificationLimit, { defaultLimit: 20, maxLimit: 25 });
    const normalizedRunLimit = normalizeLimit(runLimit, { defaultLimit: 20, maxLimit: 50 });
    const normalizedLockTypes = normalizeLockTypeFilter(lockTypes);
    const exportedAt = nowFn();

    const [overview, operatorNotifications, queueDiagnostics, recoveryDiagnostics] = await Promise.all([
      getOverview({
        activityFeedLimit: normalizedActivityLimit,
        includeDependencies: true,
      }),
      getOperatorNotifications({
        limit: normalizedNotificationLimit,
      }),
      getQueueDiagnostics({
        runLimit: normalizedRunLimit,
      }),
      getRecoveryDiagnostics({
        auditLimit: normalizedAuditLimit,
        lockTypes: normalizedLockTypes,
        runLimit: normalizedRunLimit,
      }),
    ]);

    return {
      checkedAt: exportedAt.toISOString(),
      diagnostics: {
        activityFeed: {
          checkedAt: overview.activityFeed?.checkedAt ?? null,
          entries: summarizeActivityEntries(
            overview.activityFeed?.entries ?? [],
            controlPlaneRedactionService,
          ),
          pageInfo: overview.activityFeed?.pageInfo ?? {
            hasMore: false,
            nextCursor: null,
          },
        },
        operatorNotifications: {
          checkedAt: operatorNotifications.checkedAt ?? null,
          counts: operatorNotifications.counts ?? {
            actionable: 0,
            byCategory: {},
            total: 0,
          },
          notifications: summarizeNotifications(
            operatorNotifications.notifications ?? [],
            controlPlaneRedactionService,
          ),
        },
        overview: summarizeOverview(overview, controlPlaneRedactionService),
        queue: summarizeQueueDiagnostics(queueDiagnostics, controlPlaneRedactionService),
        recovery: controlPlaneRedactionService.redactValue(recoveryDiagnostics),
      },
      exportType: 'system_diagnostics',
      formatVersion: '1',
      guidance: {
        notes: [
          'This export is redacted for support-oriented sharing and excludes paths, tokens, session material, and decrypted backup content where the current shared policy can detect them.',
          'Prefer canonical run ids, audit ids, and route deep links for follow-up instead of copying raw incident payloads into external systems.',
        ],
      },
      source: {
        activityLimit: normalizedActivityLimit,
        auditLimit: normalizedAuditLimit,
        lockTypes: normalizedLockTypes,
        notificationLimit: normalizedNotificationLimit,
        runLimit: normalizedRunLimit,
      },
    };
  }

  async function getDiagnosticsExportDownload(options = {}) {
    const exportPayload = await buildDiagnosticsExport(options);
    const filename = `harmoniarr_diagnostics_${formatExportTimestamp(nowFn())}.json`;

    return {
      content: Buffer.from(`${JSON.stringify(exportPayload, null, 2)}\n`, 'utf8'),
      contentType: 'application/json; charset=utf-8',
      filename,
    };
  }

  return {
    buildDiagnosticsExport,
    getDiagnosticsExportDownload,
  };
}
