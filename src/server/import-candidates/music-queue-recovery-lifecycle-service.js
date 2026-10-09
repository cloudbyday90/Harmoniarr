/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { recordAuditEvent } from '../audit.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { canRetireRecoverySelection, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from './music-queue-recovery-policy.js';

/** Retire only a proven pre-provider refusal; an ambiguous checkpoint remains reserved. */
export function createMusicQueueRecoveryLifecycleService({ store = createMusicQueueRecoveryStore(),
  withTransaction = createDatabaseTransactionRunner(), recordAuditEventFn = recordAuditEvent } = {}) {
  async function retireExecution({ runId, candidateId, sourceObservation, knownDispatchStartedAt = null }) {
    return withTransaction(async (queryable) => {
      await store.lockParents([candidateId], queryable);
      const run = await store.getOrigin(runId, candidateId, queryable);
      const reservation = await store.readExecutionReservation(candidateId, queryable);
      if (!run || !run.has_item) return { retired: false };
      const execution = run.execution_snapshot?.execution;
      const state = execution?.handoff?.state;
      if (execution?.enqueuedTransfers?.length || (['dispatching','awaiting_confirmation'].includes(state)
        && (!knownDispatchStartedAt || execution.handoff.dispatchStartedAt !== knownDispatchStartedAt))) return { retired: false };
      if (knownDispatchStartedAt && !await store.recordExecutionNotDispatched({ runId, candidateId, knownDispatchStartedAt }, queryable)) return { retired: false };
      const candidate = await store.getCandidate(candidateId, queryable);
      const accepted = run.summary.musicQueueRecovery?.selectedObservation ?? execution?.sourceObservation
        ?? (run.summary.triggerSource !== MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE ? sourceObservation : null);
      const stillOwnsSelection = (!reservation || reservation.id === runId)
        && await store.isCurrentExecutionOrigin(candidateId, runId, queryable);
      const held = stillOwnsSelection && canRetireRecoverySelection(candidate, accepted)
        && await store.holdRecoverySelection(candidateId, runId, queryable);
      if (held) {
        await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'import_candidate_held', entityType: 'import_candidate',
          entityId: candidateId, summary: 'A recovery match needs review before a new download', details: { recoveryRunId: runId } }, queryable);
      }
      if (run.summary.triggerSource === MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE) await store.retireExecutionReservation(runId, queryable);
      return { retired: true, held };
    });
  }
  async function retireDiscovery({ runId, knownDispatchAttemptedAt = null }) {
    return withTransaction(async (queryable) => {
      const run = await store.getOrigin(runId, null, queryable);
      const record = run?.summary?.musicQueueRecovery;
      if (run?.summary?.triggerSource !== MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE || !record) return false;
      if (!await store.retireDiscoveryReservation({ runId, record, knownDispatchAttemptedAt }, queryable)) return false;
      await recordAuditEventFn({ actorType: 'system', actorUserId: null, eventType: 'music_queue_recovery_search_stopped', entityType: 'operation_run',
        entityId: runId, summary: 'A delayed recovery search needs a fresh decision', details: { metadataReleaseId: record.metadataReleaseId } }, queryable);
      return true;
    });
  }
  return { retireExecution, retireDiscovery };
}
