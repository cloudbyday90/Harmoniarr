/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { lockImportCandidateApplyCreation, lockImportPendingCandidates } from './import-candidate-apply-queue-store.js';

export function createImportCandidateApplyQueueService({ assertMaintenanceWriteAllowed, createOperationRun, getActiveRun,
  recordAuditEventFn = recordAuditEvent, withTransaction = createDatabaseTransactionRunner(),
  lockRunCreation = lockImportCandidateApplyCreation, lockPendingCandidates = lockImportPendingCandidates,
} = {}) {
  for (const [name, dependency] of Object.entries({ assertMaintenanceWriteAllowed, createOperationRun, getActiveRun,
    recordAuditEventFn, withTransaction, lockRunCreation, lockPendingCandidates })) {
    if (typeof dependency !== 'function') throw new TypeError(`createImportCandidateApplyQueueService requires ${name}`);
  }
  async function queuePreparedImportCandidateApply({ applySafetyMode, importCandidateIds, preparedSummary,
    automaticLibraryAddAuthority = null,
    queryable = null, requestMetadata = null, triggeredByUserId = null, triggerSource = 'manual' }) {
    const work = async (client) => {
      await assertMaintenanceWriteAllowed({ queryable: client });
      await lockRunCreation({ queryable: client });
      if (await getActiveRun({ queryable: client })) {
        throw createApiError(409, 'import_candidate_apply_in_progress', 'An import apply run is already running or queued');
      }
      const candidateIds = preparedSummary.importPendingCandidates?.map((candidate) => candidate.id) ?? importCandidateIds ?? [];
      if (!await lockPendingCandidates({ candidateIds, queryable: client })) {
        throw createApiError(409, 'import_candidate_apply_not_ready', 'The prepared import candidates have changed');
      }
      const counts = preparedSummary.counts ?? {};
      const requestedCandidateCount = counts.totalImportPending ?? 0;
      const warningCandidateCount = counts.readyWithWarnings ?? 0;
      const executableCandidateCount = (counts.ready ?? 0) + (applySafetyMode === 'safe_auto' ? 0 : warningCandidateCount);
      if (requestedCandidateCount < 1 || executableCandidateCount < 1) {
        throw createApiError(409, 'import_candidate_apply_not_ready', 'No prepared import-pending candidates are executable');
      }
      const run = await createOperationRun({ queryable: client, applySafetyMode, executableCandidateCount,
        ...(automaticLibraryAddAuthority ? { automaticLibraryAddAuthority } : {}),
        executionMode: 'move', ...(importCandidateIds ? { importCandidateIds } : {}), requestedCandidateCount,
        status: 'pending', triggeredByUserId, triggerSource });
      await recordAuditEventFn({ actorType: triggeredByUserId ? 'user' : 'system', actorUserId: triggeredByUserId,
        details: { blockedCandidateCount: counts.blocked ?? 0, applySafetyMode, executableCandidateCount,
          ...(importCandidateIds ? { scopedCandidateCount: importCandidateIds.length } : {}), requestedCandidateCount,
          runId: run.id, triggerSource, warningCandidateCount }, entityId: run.id, entityType: 'operation_run',
        eventType: operationRunRegistry.importCandidateApply.startedEventType,
        ipAddress: requestMetadata?.ipAddress ?? null, summary: 'Import candidate library apply started',
        userAgent: requestMetadata?.userAgent ?? null }, client);
      return { accepted: true, run };
    };
    return queryable ? work(queryable) : withTransaction(work);
  }
  return { queuePreparedImportCandidateApply };
}
