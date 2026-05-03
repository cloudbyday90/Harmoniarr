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

export function createImportCandidateExecutionService({
  assertMaintenanceWriteAllowed = async () => {},
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  listImportCandidates = async () => ({
    pagination: { total: 0 },
  }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateExecutionPlanning;

  async function startImportCandidateExecutionRun({ requestMetadata = null, triggeredByUserId = null } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'import_candidate_execution_in_progress', 'An import execution planning run is already running or queued');
    }

    const selectedCandidates = await listImportCandidates({
      limit: 1,
      offset: 0,
      status: 'selected',
    });
    const requestedCandidateCount = selectedCandidates.pagination?.total ?? 0;

    if (requestedCandidateCount < 1) {
      throw createApiError(409, 'import_candidate_execution_not_ready', 'Select at least one candidate before starting execution planning');
    }

    const run = await createOperationRun({
      executionMode: 'download_enqueue',
      requestedCandidateCount,
      status: 'pending',
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        requestedCandidateCount,
        runId: run.id,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate download enqueue started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startImportCandidateExecutionRun,
  };
}