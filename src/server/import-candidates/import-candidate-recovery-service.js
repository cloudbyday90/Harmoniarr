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
} from './import-candidate-repository.js';
import { createImportCandidateRecoveryPromotionService } from './import-candidate-recovery-promotion-service.js';
import {
  deriveImportCandidateAddRecoveryReasonCode,
  normalizeImportCandidateAddBlockerCode,
} from './import-candidate-add-blocker.js';
import { TERMINAL_MATCH_OUTCOME_CODES } from './import-candidate-terminal-recovery-policy.js';
import { hasPersistedMusicQueueOwnership } from './import-candidate-music-queue-auto-safe-add-policy.js';
import { canRetainRecoveryQualityContext, requiresRecoveryQualityContextGuard } from './import-candidate-recovery-quality-policy.js';

export const MAX_CANDIDATE_DOWNLOAD_ATTEMPTS = 3;
export const RETRY_REJECTED_TRANSFER_DELAY_MS = 10 * 60 * 1000;

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeMusicQueueContext(candidate, {
  profileCode = null,
  qualityOverride = undefined,
} = {}) {
  const candidateContext = candidate?.normalizedPayload?.musicQueue ?? {};
  const resolvedProfileCode = normalizeOptionalString(profileCode)
    ?? normalizeOptionalString(candidateContext.profileCode)
    ?? null;
  const resolvedQualityOverride = qualityOverride === undefined
    ? (candidateContext.qualityOverride && typeof candidateContext.qualityOverride === 'object'
      ? candidateContext.qualityOverride
      : null) : qualityOverride;

  return {
    profileCode: resolvedProfileCode,
    qualityOverride: resolvedQualityOverride,
    ...(typeof candidateContext.minimumBitrateKbps === 'number' && Number.isFinite(candidateContext.minimumBitrateKbps)
      && candidateContext.minimumBitrateKbps >= 256 && candidateContext.minimumBitrateKbps <= 10_000
      ? { minimumBitrateKbps: candidateContext.minimumBitrateKbps } : {}),
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
    ?? normalizeOptionalString(candidate?.normalizedPayload?.discoveryScope?.metadataReleaseId)
    ?? normalizeOptionalString(candidate?.normalizedPayload?.requestOwnership?.metadataReleaseId);
}

function buildRecoveryResult({
  addBlockerCode = null,
  attemptedCandidate = null,
  failedCandidate,
  reason,
  recoveryRun = null,
  recovered,
  recoveryReasonCode = null,
  rediscovery = null,
  requiresOperator = false,
  skippedCandidates = [],
  terminalOutcome = null,
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

  if (terminalOutcome) {
    result.terminalOutcome = terminalOutcome;
  }

  const normalizedAddBlockerCode = normalizeImportCandidateAddBlockerCode(addBlockerCode);
  if (normalizedAddBlockerCode) {
    result.addBlockerCode = normalizedAddBlockerCode;
  }

  if (recoveryReasonCode) {
    result.recoveryReasonCode = recoveryReasonCode;
  }

  if (requiresOperator) {
    result.requiresOperator = true;
  }

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
  musicQueueRecoveryService = null,
  findNextCandidateForRecoveryFn = findNextCandidateForRecovery,
  getNow = () => new Date(),
  getImportCandidate = async () => null,
  incrementImportCandidateDownloadAttemptCountFn = incrementImportCandidateDownloadAttemptCount,
  markImportCandidateDownloadFailed = async () => null,
  markImportCandidateImportBlocked = async () => null,
  markImportCandidateQualityFailed = async () => null,
  maxCandidateDownloadAttempts = MAX_CANDIDATE_DOWNLOAD_ATTEMPTS,
  promoteImportCandidateForRecoveryFn = createImportCandidateRecoveryPromotionService().promoteRecoveryCandidate,
  qualityPolicyService = null,
  retryImportCandidateDownload = async () => null,
  retryRejectedTransferDelayMs = RETRY_REJECTED_TRANSFER_DELAY_MS,
  scheduleDownloadRecoveryRediscovery = null,
} = {}) {
  async function ownsRecoveryCandidate(input) {
    return musicQueueRecoveryService ? musicQueueRecoveryService.ownsRecoveryCandidate(input) : hasPersistedMusicQueueOwnership(input.candidate);
  }
  async function delegateScoped(kind, input) {
    const candidate = await getImportCandidate({ importCandidateId: input.failedCandidateId });
    if (!musicQueueRecoveryService) {
      if (hasPersistedMusicQueueOwnership(candidate)) throw new TypeError('Music Queue recovery owner is required');
      return null;
    }
    if (!candidate || !await ownsRecoveryCandidate({ candidate, operationRunId: input.operationRunId })) return null;
    return musicQueueRecoveryService.handleMusicQueueRecovery({ kind, ...input });
  }
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
    allowRediscovery = true,
    failedCandidate,
    failureReason = null,
    failedCandidateId,
    operationRunId = null,
    profileCode = null,
    qualityOverride = undefined,
    recoverySummaryReason = 'transfer_recovery_cascade',
    scheduleFollowUpRun = false,
    terminalOutcome = null,
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
        terminalOutcome,
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

      if (!canRetainRecoveryQualityContext({ candidate, failedCandidate, requiredContext: musicQueueContext })) {
        skippedCandidates.push(buildSkippedRecoveryCandidate(candidate, {
          quality: null,
          reason: 'recovery_quality_context_incompatible',
        }));
        excludedCandidateIds.push(candidate.id);
        continue;
      }

      const candidateQualityContext = requiresRecoveryQualityContextGuard(musicQueueContext)
        ? normalizeMusicQueueContext(candidate, { profileCode: candidate.normalizedPayload?.musicQueue?.profileCode ?? musicQueueContext.profileCode }) : musicQueueContext;
      const quality = typeof qualityPolicyService?.evaluateQualityEvidence === 'function'
        ? qualityPolicyService.evaluateQualityEvidence({
          candidate,
          profileCode: candidateQualityContext.profileCode ?? undefined,
          qualityOverride: candidateQualityContext.qualityOverride,
          ...(candidateQualityContext.minimumBitrateKbps ? { minimumBitrateKbps: candidateQualityContext.minimumBitrateKbps } : {}),
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
      const rediscovery = allowRediscovery && typeof scheduleDownloadRecoveryRediscovery === 'function'
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
          terminalOutcome,
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
        terminalOutcome,
      });
    }

    const promotedCandidate = await promoteImportCandidateForRecoveryFn({
      importCandidateId: nextCandidate.id,
      maxDownloadAttemptCount: maxCandidateDownloadAttempts,
      reason: failureReason,
      triggeredByFailedCandidateId: failedCandidateId,
      ...(requiresRecoveryQualityContextGuard(musicQueueContext)
        ? { expectedMusicQueueContext: nextCandidate.normalizedPayload?.musicQueue ?? null } : {}),
    });

    if (!promotedCandidate) {
      return buildRecoveryResult({
        attemptedCandidate: nextCandidate,
        failedCandidate,
        reason: 'recovery_candidate_no_longer_selectable',
        recovered: false,
        skippedCandidates,
        terminalOutcome,
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
      terminalOutcome,
    });
  }

  async function handleImportCandidateDownloadFailure({
    failedCandidateId,
    observation = null,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityOverride = undefined,
    scheduleFollowUpRun = false,
    terminalOutcome = TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED,
  } = {}) {
    const scoped = await delegateScoped('download', { failedCandidateId, observation, operationRunId, failureReason });
    if (scoped) return scoped;
    const failedBeforeAttempt = await getImportCandidate({ importCandidateId: failedCandidateId });
    if (!failedBeforeAttempt) {
      return buildRecoveryResult({
        failedCandidate: null,
        reason: 'failed_candidate_not_found',
        recovered: false,
        terminalOutcome,
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
      terminalOutcome,
    });
  }

  async function handleImportCandidateQualityFailure({
    failedCandidateId,
    observation = null,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityLabel = 'quality_blocked',
    qualityOverride = undefined,
    qualityWeight = 0,
    scheduleFollowUpRun = true,
  } = {}) {
    const scoped = await delegateScoped('quality', { failedCandidateId, observation, operationRunId, failureReason });
    if (scoped) return scoped;
    const failedBeforeAttempt = await getImportCandidate({ importCandidateId: failedCandidateId });
    if (!failedBeforeAttempt) {
      return buildRecoveryResult({
        failedCandidate: null,
        reason: 'failed_candidate_not_found',
        recovered: false,
        terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.QUALITY_FAILED,
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
      allowRediscovery: false,
      failedCandidate,
      failedCandidateId,
      failureReason,
      operationRunId,
      profileCode,
      qualityOverride,
      recoverySummaryReason: 'quality_stop_recovery_cascade',
      scheduleFollowUpRun,
      terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.QUALITY_FAILED,
    });
  }

  async function handleImportCandidateImportBlocker({
    addBlockerCode = null,
    canRecover = false,
    failedCandidateId,
    observation = null,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityOverride = undefined,
    recoveryReasonCode = null,
    scheduleFollowUpRun = true,
  } = {}) {
    const scoped = await delegateScoped('import', { failedCandidateId, observation, operationRunId, failureReason, addBlockerCode, recoveryReasonCode, canRecover });
    if (scoped) return scoped;
    const failedBeforeAttempt = await getImportCandidate({ importCandidateId: failedCandidateId });
    if (!failedBeforeAttempt) {
      return buildRecoveryResult({
        failedCandidate: null,
        reason: 'failed_candidate_not_found',
        recovered: false,
        terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
      });
    }

    const transitionInput = {
      importCandidateId: failedCandidateId,
      recordSourceFailure: canRecover,
      reason: failureReason,
    };
    const normalizedAddBlockerCode = normalizeImportCandidateAddBlockerCode(addBlockerCode);
    if (normalizedAddBlockerCode) {
      transitionInput.addBlockerCode = normalizedAddBlockerCode;
    }
    const normalizedRecoveryReasonCode = deriveImportCandidateAddRecoveryReasonCode({
      addBlockerCode: normalizedAddBlockerCode,
      recoveryReasonCode,
    });
    if (normalizedRecoveryReasonCode) {
      transitionInput.recoveryReasonCode = normalizedRecoveryReasonCode;
    }

    const transitionResult = await markImportCandidateImportBlocked(transitionInput);
    const failedAfterTransition = transitionResult?.candidate ?? failedBeforeAttempt;

    if (!canRecover) {
      return buildRecoveryResult({
        addBlockerCode,
        failedCandidate: failedAfterTransition,
        reason: normalizedRecoveryReasonCode
          ? 'environmental_prerequisite_unavailable'
          : 'import_blocker_requires_operator',
        recovered: false,
        recoveryReasonCode: normalizedRecoveryReasonCode,
        requiresOperator: !normalizedRecoveryReasonCode,
        terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.IMPORT_BLOCKED,
      });
    }

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
      recoverySummaryReason: 'import_blocker_recovery_cascade',
      scheduleFollowUpRun,
      terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.SOURCE_DISAPPEARED,
    });
  }

  async function handleImportCandidateRejectedTransfer({
    failedCandidateId,
    observation = null,
    failureReason = null,
    operationRunId = null,
    profileCode = null,
    qualityOverride = undefined,
    scheduleFollowUpRun = true,
  } = {}) {
    const scoped = await delegateScoped('rejected', { failedCandidateId, observation, operationRunId, failureReason });
    if (scoped) return scoped;
    const failedBeforeAttempt = await getImportCandidate({ importCandidateId: failedCandidateId });
    if (!failedBeforeAttempt) {
      return buildRecoveryResult({
        failedCandidate: null,
        reason: 'failed_candidate_not_found',
        recovered: false,
        terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED,
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
          terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED,
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
      terminalOutcome: TERMINAL_MATCH_OUTCOME_CODES.DOWNLOAD_FAILED,
    });
  }

  return {
    ownsRecoveryCandidate,
    isCurrentExecutionObservation: (input) => musicQueueRecoveryService?.isCurrentExecutionObservation(input) ?? true,
    handleImportCandidateDownloadFailure,
    handleImportCandidateImportBlocker,
    handleImportCandidateQualityFailure,
    handleImportCandidateRejectedTransfer,
  };
}
