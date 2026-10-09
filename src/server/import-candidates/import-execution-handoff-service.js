/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { recordAuditEvent } from '../audit.js';
import { createApiError } from '../auth.js';
import { createDownloadAttempt, evaluateDownloadReceipt, evaluateStoredDownloadReceipt, validateDownloadAttempt }
  from '../slskd/slskd-download-attempt-policy.js';
import { buildDownloadAcceptanceDiagnostic, buildDownloadHandoffConfirmationDiagnostic } from './import-candidate-execution-diagnostics.js';
import { captureRecoveryObservation, matchesAcceptedRecoveryProvenance, matchesRecoveryObservation } from './music-queue-recovery-policy.js';
import { createImportExecutionHandoffStore } from './import-execution-handoff-store.js';
import { createImportExecutionTransferLinkStore } from './import-execution-transfer-link-store.js';

const stale = () => ({ confirmed: false, disposition: 'unknown', stale: true, dispatchAllowed: false });

/** One row-locked owner controls immutable dispatch checkpoints and their causal receipts. */
export function createImportExecutionHandoffService({ store = createImportExecutionHandoffStore(),
  transferLinkStore = createImportExecutionTransferLinkStore(), withTransaction = createDatabaseTransactionRunner(),
  recordAuditEventFn = recordAuditEvent, getNow = () => new Date() } = {}) {
  for (const [name, fn] of Object.entries({ lockEvidence: store.lockEvidence, getCandidate: store.getCandidate,
    isCurrentOrigin: store.isCurrentOrigin, updateCheckpoint: store.updateCheckpoint,
    findUnresolvedOtherHandoff: store.findUnresolvedOtherHandoff, transitionDownloading: store.transitionDownloading,
    isDispatchRunActive: store.isDispatchRunActive,
    recordPendingCheck: store.recordPendingCheck,
    recordConfirmedTransfers: transferLinkStore.recordConfirmedTransfers, withTransaction, recordAuditEventFn })) {
    if (typeof fn !== 'function') throw new TypeError(`createImportExecutionHandoffService requires ${name}`);
  }
  async function prepareDownloadHandoff({ importCandidateId, operationRunId, requestedFiles, username, sourceObservation }) {
    return withTransaction(async (queryable) => {
      const owner = { importCandidateId, operationRunId };
      const item = await store.lockEvidence(owner, queryable);
      if (!item) return stale();
      const execution = item.planningSnapshot?.execution ?? {};
      const existing = execution.handoff?.attempt;
      if (existing || ['dispatching','awaiting_confirmation','confirmed'].includes(execution.handoff?.state)
        || execution.enqueuedTransfers?.length) return { dispatchAllowed: false, attempt: existing ?? null, item };
      const candidate = await store.getCandidate(importCandidateId, queryable);
      if (candidate?.status !== 'selected' || !matchesRecoveryObservation(candidate, sourceObservation)
        || !await store.isCurrentOrigin(owner, queryable) || await store.findUnresolvedOtherHandoff(owner, queryable)) return stale();
      const proposal = createDownloadAttempt({ importCandidateId, operationRunId, requestedFiles, username, sourceObservation });
      const dispatchStartedAt = getNow().toISOString();
      const saved = await store.updateCheckpoint({ item, expectedAttemptId: null, itemStatus: 'awaiting_confirmation',
        statusMessage: 'Sending the download request and recording its receipt.', execution: {
          ...execution, sourceObservation: proposal.sourceObservation, requestedFiles: proposal.requestedFiles,
          diagnostics: { ...execution.diagnostics, downloadAcceptance: buildDownloadHandoffConfirmationDiagnostic({ requestedFileCount: requestedFiles.length }) },
          handoff: { ...execution.handoff, state: 'dispatching', dispatchStartedAt, retryPolicy: 'confirm_before_retry', attempt: proposal },
        } }, queryable);
      if (!saved) throw createApiError(409, 'import_execution_handoff_stale', 'The download attempt changed before dispatch');
      return { dispatchAllowed: true, attempt: proposal, dispatchStartedAt, item: saved };
    });
  }
  async function confirmDownloadHandoff({ importCandidateId, operationRunId, attemptId, enqueueResult, actorUserId = null,
    warningMessage = null, requestMetadata = null }) {
    return withTransaction(async (queryable) => {
      const owner = { importCandidateId, operationRunId };
      const item = await store.lockEvidence(owner, queryable);
      const execution = item?.planningSnapshot?.execution ?? {};
      const stored = execution.handoff?.attempt;
      if (!item || execution.handoff?.state === 'not_dispatched' || (stored?.attemptId ?? null) !== (attemptId ?? null)) return stale();
      const pending = async () => {
        await store.recordPendingCheck({ item, attemptId, checkedAt: getNow().toISOString() }, queryable);
        return stale();
      };
      if (!attemptId) return pending();
      const context = { attempt: stored, ...owner, requestedFiles: execution.requestedFiles, username: stored.username };
      const saved = validateDownloadAttempt(context);
      if (!saved) return pending();
      const candidate = await store.getCandidate(importCandidateId, queryable);
      const physicalMatch = candidate != null && matchesAcceptedRecoveryProvenance(candidate, saved.sourceObservation);
      const mayAdvance = physicalMatch && ['selected','downloading'].includes(candidate.status)
        && await store.isCurrentOrigin(owner, queryable);
      const previous = evaluateStoredDownloadReceipt(context);
      if (mayAdvance && execution.handoff?.state === 'confirmed' && previous.disposition === 'confirmed') {
        return { ...previous, confirmed: true, alreadyConfirmed: true, candidate, item };
      }
      const proof = enqueueResult === undefined ? previous : evaluateDownloadReceipt({ attempt: saved, enqueueResult });
      if (!isDeepStrictEqual(saved.sourceObservation, proof.attempt?.sourceObservation)) return pending();
      if (physicalMatch) await transferLinkStore.recordConfirmedTransfers({ ...owner, transfers: proof.attempt?.receipts ?? [], queryable });
      const confirmed = mayAdvance && proof.disposition === 'confirmed' && proof.allRequestedFilesMatched === true;
      const rejected = mayAdvance && proof.disposition === 'rejected';
      const statusMessage = confirmed ? `${proof.requestedFileCount} file${proof.requestedFileCount === 1 ? '' : 's'} accepted for download.`
        : rejected ? 'The provider rejected every file in this download request.' : 'The download request still needs confirmation; Harmoniarr will not send it again.';
      let updated = candidate;
      const phaseAdvanced = confirmed && candidate.status === 'selected';
      if (phaseAdvanced) {
        updated = await store.transitionDownloading({ candidate, actorUserId, reason: statusMessage }, queryable);
        if (!updated) throw createApiError(409, 'import_execution_handoff_stale', 'The candidate changed during receipt confirmation');
        await recordAuditEventFn({ actorType: actorUserId ? 'user' : 'system', actorUserId, eventType: 'import_candidate_downloading',
          entityType: 'import_candidate', entityId: importCandidateId, summary: 'Import candidate download started',
          details: { operationRunId }, ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null }, queryable);
      }
      const nextExecution = { ...execution, sourceObservation: saved.sourceObservation, requestedFiles: saved.requestedFiles,
        diagnostics: { ...execution.diagnostics, downloadAcceptance: confirmed || rejected
          ? buildDownloadAcceptanceDiagnostic({ enqueueResult: { enqueued: proof.attempt.receipts, failed: proof.attempt.failedFiles ?? [] },
            requestedFiles: saved.requestedFiles, warningMessage })
          : buildDownloadHandoffConfirmationDiagnostic({ matchedTransferCount: proof.attempt?.receipts?.length ?? 0, requestedFileCount: proof.requestedFileCount }) },
        enqueuedTransfers: confirmed ? proof.matchedTransfers : [],
        ...(confirmed ? { acceptedCandidateObservation: captureRecoveryObservation(updated) } : {}),
        handoff: { ...execution.handoff, attempt: proof.attempt ?? saved, state: confirmed || rejected ? 'confirmed' : execution.handoff?.state === 'dispatching' ? 'dispatching' : 'awaiting_confirmation',
          ...(enqueueResult !== undefined ? { providerRespondedAt: getNow().toISOString() } : {}),
          ...(confirmed ? { confirmedAt: getNow().toISOString() } : {}) },
        outcome: confirmed ? warningMessage ? 'queued_with_warnings' : 'queued' : rejected ? 'queue_failed' : 'awaiting_confirmation' };
      const storedItem = await store.updateCheckpoint({ item, expectedAttemptId: attemptId, execution: nextExecution,
        itemStatus: nextExecution.outcome, statusMessage }, queryable);
      if (!storedItem) throw createApiError(409, 'import_execution_handoff_stale', 'The download attempt changed during confirmation');
      if (confirmed) await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'import_execution_handoff_confirmed',
        entityType: 'operation_run', entityId: operationRunId, summary: 'A download request receipt was confirmed',
        details: { importCandidateId, requestedFileCount: proof.requestedFileCount } }, queryable);
      return { ...proof, confirmed, definitiveFailure: rejected, candidate: updated, item: storedItem, statusMessage,
        phaseAdvanced, dispatchAllowed: false };
    });
  }
  async function assertDownloadHandoffCurrent({ importCandidateId, operationRunId, attemptId }) {
    return withTransaction(async (queryable) => {
      const owner = { importCandidateId, operationRunId };
      const item = await store.lockEvidence(owner, queryable);
      const execution = item?.planningSnapshot?.execution;
      const attempt = execution?.handoff?.attempt;
      const valid = validateDownloadAttempt({ attempt, ...owner, requestedFiles: execution?.requestedFiles, username: attempt?.username });
      const candidate = await store.getCandidate(importCandidateId, queryable);
      if (!valid || attempt.attemptId !== attemptId || execution.handoff.state !== 'dispatching' || attempt.receipts.length
        || !matchesRecoveryObservation(candidate, attempt.sourceObservation) || !await store.isCurrentOrigin(owner, queryable)
        || !await store.isDispatchRunActive(owner, queryable)) {
        throw createApiError(409, 'import_execution_handoff_stale', 'The download attempt changed before provider dispatch');
      }
    });
  }
  async function recordDownloadHandoffNotDispatched({ importCandidateId, operationRunId, attemptId }) {
    return withTransaction(async (queryable) => {
      const item = await store.lockEvidence({ importCandidateId, operationRunId }, queryable);
      const execution = item?.planningSnapshot?.execution;
      if (execution?.handoff?.attempt?.attemptId !== attemptId || execution.handoff.attempt.receipts?.length
        || !['dispatching','awaiting_confirmation','not_dispatched'].includes(execution.handoff.state)) return false;
      return Boolean(await store.updateCheckpoint({ item, expectedAttemptId: attemptId, itemStatus: 'blocked',
        statusMessage: 'The download request was stopped before it was sent.', execution: { ...execution,
          handoff: { ...execution.handoff, state: 'not_dispatched' }, outcome: 'not_dispatched' } }, queryable));
    });
  }
  return { prepareDownloadHandoff, confirmDownloadHandoff, assertDownloadHandoffCurrent, recordDownloadHandoffNotDispatched };
}
