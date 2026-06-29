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

function normalizeMusicQueueContext(candidate, {
  profileCode = null,
  qualityOverride = null,
} = {}) {
  const candidateContext = candidate?.normalizedPayload?.musicQueue ?? {};
  const resolvedProfileCode = normalizeOptionalString(profileCode)
    ?? normalizeOptionalString(candidateContext.profileCode)
    ?? null;
  const resolvedQualityOverride = qualityOverride
    ?? (candidateContext.qualityOverride && typeof candidateContext.qualityOverride === 'object'
      ? candidateContext.qualityOverride
      : null);

  return {
    profileCode: resolvedProfileCode,
    qualityOverride: resolvedQualityOverride,
  };
}

function resolveQualitySkippedReason(quality) {
  if (!quality) {
    return null;
  }

  if (quality.autoDownloadEligible === true || quality.code === 'accepted') {
    return null;
  }

  if (quality.code === 'below_minimum') return 'quality_below_minimum';
  if (quality.code === 'needs_verification') return 'quality_needs_verification';
  if (quality.code === 'no_evidence') return 'quality_no_evidence';
  return 'quality_not_eligible';
}

function buildSkippedRecoveryCandidate(candidate, { quality, reason }) {
  return {
    candidateId: candidate?.id ?? null,
    formats: Array.isArray(quality?.formats) ? quality.formats.slice(0, 8) : [],
    qualityCode: quality?.code ?? null,
    reason,
  };
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
  skippedCandidates = [],
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

  if (skippedCandidates.length > 0) {
    result.skippedCandidateCount = skippedCandidates.length;
    result.skippedCandidates = skippedCandidates.slice(0, 5);
  }

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
  markImportCandidateQualityFailed = async () => null,
  maxCandidateDownloadAttempts = MAX_CANDIDATE_DOWNLOAD_ATTEMPTS,
  promoteImportCandidateForRecoveryFn = promoteImportCandidateForRecovery,
  qualityPolicyService = null,
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
    profileCode = null,
    qualityOverride = null,
    recoverySummaryReason = 'transfer_recovery_cascade',
    scheduleFollowUpRun = false,
  } = {}) {
    const sourceSearchId = normalizeOptionalString(failedCandidate.sourceSearchId);
    const metadataReleaseId = resolveMetadataReleaseId(failedCandidate);
    const musicQueueContext = normalizeMusicQueueContext(failedCandidate, {
      profileCode,
      qualityOverride,
    });

    if (!sourceSearchId && !metadataReleaseId) {
      return buildRecoveryResult({
        failedCandidate,
        reason: 'recovery_scope_unavailable',
        recovered: false,
      });
    }

    const excludedCandidateIds = [failedCandidateId];
    const skippedCandidates = [];
    let nextCandidate = null;

    for (let attemptIndex = 0; attemptIndex < 25; attemptIndex += 1) {
      const candidate = await findNextCandidateForRecoveryFn({
        excludeCandidateId: failedCandidateId,
        ...(excludedCandidateIds.length > 1 ? { excludeCandidateIds: excludedCandidateIds } : {}),
        maxDownloadAttemptCount: maxCandidateDownloadAttempts,
        metadataReleaseId,
        sourceSearchId,
      });

      if (!candidate) {
        break;
      }

      const quality = typeof qualityPolicyService?.evaluateQualityEvidence === 'function'
        ? qualityPolicyService.evaluateQualityEvidence({
          candidate,
          profileCode: musicQueueContext.profileCode ?? undefined,
          qualityOverride: musicQueueContext.qualityOverride,
        })
        : null;
      const qualitySkippedReason = resolveQualitySkippedReason(quality);
      if (!qualitySkippedReason) {
        nextCandidate = candidate;
        break;
      }

      skippedCandidates.push(buildSkippedRecoveryCandidate(candidate, {
        quality,
        reason: qualitySkippedReason,
      }));
      excludedCandidateIds.push(candidate.id);
    }

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
          skippedCandidates,
        });
      }

      return buildRecoveryResult({
        failedCandidate,
        reason: skippedCandidates.length > 0
          ? 'no_quality_eligible_recovery_candidate_available'
          : 'no_recovery_candidate_available',
        recovered: false,
        rediscovery,
        skippedCandidates,
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
        skippedCandidates,
      });
    }

    const recoveryRun = await scheduleRecoveryExecutionRun({
      nextCandidate: promotedCandidate,
      operationRunId,
      summaryReason: recoverySummaryReason,
      scheduleFollowUpRun,
      triggeredByFailedCandidateId: failedCandidateId,
    });

    return buildRecoveryResult({
      attemptedCandidate: promotedCandidate,
      failedCandidate,
      reason: 'candidate_promoted',
      recoveryRun,
      recovered: true,
      skippedCandidates,
    });
  }

  async function handleImportCandidateDownloadFailure({
    failedCandidateId,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityOverride = null,
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
      profileCode,
      qualityOverride,
      scheduleFollowUpRun,
    });
  }

  async function handleImportCandidateQualityFailure({
    failedCandidateId,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityLabel = 'quality_blocked',
    qualityOverride = null,
    qualityWeight = 0,
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

    const transitionResult = await markImportCandidateQualityFailed({
      importCandidateId: failedCandidateId,
      qualityLabel,
      qualityWeight,
      reason: failureReason,
    });
    const failedAfterTransition = transitionResult?.candidate ?? failedBeforeAttempt;
    const failedCandidate = await incrementImportCandidateDownloadAttemptCountFn({
      importCandidateId: failedCandidateId,
    }) ?? failedAfterTransition;

    return promoteNextRecoveryCandidate({
      failedCandidate,
      failedCandidateId,
      failureReason,
      operationRunId,
      profileCode,
      qualityOverride,
      recoverySummaryReason: 'quality_stop_recovery_cascade',
      scheduleFollowUpRun,
    });
  }

  async function handleImportCandidateRejectedTransfer({
    failedCandidateId,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityOverride = null,
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
      profileCode,
      qualityOverride,
      scheduleFollowUpRun,
    });
  }

  return {
    handleImportCandidateDownloadFailure,
    handleImportCandidateQualityFailure,
    handleImportCandidateRejectedTransfer,
  };
}
