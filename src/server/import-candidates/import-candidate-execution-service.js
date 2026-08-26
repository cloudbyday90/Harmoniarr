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

const MAX_IMPORT_CANDIDATE_ID_LENGTH = 200;

function normalizeOptionalImportCandidateId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'selectedCandidateId must be text');
  }

  const candidateId = value.trim();
  if (candidateId.length === 0 || candidateId.length > MAX_IMPORT_CANDIDATE_ID_LENGTH) {
    throw createApiError(
      400,
      'validation_error',
      `selectedCandidateId must be between 1 and ${MAX_IMPORT_CANDIDATE_ID_LENGTH} characters`,
    );
  }

  return candidateId;
}

function normalizeOptionalWantedReleaseId(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'sourceWantedReleaseId must be text');
  }

  const wantedReleaseId = value.trim();
  if (wantedReleaseId.length === 0 || wantedReleaseId.length > MAX_IMPORT_CANDIDATE_ID_LENGTH) {
    throw createApiError(
      400,
      'validation_error',
      `sourceWantedReleaseId must be between 1 and ${MAX_IMPORT_CANDIDATE_ID_LENGTH} characters`,
    );
  }

  return wantedReleaseId;
}

export function createImportCandidateExecutionService({
  assertMaintenanceWriteAllowed = async () => {},
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  findUnconfirmedImportExecutionHandoff = async () => null,
  getActiveRun = async () => null,
  listImportCandidates = async () => ({
    pagination: { total: 0 },
  }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateExecutionPlanning;

  async function startImportCandidateExecutionRun({
    requestMetadata = null,
    selectedCandidateId = null,
    sourceSearchId = null,
    sourceWantedReleaseId = null,
    triggeredByUserId = null,
    triggerSource = 'manual',
  } = {}) {
    const normalizedSelectedCandidateId = normalizeOptionalImportCandidateId(selectedCandidateId);
    const normalizedSourceWantedReleaseId = normalizeOptionalWantedReleaseId(sourceWantedReleaseId);
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'import_candidate_execution_in_progress', 'An import execution planning run is already running or queued');
    }

    const unconfirmedHandoff = await findUnconfirmedImportExecutionHandoff();
    if (unconfirmedHandoff) {
      throw createApiError(
        409,
        'import_candidate_execution_confirmation_pending',
        'A previous download request is still being confirmed with slskd. Sync transfer state before starting another download run.',
      );
    }

    const selectedCandidates = await listImportCandidates({
      ...(normalizedSelectedCandidateId ? { candidateIds: [normalizedSelectedCandidateId] } : {}),
      limit: 1,
      offset: 0,
      status: 'selected',
    });
    const requestedCandidateCount = selectedCandidates.pagination?.total ?? 0;

    if (requestedCandidateCount < 1) {
      if (normalizedSelectedCandidateId) {
        throw createApiError(
          409,
          'import_candidate_execution_candidate_not_selected',
          'The selected match is no longer ready to start downloading',
        );
      }

      throw createApiError(409, 'import_candidate_execution_not_ready', 'Select at least one candidate before starting execution planning');
    }

    const run = await createOperationRun({
      executionMode: 'download_enqueue',
      requestedCandidateCount,
      status: 'pending',
      summary: {
        currentStep: 'queued',
        executionMode: 'download_enqueue',
        requestedCandidateCount,
        selectedCandidateId: normalizedSelectedCandidateId,
        sourceSearchId,
        sourceWantedReleaseId: normalizedSourceWantedReleaseId,
        triggerSource,
      },
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        requestedCandidateCount,
        runId: run.id,
        selectedCandidateId: normalizedSelectedCandidateId,
        sourceSearchId,
        sourceWantedReleaseId: normalizedSourceWantedReleaseId,
        triggerSource,
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
