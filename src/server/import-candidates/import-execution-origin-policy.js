/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { normalizeDownloadTransferId, validateDownloadAttempt } from '../slskd/slskd-download-attempt-policy.js';

const plain = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const refusal = (reasonCode) => ({ eligible: false, reasonCode });
const providerFields = ['acceptedCandidateObservation', 'latestTransferSnapshot', 'missingTransfer', 'adoption'];
const handoffFields = ['providerRespondedAt', 'confirmedAt', 'lastConfirmedAt', 'adoption', 'originResolution'];

/** Missing or malformed lease facts never establish that an execution owner is idle. */
export function hasLiveOrUnverifiableExecutionLease(leases, { now = Date.now() } = {}) {
  const currentTime = now instanceof Date ? now.getTime() : typeof now === 'number' ? now : Date.parse(now);
  if (!Array.isArray(leases) || !Number.isFinite(currentTime)) return true;
  return leases.some((lease) => {
    if (!plain(lease) || typeof lease.ownerInstanceId !== 'string' || !lease.ownerInstanceId
      || typeof lease.acquiredAt !== 'string' || typeof lease.expiresAt !== 'string'
      || !Number.isFinite(Date.parse(lease.acquiredAt)) || !Number.isFinite(Date.parse(lease.expiresAt))) return true;
    if (lease.releasedAt != null) return typeof lease.releasedAt !== 'string' || !Number.isFinite(Date.parse(lease.releasedAt));
    return Date.parse(lease.expiresAt) > currentTime;
  });
}

function hasProviderEvidence(execution) {
  if (!plain(execution)) return true;
  if (providerFields.some((field) => execution[field] != null)) return true;
  if (Object.hasOwn(execution, 'enqueuedTransfers') && (!Array.isArray(execution.enqueuedTransfers) || execution.enqueuedTransfers.length)) return true;
  return false;
}

/** One single-candidate allocation may be retired only with a local non-dispatch proof. */
export function evaluateUnusedExecutionAllocation({ run, items, leases, transferLinkCount, importCandidateId, now = Date.now() } = {}) {
  if (!plain(run) || run.operationType !== 'import_candidate_execution_planning' || !plain(run.summary)
    || run.summary.executionMode !== 'download_enqueue' || run.summary.selectedCandidateId !== importCandidateId
    || run.summary.requestedCandidateCount !== 1 || !['manual', 'missing_music_manual'].includes(run.summary.triggerSource)
    || ['musicQueueRecovery', 'recoveryCascade', 'downloadOriginSupersession', 'externalRequestReleaseIntentId',
      'sourceExternalRequestReleaseIntentId'].some((field) => Object.hasOwn(run.summary, field))) return refusal('newer_allocation_not_supported');
  if (!Array.isArray(items) || items.length > 1 || items.some((item) => item.importCandidateId !== importCandidateId
    || item.operationRunId !== run.id) || !Number.isInteger(transferLinkCount) || transferLinkCount !== 0) return refusal('newer_allocation_has_work');
  if (!Object.hasOwn(run, 'claimedAt') || !Object.hasOwn(run, 'claimedByInstanceId')
    || run.claimedAt != null || run.claimedByInstanceId != null || run.status === 'running'
    || hasLiveOrUnverifiableExecutionLease(leases, { now })) return refusal('newer_allocation_active');
  const snapshot = items[0]?.planningSnapshot;
  if (items.length && (!plain(snapshot) || (Object.hasOwn(snapshot, 'execution') && !plain(snapshot.execution)))) return refusal('newer_allocation_has_work');
  const execution = snapshot?.execution ?? {};
  if (hasProviderEvidence(execution)) return refusal('newer_allocation_has_work');
  const handoff = execution.handoff;
  if (run.status === 'pending' && run.attemptCount === 0 && leases.length === 0
    && (!items.length || ['ready', 'ready_with_warnings', 'blocked'].includes(items[0].itemStatus))
    && (!Object.hasOwn(execution, 'outcome') || ['ready', 'ready_with_warnings', 'blocked'].includes(execution.outcome))
    && (!Object.hasOwn(execution, 'handoff') || (plain(handoff) && Object.keys(handoff).length === 0))) return { eligible: true, reasonCode: null };
  if (!['pending', 'failed', 'completed', 'cancelled'].includes(run.status) || !plain(handoff) || handoff.state !== 'not_dispatched'
    || handoffFields.some((field) => Object.hasOwn(handoff, field))) return refusal('newer_allocation_dispatch_not_proven');
  const attempt = validateDownloadAttempt({ attempt: handoff.attempt, importCandidateId, operationRunId: run.id,
    requestedFiles: execution.requestedFiles, username: handoff.attempt?.username });
  if (!attempt || attempt.receipts.length || attempt.failedFiles.length
    || (attempt.receiptDisposition != null && attempt.receiptDisposition !== 'unknown')) return refusal('newer_allocation_dispatch_not_proven');
  return { eligible: true, reasonCode: null };
}

export function isValidExecutionOriginResolution(record) {
  return plain(record) && record.version === 1
    && ['resolutionId', 'importCandidateId', 'sourceRunId', 'newerRunId', 'sourceAttemptId', 'actorUserId']
      .every((field) => normalizeDownloadTransferId(record[field]) === record[field])
    && record.sourceRunId !== record.newerRunId && /^[a-f0-9]{64}$/u.test(record.requestHash ?? '')
    && typeof record.resolvedAt === 'string' && Number.isFinite(Date.parse(record.resolvedAt))
    && new Date(record.resolvedAt).toISOString() === record.resolvedAt && plain(record.publicOutcome);
}

export function hasReciprocalExecutionOriginResolution({ record, sourceItem, newerRun, importCandidateId }) {
  return isValidExecutionOriginResolution(record) && record.importCandidateId === importCandidateId
    && newerRun?.id === record.newerRunId && newerRun.status === 'cancelled'
    && sourceItem?.operationRunId === record.sourceRunId && sourceItem.importCandidateId === importCandidateId
    && sourceItem.planningSnapshot?.execution?.handoff?.attempt?.attemptId === record.sourceAttemptId
    && isDeepStrictEqual(record, sourceItem.planningSnapshot.execution.handoff.originResolution)
    && isDeepStrictEqual(record, newerRun.summary?.downloadOriginSupersession);
}
