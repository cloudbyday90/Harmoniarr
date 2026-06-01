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

import {
  findNextCandidateForRecovery,
  incrementImportCandidateDownloadAttemptCount,
  promoteImportCandidateForRecovery,
} from './import-candidate-repository.js';

export const MAX_CANDIDATE_DOWNLOAD_ATTEMPTS = 3;

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function resolveMetadataReleaseId(candidate) {
  return normalizeOptionalString(candidate?.metadataReleaseId)
    ?? normalizeOptionalString(candidate?.normalizedPayload?.requestOwnership?.metadataReleaseId);
}

function buildRecoveryResult({
  attemptedCandidate = null,
  failedCandidate,
  reason,
  recoveryRun = null,
  recovered,
}) {
  return {
    attemptedCandidateId: attemptedCandidate?.id ?? null,
    failedAttemptCount: failedCandidate?.downloadAttemptCount ?? null,
    failedCandidateId: failedCandidate?.id ?? null,
    metadataReleaseId: resolveMetadataReleaseId(failedCandidate),
    nextCandidateId: recovered ? attemptedCandidate?.id ?? null : null,
    reason,
    recovered,
    recoveryRunId: recoveryRun?.id ?? null,
    sourceSearchId: failedCandidate?.sourceSearchId ?? null,
  };
}

export function createImportCandidateRecoveryService({
  createRecoveryExecutionRun = null,
  findNextCandidateForRecoveryFn = findNextCandidateForRecovery,
  getImportCandidate = async () => null,
  incrementImportCandidateDownloadAttemptCountFn = incrementImportCandidateDownloadAttemptCount,
  maxCandidateDownloadAttempts = MAX_CANDIDATE_DOWNLOAD_ATTEMPTS,
  promoteImportCandidateForRecoveryFn = promoteImportCandidateForRecovery,
} = {}) {
  async function scheduleRecoveryExecutionRun({
    nextCandidate,
    operationRunId,
    scheduleFollowUpRun,
    triggeredByFailedCandidateId,
  }) {
    if (!scheduleFollowUpRun || typeof createRecoveryExecutionRun !== 'function') {
      return null;
    }

    return createRecoveryExecutionRun({
      executionMode: 'download_enqueue',
      requestedCandidateCount: 1,
      status: 'pending',
      summary: {
        currentStep: 'queued by transfer recovery cascade',
        executionMode: 'download_enqueue',
        recoveryCascade: {
          nextCandidateId: nextCandidate.id,
          sourceOperationRunId: operationRunId ?? null,
          triggeredByFailedCandidateId,
        },
        requestedCandidateCount: 1,
      },
      triggeredByUserId: null,
    });
  }

  async function handleImportCandidateDownloadFailure({
    failedCandidateId,
    failureReason = null,
    operationRunId = null,
    scheduleFollowUpRun = false,
  } = {}) {
    const failedBeforeAttempt = await getImportCandidate({ importCandidateId: failedCandidateId });
    if (!failedBeforeAttempt) {
      return buildRecoveryResult({
        failedCandidate: null,
        reason: 'failed_candidate_not_found',
        recovered: false,
      });
    }

    const failedCandidate = await incrementImportCandidateDownloadAttemptCountFn({
      importCandidateId: failedCandidateId,
    }) ?? failedBeforeAttempt;
    const sourceSearchId = normalizeOptionalString(failedCandidate.sourceSearchId);
    const metadataReleaseId = resolveMetadataReleaseId(failedCandidate);

    if (!sourceSearchId && !metadataReleaseId) {
      return buildRecoveryResult({
        failedCandidate,
        reason: 'recovery_scope_unavailable',
        recovered: false,
      });
    }

    const nextCandidate = await findNextCandidateForRecoveryFn({
      excludeCandidateId: failedCandidateId,
      maxDownloadAttemptCount: maxCandidateDownloadAttempts,
      metadataReleaseId,
      sourceSearchId,
    });

    if (!nextCandidate) {
      return buildRecoveryResult({
        failedCandidate,
        reason: 'no_recovery_candidate_available',
        recovered: false,
      });
    }

    const promotedCandidate = await promoteImportCandidateForRecoveryFn({
      importCandidateId: nextCandidate.id,
      maxDownloadAttemptCount: maxCandidateDownloadAttempts,
      reason: failureReason,
      triggeredByFailedCandidateId: failedCandidateId,
    });

    if (!promotedCandidate) {
      return buildRecoveryResult({
        attemptedCandidate: nextCandidate,
        failedCandidate,
        reason: 'recovery_candidate_no_longer_selectable',
        recovered: false,
      });
    }

    const recoveryRun = await scheduleRecoveryExecutionRun({
      nextCandidate: promotedCandidate,
      operationRunId,
      scheduleFollowUpRun,
      triggeredByFailedCandidateId: failedCandidateId,
    });

    return buildRecoveryResult({
      attemptedCandidate: promotedCandidate,
      failedCandidate,
      reason: 'candidate_promoted',
      recoveryRun,
      recovered: true,
    });
  }

  return {
    handleImportCandidateDownloadFailure,
  };
}
