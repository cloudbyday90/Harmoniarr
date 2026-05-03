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

function countTranscodeCandidates(files = []) {
  return files.filter((file) => file?.transcodePlan?.recommendedAction === 'transcode_candidate').length;
}

export function createImportCandidateTranscodeService({
  assertMaintenanceWriteAllowed = async () => {},
  buildSelectedImportCandidateSummary = async () => ({
    selectedCandidates: [],
  }),
  createOperationRun = async () => {
    throw new Error('createOperationRun dependency is required');
  },
  getActiveRun = async () => null,
  previewImportCandidateApply = async () => ({ files: [] }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const operationDescriptor = operationRunRegistry.importCandidateTranscodeOrchestration;

  async function startImportCandidateTranscodeRun({ requestMetadata = null, triggeredByUserId = null } = {}) {
    await assertMaintenanceWriteAllowed();

    const activeRun = await getActiveRun();
    if (activeRun) {
      throw createApiError(409, 'import_candidate_transcode_in_progress', 'A transcode orchestration run is already running or queued');
    }

    const selectedSummary = await buildSelectedImportCandidateSummary({ limit: 250 });
    const selectedCandidates = selectedSummary?.selectedCandidates ?? [];

    if (selectedCandidates.length < 1) {
      throw createApiError(409, 'import_candidate_transcode_not_ready', 'Select at least one candidate before starting transcode orchestration');
    }

    let transcodeCandidateFileCount = 0;
    for (const candidate of selectedCandidates) {
      if (candidate?.executionStatus?.code === 'blocked') {
        continue;
      }

      const applyPreview = await previewImportCandidateApply({
        importCandidateId: candidate.id,
      });
      transcodeCandidateFileCount += countTranscodeCandidates(applyPreview.files ?? []);
    }

    if (transcodeCandidateFileCount < 1) {
      throw createApiError(409, 'import_candidate_transcode_no_candidates', 'No selected files currently require transcode orchestration');
    }

    const run = await createOperationRun({
      requestedCandidateCount: selectedCandidates.length,
      status: 'pending',
      transcodeCandidateFileCount,
      triggeredByUserId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        requestedCandidateCount: selectedCandidates.length,
        runId: run.id,
        transcodeCandidateFileCount,
      },
      entityId: run.id,
      entityType: 'operation_run',
      eventType: operationDescriptor.startedEventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Import candidate transcode orchestration started',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      run,
    };
  }

  return {
    startImportCandidateTranscodeRun,
  };
}
