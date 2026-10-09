/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { validateDownloadAttempt, evaluateStoredDownloadReceipt } from '../slskd/slskd-download-attempt-policy.js';
import { normalizeDownloadAdoptionManifest } from './import-candidate-download-adoption-policy.js';
import { isUnconfirmedExecutionItem } from './import-candidate-execution-handoff-state.js';
import { matchesAcceptedRecoveryProvenance } from './music-queue-recovery-policy.js';
import { evaluateUnusedExecutionAllocation, hasLiveOrUnverifiableExecutionLease } from './import-execution-origin-policy.js';

const refusal = (reasonCode) => ({ eligible: false, reasonCode });
export function normalizeDownloadOriginCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== 1 || !Object.hasOwn(value, 'reviewDigest') || typeof value.reviewDigest !== 'string'
    || !/^[a-f0-9]{64}$/iu.test(value.reviewDigest)) {
    throw createApiError(400, 'validation_error', 'Use the reviewed digest to resolve this download request');
  }
  return { reviewDigest: value.reviewDigest.toLowerCase() };
}

/** No caller supplies the newer run, source, manifest or non-dispatch proof. */
export function resolveDownloadOriginEpisode(context = {}, { now = Date.now() } = {}) {
  const { candidate, sourceRun: run, sourceItem: item, newerRun } = context;
  if (!candidate || !run || !item || run.operationType !== 'import_candidate_execution_planning'
    || item.operationRunId !== run.id || item.importCandidateId !== candidate.id) return refusal('download_episode_not_available');
  if (!['completed', 'failed', 'cancelled'].includes(run.status)
    || hasLiveOrUnverifiableExecutionLease(context.sourceLeases, { now })) return refusal('source_download_work_active');
  const execution = item.planningSnapshot?.execution;
  if (candidate.status !== 'selected' || !isUnconfirmedExecutionItem(item)
    || Object.hasOwn(execution?.handoff ?? {}, 'adoption')
    || Object.hasOwn(execution?.handoff ?? {}, 'originResolution')) return refusal('download_episode_not_available');
  const requestedFiles = normalizeDownloadAdoptionManifest(execution?.requestedFiles);
  const attempt = validateDownloadAttempt({ attempt: execution?.handoff?.attempt, importCandidateId: candidate.id,
    operationRunId: run.id, requestedFiles, username: candidate.username });
  if (!requestedFiles || !attempt || attempt.version !== 2 || attempt.providerBinding.protocol !== 'batch'
    || attempt.receiptOrigin === 'operator_adoption'
    || evaluateStoredDownloadReceipt({ attempt, importCandidateId: candidate.id, operationRunId: run.id,
      requestedFiles, username: candidate.username })?.disposition === 'rejected') return refusal('source_batch_evidence_unavailable');
  const currentFiles = Array.isArray(candidate.files) ? normalizeDownloadAdoptionManifest(candidate.files
    .filter((file) => !file.isLocked).map((file) => ({ filename: file.rawPayload?.filename
      ?? (file.folderPath ? `${file.folderPath}\\${file.filename}` : file.filename), size: file.sizeBytes }))) : null;
  if (!currentFiles || !isDeepStrictEqual(currentFiles, requestedFiles)
    || !matchesAcceptedRecoveryProvenance(candidate, attempt.sourceObservation)) return refusal('immutable_download_evidence_missing');
  if (!newerRun || context.newerCount !== 1 || context.currentOriginId !== newerRun.id || newerRun.id === run.id) {
    return refusal('download_origin_pair_not_current');
  }
  const unused = evaluateUnusedExecutionAllocation({ run: newerRun, items: context.newerItems,
    leases: context.newerLeases, transferLinkCount: context.newerTransferLinkCount, importCandidateId: candidate.id, now });
  if (!unused.eligible) return unused;
  return { eligible: true, reasonCode: null, candidate, run, item, attempt, newerRun,
    requestedFiles, sourceObservation: attempt.sourceObservation, username: attempt.username };
}

export function buildDownloadOriginReviewDigest({ actorUserId, episode, policySnapshot, proof, context }) {
  const { attempt } = episode;
  return createHash('sha256').update(JSON.stringify({ version: 1, actorUserId,
    source: { version: attempt.version, attemptId: attempt.attemptId, importCandidateId: attempt.importCandidateId,
      operationRunId: attempt.operationRunId, username: attempt.username, requestedFiles: attempt.requestedFiles,
      sourceObservation: attempt.sourceObservation, providerBinding: attempt.providerBinding },
    sourceAuthority: episode.run.summary, newer: episode.newerRun,
    newerItems: context.newerItems, newerLeases: context.newerLeases, policySnapshot,
    receipts: proof.matchedTransfers.map((row) => ({ id: row.id, username: row.username, filename: row.filename,
      size: row.size, batchId: row.batchId })).sort((a, b) => a.id.localeCompare(b.id)),
  })).digest('hex');
}

export function buildDownloadOriginRequestHash({ actorUserId, operationRunId, importCandidateId, command }) {
  return createHash('sha256').update(JSON.stringify({ actorUserId, operationRunId, importCandidateId, ...command })).digest('hex');
}

export function buildDownloadOriginOutcome({ operationRunId, importCandidateId, verifiedFileCount, replayed = false }) {
  return { downloadOriginResolution: { outcome: 'restored', operationRunId, importCandidateId,
    verifiedFileCount, retiredRequestCount: 1, replayed } };
}
