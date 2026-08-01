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

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { normalizeImportCandidateApplyScope } from './import-candidate-apply-scope.js';

export function createImportCandidateApplyService({
  assertMaintenanceWriteAllowed = async () => {},
  buildImportPendingCandidateSummary = async () => ({
    counts: {
      ready: 0,
      readyWithWarnings: 0,
      totalImportPending: 0,
    },
  }),
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateApply;

  async function startImportCandidateApplyRun({
    applySafetyMode = 'manual',
    importCandidateIds = null,
    requestMetadata = null,
    triggeredByUserId = null,
    triggerSource = 'manual',
  } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'import_candidate_apply_in_progress', 'An import apply run is already running or queued');
    }

    const scopedCandidateIds = normalizeImportCandidateApplyScope(importCandidateIds);
    const importPendingSummary = await buildImportPendingCandidateSummary({
      ...(scopedCandidateIds ? { candidateIds: scopedCandidateIds } : {}),
      limit: 1000,
    });
    const requestedCandidateCount = importPendingSummary.counts?.totalImportPending ?? 0;
    const readyCandidateCount = importPendingSummary.counts?.ready ?? 0;
    const warningCandidateCount = importPendingSummary.counts?.readyWithWarnings ?? 0;
    const executableCandidateCount = applySafetyMode === 'safe_auto'
      ? readyCandidateCount
      : readyCandidateCount + warningCandidateCount;

    if (requestedCandidateCount < 1) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'No import-pending candidates are available for import apply');
    }

    if (executableCandidateCount < 1) {
      throw createApiError(409, 'import_candidate_apply_not_ready', 'Resolve blocked import-pending candidates before starting import apply');
    }

    const run = await createOperationRun({
      applySafetyMode,
      executableCandidateCount,
      executionMode: 'move',
      ...(scopedCandidateIds ? { importCandidateIds: scopedCandidateIds } : {}),
      requestedCandidateCount,
      status: 'pending',
      triggeredByUserId,
      triggerSource,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        blockedCandidateCount: importPendingSummary.counts?.blocked ?? 0,
        applySafetyMode,
        executableCandidateCount,
        ...(scopedCandidateIds ? { scopedCandidateCount: scopedCandidateIds.length } : {}),
        requestedCandidateCount,
        runId: run.id,
        triggerSource,
        warningCandidateCount,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate library apply started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startImportCandidateApplyRun,
  };
}
