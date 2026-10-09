/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { hasPreProviderProtocol, validatePreProviderEpoch, preparationLeaseIdentity,
  hasPreparationProviderEvidence } from './import-execution-pre-provider-policy.js';
import { validateDownloadAttempt } from '../slskd/slskd-download-attempt-policy.js';
import { matchesRecoveryObservation } from './music-queue-recovery-policy.js';

const refusal = (reasonCode) => ({ eligible: false, reasonCode });
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** A timeout only permits inspection; the exact future protocol establishes non-dispatch. */
export function evaluateAbandonedPreparation({ context, operationRunId, importCandidateId, expectedEpoch }) {
  const { run, item, lease, candidate, observedAt, runItemCount, runTransferLinkCount } = context;
  const execution = item?.planningSnapshot?.execution;
  const epoch = validatePreProviderEpoch(execution?.handoff?.preProviderEpoch, { runId: operationRunId, importCandidateId });
  if (!run || run.id !== operationRunId || run.operationType !== 'import_candidate_execution_planning'
    || !hasPreProviderProtocol(run) || run.summary.executionMode !== 'download_enqueue'
    || run.summary.selectedCandidateId !== importCandidateId || run.summary.requestedCandidateCount !== 1
    || !['manual', 'missing_music_manual'].includes(run.summary.triggerSource)
    || ['downloadOriginSupersession', 'downloadPreparationClosure', 'musicQueueRecovery', 'recoveryCascade',
      'externalRequestReleaseIntentId', 'sourceExternalRequestReleaseIntentId'].some((key) => Object.hasOwn(run.summary, key))
    || !epoch || epoch.phase !== 'preparing' || !isDeepStrictEqual(epoch, expectedEpoch)
    || item.operationRunId !== operationRunId || item.importCandidateId !== importCandidateId
    || runItemCount !== 1 || runTransferLinkCount !== 0 || context.transferLinkCount !== 0) return refusal('preparation_not_eligible');
  if (!['pending', 'failed', 'completed', 'cancelled'].includes(run.status)
    || !Object.hasOwn(run, 'claimedAt') || !Object.hasOwn(run, 'claimedByInstanceId')
    || run.claimedAt != null || run.claimedByInstanceId != null || !iso(observedAt)) return refusal('preparation_active');
  if (lease != null && (!preparationLeaseIdentity(lease, operationRunId) || lease.jobType !== run.operationType
    || !iso(lease.expiresAt) || (lease.releasedAt != null && !iso(lease.releasedAt))
    || (lease.releasedAt == null && Date.parse(lease.expiresAt) > Date.parse(observedAt)))) return refusal('preparation_active');
  if (candidate?.status !== 'selected' || !matchesRecoveryObservation(candidate, epoch.sourceObservation)
    || !isDeepStrictEqual(execution.requestedFiles, epoch.requestedFiles)
    || hasPreparationProviderEvidence(execution, { stagedAttemptId: epoch.attemptId ?? null })
    || execution.handoff.state !== (epoch.attemptId ? 'dispatching' : 'preparing')) return refusal('preparation_evidence_changed');
  if (epoch.attemptId) {
    const attempt = validateDownloadAttempt({ attempt: execution.handoff.attempt, operationRunId, importCandidateId,
      requestedFiles: epoch.requestedFiles, username: epoch.sourceObservation.username });
    if (!attempt || attempt.attemptId !== epoch.attemptId || !isDeepStrictEqual(attempt.sourceObservation, epoch.sourceObservation)) {
      return refusal('preparation_evidence_changed');
    }
  }
  return { eligible: true, epoch, reasonCode: run.status === 'cancelled' || run.cancelRequestedAt != null || run.cancelledAt != null
    ? 'operation_cancelled' : 'preparation_abandoned' };
}
