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
export const RETRY_REJECTED_TRANSFER_DELAY_MS = 10 * 60 * 1000;

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
  rediscovery = null,
}) {
  const result = {
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

  if (rediscovery) {
    result.rediscovery = rediscovery;
  }

  return result;
}

export function createImportCandidateRecoveryService({
  createRecoveryExecutionRun = null,
  findNextCandidateForRecoveryFn = findNextCandidateForRecovery,
  getNow = () => new Date(),
  getImportCandidate = async () => null,
  incrementImportCandidateDownloadAttemptCountFn = incrementImportCandidateDownloadAttemptCount,
  markImportCandidateDownloadFailed = async () => null,
  maxCandidateDownloadAttempts = MAX_CANDIDATE_DOWNLOAD_ATTEMPTS,
  promoteImportCandidateForRecoveryFn = promoteImportCandidateForRecovery,
  retryImportCandidateDownload = async () => null,
  retryRejectedTransferDelayMs = RETRY_REJECTED_TRANSFER_DELAY_MS,
  scheduleDownloadRecoveryRediscovery = null,
} = {}) {
  async function scheduleRecoveryExecutionRun({
    nextCandidate,
    nextAttemptAt = null,
    operationRunId,
    scheduleFollowUpRun,
    summaryReason = 'transfer_recovery_cascade',
    triggeredByFailedCandidateId,
  }) {
    if (!scheduleFollowUpRun || typeof createRecoveryExecutionRun !== 'function') {
      return null;
    }

    return createRecoveryExecutionRun({
      executionMode: 'download_enqueue',
      nextAttemptAt,
      requestedCandidateCount: 1,
      status: 'pending',
      summary: {
        currentStep: nextAttemptAt
          ? 'queued for delayed transfer retry'
          : 'queued by transfer recovery cascade',
        executionMode: 'download_enqueue',
        recoveryCascade: {
          nextCandidateId: nextCandidate.id,
          reason: summaryReason,
          sourceOperationRunId: operationRunId ?? null,
          triggeredByFailedCandidateId,
        },
        requestedCandidateCount: 1,
      },
      triggeredByUserId: null,
    });
  }

  async function promoteNextRecoveryCandidate({
    failedCandidate,
    failureReason = null,
    failedCandidateId,
    operationRunId = null,
    scheduleFollowUpRun = false,
  } = {}) {
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
      const rediscovery = typeof scheduleDownloadRecoveryRediscovery === 'function'
        ? await scheduleDownloadRecoveryRediscovery({
          failedCandidateId,
          failureReason,
          metadataReleaseId,
          operationRunId,
          sourceSearchId,
        })
        : null;

      if (rediscovery?.scheduled) {
        return buildRecoveryResult({
          failedCandidate,
          reason: 'rediscovery_scheduled',
          recovered: false,
          rediscovery,
        });
      }

      return buildRecoveryResult({
        failedCandidate,
        reason: 'no_recovery_candidate_available',
        recovered: false,
        rediscovery,
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

    return promoteNextRecoveryCandidate({
      failedCandidate,
      failedCandidateId,
      failureReason,
      operationRunId,
      scheduleFollowUpRun,
    });
  }

  async function handleImportCandidateRejectedTransfer({
    failedCandidateId,
    failureReason = null,
    operationRunId = null,
    scheduleFollowUpRun = true,
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

    if ((failedCandidate.downloadAttemptCount ?? 0) < maxCandidateDownloadAttempts) {
      const retryTransition = await retryImportCandidateDownload({
        importCandidateId: failedCandidateId,
        reason: failureReason,
      });
      const retryAt = new Date(getNow().getTime() + retryRejectedTransferDelayMs).toISOString();
      const retryRun = await scheduleRecoveryExecutionRun({
        nextAttemptAt: retryAt,
        nextCandidate: retryTransition?.candidate ?? failedCandidate,
        operationRunId,
        scheduleFollowUpRun,
        summaryReason: 'retry_rejected_transfer',
        triggeredByFailedCandidateId: failedCandidateId,
      });

      return {
        ...buildRecoveryResult({
          attemptedCandidate: retryTransition?.candidate ?? failedCandidate,
          failedCandidate,
          reason: 'candidate_retry_scheduled',
          recoveryRun: retryRun,
          recovered: true,
        }),
        retryAt,
        retrySameCandidate: true,
      };
    }

    await markImportCandidateDownloadFailed({
      importCandidateId: failedCandidateId,
      reason: `${failureReason ?? 'Transfer was rejected by the remote peer.'} Retry attempts exhausted.`,
    });

    return promoteNextRecoveryCandidate({
      failedCandidate,
      failedCandidateId,
      failureReason,
      operationRunId,
      scheduleFollowUpRun,
    });
  }

  return {
    handleImportCandidateDownloadFailure,
    handleImportCandidateRejectedTransfer,
  };
}
