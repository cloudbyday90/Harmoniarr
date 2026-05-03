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

import { getPool } from '../database.js';

const privilegedRecoveryEventTypes = new Set([
  'backup_restore_started',
  'backup_restore_completed',
  'backup_restore_failed',
  'maintenance_lock_entered',
  'maintenance_lock_released',
]);

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

export function createRecoveryDiagnosticsService({
  getPoolFn = getPool,
  listActiveMaintenanceLocks = async () => [],
  listRecentAuditEvents = async () => [],
  listRecentOperationRuns = async () => [],
  nowFn = () => new Date(),
} = {}) {
  async function getQueueDiagnostics({ runLimit } = {}) {
    const normalizedRunLimit = normalizeLimit(runLimit, { defaultLimit: 20, maxLimit: 50 });
    const [summaryResult, recentRuns] = await Promise.all([
      getPoolFn().query(
        `
          SELECT status, COUNT(*)::int AS count
          FROM operation_runs
          WHERE status IN ('pending', 'running', 'failed')
          GROUP BY status
        `,
      ),
      listRecentOperationRuns({ limit: normalizedRunLimit }),
    ]);

    const statusCounts = {
      failed: 0,
      pending: 0,
      running: 0,
    };

    for (const row of summaryResult.rows) {
      if (Object.hasOwn(statusCounts, row.status)) {
        statusCounts[row.status] = Number.isFinite(row.count) ? row.count : Number.parseInt(row.count, 10) || 0;
      }
    }

    return {
      checkedAt: nowFn().toISOString(),
      queueState: {
        ...statusCounts,
        totalTracked: statusCounts.pending + statusCounts.running + statusCounts.failed,
      },
      recentRuns,
    };
  }

  async function getRecoveryDiagnostics({ auditLimit, lockTypes, runLimit } = {}) {
    const normalizedAuditLimit = normalizeLimit(auditLimit, { defaultLimit: 15, maxLimit: 25 });
    const normalizedRunLimit = normalizeLimit(runLimit, { defaultLimit: 20, maxLimit: 50 });
    const normalizedLockTypes = normalizeLockTypeFilter(lockTypes);

    const [maintenanceLocks, recentRuns, recentAuditEvents] = await Promise.all([
      listActiveMaintenanceLocks({ lockTypes: normalizedLockTypes.length > 0 ? normalizedLockTypes : null }),
      listRecentOperationRuns({ limit: normalizedRunLimit }),
      listRecentAuditEvents({ limit: normalizedAuditLimit }),
    ]);

    const recentFailedRuns = recentRuns
      .filter((run) => run?.status === 'failed')
      .slice(0, normalizedAuditLimit)
      .map((run) => ({
        errorMessage: run.errorMessage ?? null,
        finishedAt: run.finishedAt ?? null,
        id: run.id,
        operationType: run.operationType,
        startedAt: run.startedAt ?? null,
        summary: run.summary ?? {},
        triggeredByUserId: run.triggeredByUserId ?? null,
      }));

    const recentPrivilegedActions = recentAuditEvents
      .filter((event) => privilegedRecoveryEventTypes.has(event?.eventType))
      .slice(0, normalizedAuditLimit)
      .map((event) => ({
        details: event.details ?? {},
        entityId: event.entityId ?? null,
        entityType: event.entityType ?? null,
        eventType: event.eventType,
        id: event.id,
        occurredAt: event.occurredAt ?? null,
        summary: event.summary ?? null,
      }));

    return {
      checkedAt: nowFn().toISOString(),
      maintenance: {
        activeLocks: maintenanceLocks,
        hasActiveLocks: maintenanceLocks.length > 0,
        lockCount: maintenanceLocks.length,
        lockTypes: normalizedLockTypes,
      },
      recentFailedRuns,
      recentPrivilegedActions,
    };
  }

  return {
    getQueueDiagnostics,
    getRecoveryDiagnostics,
  };
}
