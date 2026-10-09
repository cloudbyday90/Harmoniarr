/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { createDownloadAttempt } from '../slskd/slskd-download-attempt-policy.js';
import { createOperatorDownloadAdoptionAttempt } from '../slskd/slskd-download-adoption-policy.js';
import { resolveDownloadAdoptionEpisode } from './import-candidate-download-adoption-policy.js';
import { captureRecoveryObservation } from './music-queue-recovery-policy.js';

/** The caller owns authorization/policy locks; this owner atomically links and advances the exact episode. */
export function createImportExecutionDownloadAdoptionService({ store, transferLinkStore, withTransaction, recordAuditEventFn,
  getNow = () => new Date() }) {
  async function adoptDownloadHandoff({ importCandidateId, operationRunId, actorUserId, selectedTransfers, providerBinding,
    adoptionRequestHash, sourceObservation, requestedFiles, qualityContext, publicOutcome, requestMetadata, queryable = null }) {
    const write = async (transaction) => {
      const owner = { importCandidateId, operationRunId };
      const item = await store.lockEvidence(owner, transaction);
      const execution = item?.planningSnapshot?.execution ?? {};
      const previous = execution.handoff?.adoption;
      if (Object.hasOwn(execution.handoff ?? {}, 'adoption') && previous == null) {
        throw createApiError(409, 'import_execution_download_adoption_stale', 'The download review changed');
      }
      if (previous != null) {
        if (previous.requestHash === adoptionRequestHash) return { adopted: true, replayed: true, publicOutcome: previous.publicOutcome };
        throw createApiError(409, 'import_execution_download_adoption_stale', 'The download review changed');
      }
      const candidate = await store.getCandidate(importCandidateId, transaction);
      const run = await store.getRun(operationRunId, transaction);
      const current = await store.isCurrentOrigin(owner, transaction);
      const episode = resolveDownloadAdoptionEpisode({ candidate, item, run, currentOriginId: current ? operationRunId : null });
      if (!episode.eligible || !isDeepStrictEqual(episode.sourceObservation, sourceObservation)
        || !isDeepStrictEqual(episode.requestedFiles, requestedFiles)) {
        throw createApiError(409, 'import_execution_download_adoption_stale', 'The download review changed');
      }
      const adoptedAt = getNow().toISOString();
      const attempt = execution.handoff?.attempt ?? createDownloadAttempt({ ...owner, requestedFiles,
        username: episode.username, sourceObservation });
      const proof = createOperatorDownloadAdoptionAttempt({ attempt, providerBinding, transfers: selectedTransfers,
        actorUserId, acceptedRequestHash: adoptionRequestHash, adoptedAt });
      if (await store.hasForeignBatchAttempt({ ...owner, providerBinding, receipts: proof.attempt.receipts }, transaction)) {
        throw createApiError(409, 'import_execution_download_adoption_foreign_batch', 'These downloads belong to another download attempt');
      }
      await transferLinkStore.recordConfirmedTransfers({ ...owner, transfers: proof.attempt.receipts, queryable: transaction });
      if (Object.hasOwn(candidate.normalizedPayload ?? {}, 'musicQueue')
        || Object.hasOwn(candidate.normalizedPayload ?? {}, 'musicQueueContext')) {
        await store.setAdoptedQualityContext(importCandidateId, qualityContext, transaction);
      }
      const updated = await store.transitionDownloading({ candidate, actorUserId,
        reason: 'An administrator linked a verified set of existing downloads.' }, transaction);
      if (!updated) throw createApiError(409, 'import_execution_download_adoption_stale', 'The download changed during adoption');
      const adoption = { version: 1, adoptionId: proof.attempt.attemptId, source: 'operator_adoption', actorUserId,
        requestHash: adoptionRequestHash, providerBinding, receipts: proof.attempt.receipts, proof: proof.attempt,
        originalUncertainty: true, automaticRecoveryAllowed: false, originalUncertainDispatch: execution.handoff ?? null,
        publicOutcome, adoptedAt };
      const saved = await store.updateCheckpoint({ item, expectedAttemptId: execution.handoff?.attempt?.attemptId ?? null,
        itemStatus: 'queued', statusMessage: 'Verified existing downloads were linked by an administrator.', execution: {
          ...execution, acceptedCandidateObservation: captureRecoveryObservation(updated), enqueuedTransfers: proof.matchedTransfers,
          handoff: { ...execution.handoff, state: 'operator_adopted', adoption }, outcome: 'operator_adopted',
        } }, transaction);
      if (!saved) throw createApiError(409, 'import_execution_download_adoption_stale', 'The download changed during adoption');
      await recordAuditEventFn({ actorType: 'user', actorUserId, eventType: 'import_candidate_downloading',
        entityType: 'import_candidate', entityId: importCandidateId, summary: 'Import candidate existing downloads linked',
        details: { operationRunId, source: 'operator_adoption' }, ipAddress: requestMetadata?.ipAddress ?? null,
        userAgent: requestMetadata?.userAgent ?? null }, transaction);
      await recordAuditEventFn({ actorType: 'user', actorUserId, eventType: 'import_execution_downloads_adopted',
        entityType: 'operation_run', entityId: operationRunId, summary: 'An administrator linked verified existing downloads',
        details: { importCandidateId, adoptedFileCount: proof.requestedFileCount, originalDispatchUnresolved: true },
        ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null }, transaction);
      return { adopted: true, replayed: false, publicOutcome, candidate: updated, item: saved };
    };
    return queryable ? write(queryable) : withTransaction(write);
  }
  return { adoptDownloadHandoff };
}
