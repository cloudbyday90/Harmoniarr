/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { normalizeDownloadFileManifest, normalizeDownloadTransferId, validateDownloadAttempt, evaluateStoredDownloadReceipt } from '../slskd/slskd-download-attempt-policy.js';
import { normalizeExpectedJobLease } from '../job-lease-policy.js';

export const PRE_PROVIDER_REFUSAL_REASONS = new Set(['planning_blocked', 'no_unlocked_files', 'preparation_refused',
  'provider_version_unsupported', 'provider_unavailable', 'provider_changed', 'prior_handoff_unresolved',
  'source_changed', 'operation_paused', 'operation_cancelled', 'authority_refused', 'lease_changed', 'preparation_abandoned']);
const plain = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const guid = (value) => typeof value === 'string' && normalizeDownloadTransferId(value) === value;
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function hasPreProviderProtocol(run) {
  const marker = run?.summary?.downloadPreparationProtocol;
  return plain(marker) && marker.version === 1 && Object.keys(marker).length === 1;
}
export function normalizePreparationFiles(files) {
  return Array.isArray(files) && files.length === 0 ? [] : normalizeDownloadFileManifest(files);
}
export function preparationLeaseIdentity(lease, runId) {
  if (!plain(lease) || lease.leaseKey !== `import_candidate_execution_planning:${runId}`
    || typeof lease.ownerInstanceId !== 'string' || !lease.ownerInstanceId || lease.ownerInstanceId.length > 512
    || lease.ownerInstanceId.includes('\u0000') || !iso(lease.acquiredAt)
    || (Object.hasOwn(lease, 'acquisitionId') && !guid(lease.acquisitionId))) return null;
  return { leaseKey: lease.leaseKey, ownerInstanceId: lease.ownerInstanceId, acquiredAt: lease.acquiredAt,
    ...(Object.hasOwn(lease, 'acquisitionId') ? { acquisitionId: lease.acquisitionId } : {}) };
}
export function hasCurrentPreparationLease(current, expected, runId, now = Date.now()) {
  const identity = preparationLeaseIdentity(expected, runId);
  return identity != null && normalizeExpectedJobLease(expected) != null && normalizeExpectedJobLease(current) != null
    && isDeepStrictEqual(identity, preparationLeaseIdentity(current, runId))
    && current.releasedAt == null && iso(current.expiresAt) && Number.isFinite(now) && Date.parse(current.expiresAt) > now;
}
export function validatePreProviderEpoch(epoch, { runId, importCandidateId } = {}) {
  if (!plain(epoch) || epoch.version !== 1 || !guid(epoch.epochId) || epoch.operationRunId !== runId
    || epoch.importCandidateId !== importCandidateId || !guid(runId) || !guid(importCandidateId)
    || !Number.isInteger(epoch.generation) || epoch.generation < 1 || epoch.generation > 10000
    || !iso(epoch.preparedAt) || !plain(epoch.sourceObservation) || epoch.sourceObservation.candidateId !== importCandidateId
    || !plain(epoch.lease) || !isDeepStrictEqual(epoch.lease, preparationLeaseIdentity(epoch.lease, runId))
    || !Array.isArray(epoch.requestedFiles) || !isDeepStrictEqual(epoch.requestedFiles, normalizePreparationFiles(epoch.requestedFiles))
    || !['preparing', 'refused', 'may_have_dispatched'].includes(epoch.phase)
    || (Object.hasOwn(epoch, 'attemptId') && !guid(epoch.attemptId))) return null;
  if (epoch.phase === 'refused') {
    if (!plain(epoch.refusal) || !PRE_PROVIDER_REFUSAL_REASONS.has(epoch.refusal.reasonCode)
      || !iso(epoch.refusal.refusedAt) || Date.parse(epoch.refusal.refusedAt) < Date.parse(epoch.preparedAt)
      || Object.hasOwn(epoch, 'dispatchPossibleAt')) return null;
  } else if (Object.hasOwn(epoch, 'refusal')) return null;
  if (epoch.phase === 'may_have_dispatched') {
    if (!guid(epoch.attemptId) || !iso(epoch.dispatchPossibleAt)
      || Date.parse(epoch.dispatchPossibleAt) < Date.parse(epoch.preparedAt)) return null;
  } else if (Object.hasOwn(epoch, 'dispatchPossibleAt')) return null;
  if (Object.hasOwn(epoch, 'closure')) {
    const closure = epoch.closure;
    if (epoch.phase !== 'refused' || !plain(closure) || closure.version !== 1
      || closure.operationRunId !== runId || closure.importCandidateId !== importCandidateId
      || closure.epochId !== epoch.epochId || closure.generation !== epoch.generation
      || closure.closedAt !== epoch.refusal.refusedAt || closure.reasonCode !== epoch.refusal.reasonCode
      || !['preparation_abandoned', 'operation_cancelled'].includes(closure.reasonCode)
      || !isDeepStrictEqual(closure.lease, preparationLeaseIdentity(closure.lease, runId)) || closure.lease == null
      || isDeepStrictEqual(closure.lease, epoch.lease)
      || Date.parse(closure.lease.acquiredAt) < Date.parse(epoch.preparedAt)
      || Date.parse(closure.lease.acquiredAt) > Date.parse(closure.closedAt)
      || !Object.hasOwn(closure, 'cancelRequestedAt') || !Object.hasOwn(closure, 'cancelledAt')
      || [closure.cancelRequestedAt, closure.cancelledAt].some((time) => time != null && !iso(time))) return null;
  } else if (epoch.refusal?.reasonCode === 'preparation_abandoned') return null;
  return epoch;
}

/** Existing provider evidence is never converted into local negative proof. */
export function hasPreparationProviderEvidence(execution, { stagedAttemptId = null } = {}) {
  if (!plain(execution)) return true;
  const handoff = execution.handoff ?? {};
  if (!plain(handoff) || ['adoption', 'originResolution', 'providerRespondedAt', 'confirmedAt', 'lastConfirmedAt']
    .some((key) => Object.hasOwn(handoff, key))) return true;
  if (['acceptedCandidateObservation', 'latestTransferSnapshot', 'missingTransfer'].some((key) => Object.hasOwn(execution, key))) return true;
  if (Object.hasOwn(execution, 'enqueuedTransfers') && (!Array.isArray(execution.enqueuedTransfers) || execution.enqueuedTransfers.length)) return true;
  if (stagedAttemptId && !Object.hasOwn(handoff, 'attempt')) return true;
  if (Object.hasOwn(handoff, 'attempt')) {
    const attempt = validateDownloadAttempt({ attempt: handoff.attempt, importCandidateId: handoff.attempt?.importCandidateId,
      operationRunId: handoff.attempt?.operationRunId, requestedFiles: execution.requestedFiles, username: handoff.attempt?.username });
    if (!stagedAttemptId || !attempt || attempt.attemptId !== stagedAttemptId || attempt.receipts.length || attempt.failedFiles.length
      || (attempt.receiptDisposition != null && attempt.receiptDisposition !== 'unknown')) return true;
  }
  return false;
}

export function hasCertifiedPreProviderRefusal({ run, item }) {
  const execution = item?.planningSnapshot?.execution;
  const epoch = validatePreProviderEpoch(execution?.handoff?.preProviderEpoch, { runId: run?.id, importCandidateId: item?.importCandidateId });
  if (!hasPreProviderProtocol(run) || !epoch || epoch.phase !== 'refused' || item.operationRunId !== run.id
    || item.itemStatus !== 'blocked' || execution.outcome !== 'pre_provider_refused'
    || !isDeepStrictEqual(execution.requestedFiles, epoch.requestedFiles)
    || hasPreparationProviderEvidence(execution, { stagedAttemptId: epoch.attemptId ?? null })) return false;
  if (epoch.closure || Object.hasOwn(run.summary, 'downloadPreparationClosure')) {
    if (!epoch.closure || run.status !== 'cancelled'
      || !isDeepStrictEqual(epoch.closure, run.summary.downloadPreparationClosure)) return false;
  }
  const expectedState = epoch.attemptId ? 'not_dispatched' : 'pre_provider_refused';
  if (epoch.attemptId) {
    const attempt = validateDownloadAttempt({ attempt: execution.handoff.attempt, operationRunId: run.id,
      importCandidateId: item.importCandidateId, requestedFiles: epoch.requestedFiles, username: epoch.sourceObservation.username });
    if (!attempt || !isDeepStrictEqual(attempt.sourceObservation, epoch.sourceObservation)) return false;
  }
  return execution.handoff.state === expectedState;
}

export function isUnresolvedPreProviderPreparation({ run, item }) {
  const execution = item?.planningSnapshot?.execution;
  if (Object.hasOwn(run?.summary ?? {}, 'downloadPreparationClosure')) return !hasCertifiedPreProviderRefusal({ run, item });
  if (!Object.hasOwn(execution?.handoff ?? {}, 'preProviderEpoch')) return false;
  if (hasCertifiedPreProviderRefusal({ run, item })) return false;
  const epoch = validatePreProviderEpoch(execution.handoff.preProviderEpoch, { runId: run?.id, importCandidateId: item.importCandidateId });
  if (epoch?.phase === 'may_have_dispatched' && hasPreProviderProtocol(run) && execution.handoff.state === 'confirmed') {
    const receipt = evaluateStoredDownloadReceipt({ attempt: execution.handoff.attempt, operationRunId: run.id,
      importCandidateId: item.importCandidateId, requestedFiles: execution.requestedFiles, username: epoch.sourceObservation.username });
    if (receipt?.attempt?.attemptId === epoch.attemptId && ['confirmed', 'rejected'].includes(receipt.disposition)) return false;
  }
  return true;
}

export function preProviderRefusalReason(error) {
  if (error?.code === 'slskd_download_version_unsupported') return 'provider_version_unsupported';
  if (error?.code === 'slskd_download_provider_changed') return 'provider_changed';
  if (error?.code?.startsWith('slskd_')) return 'provider_unavailable';
  if (error?.code === 'operation_run_cancelled') return 'operation_cancelled';
  if (error?.code?.includes('paused') || error?.pauseCode) return 'operation_paused';
  if (error?.code?.includes('lease')) return 'lease_changed';
  if (error?.code?.includes('authority') || error?.code === 'music_queue_recovery_not_current') return 'authority_refused';
  return 'preparation_refused';
}
