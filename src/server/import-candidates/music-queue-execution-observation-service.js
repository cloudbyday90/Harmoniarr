/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { recordAuditEvent } from '../audit.js';
import { recordImportExecutionAcceptedObservation } from './import-candidate-execution-repository.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { captureRecoveryObservation, matchesAcceptedRecoveryProvenance } from './music-queue-recovery-policy.js';

/** Provider observations change only the unchanged candidate owned by this execution episode. */
export function createMusicQueueExecutionObservationService({ store = createMusicQueueRecoveryStore(),
  withTransaction = createDatabaseTransactionRunner(), recordAuditEventFn = recordAuditEvent } = {}) {
  async function transitionOwnedExecutionCandidate({ candidateId, operationRunId, observation, targetStatus, reason = null }) {
    if (!['downloading','import_pending'].includes(targetStatus)) throw new TypeError('Unsupported execution observation phase');
    return withTransaction(async (queryable) => {
      await store.lockParents([candidateId], queryable);
      const candidate = await store.getCandidate(candidateId, queryable);
      if (!candidate || !['selected','downloading'].includes(candidate.status)
        || !matchesAcceptedRecoveryProvenance(candidate, observation)
        || !await store.isCurrentExecutionOrigin(candidateId, operationRunId, queryable)) return null;
      if (candidate.status === targetStatus) return { candidate };
      const updated = await store.transitionExecutionPhase({ candidate, targetStatus, reason }, queryable);
      await recordAuditEventFn({ actorType: 'system', actorUserId: null,
        eventType: targetStatus === 'downloading' ? 'import_candidate_downloading' : 'import_candidate_import_pending',
        entityType: 'import_candidate', entityId: candidateId, summary: 'Music Queue recorded the current execution phase',
        details: { operationRunId } }, queryable);
      await recordImportExecutionAcceptedObservation({ importCandidateId: candidateId, operationRunId,
        observation: captureRecoveryObservation(updated) }, queryable);
      return { candidate: updated };
    });
  }
  return { transitionOwnedExecutionCandidate };
}
