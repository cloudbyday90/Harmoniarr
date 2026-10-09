/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import { createMusicQueueRecoveryExecutionPolicyService } from '../../src/server/import-candidates/music-queue-recovery-execution-policy-service.js';
import { createMusicQueueRecoveryLifecycleService } from '../../src/server/import-candidates/music-queue-recovery-lifecycle-service.js';
import { createMusicQueueExecutionObservationService } from '../../src/server/import-candidates/music-queue-execution-observation-service.js';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportCandidateRecoveryService } from '../../src/server/import-candidates/import-candidate-recovery-service.js';
import { listImportExecutionRunItems, replaceImportExecutionRunItems, updateImportExecutionRunItem,
  upsertImportExecutionRunItem, recordImportExecutionAcceptedObservation } from '../../src/server/import-candidates/import-candidate-execution-repository.js';

export function createRecoveryExecutionOwners(context) {
  const policy = createMusicQueueRecoveryExecutionPolicyService({ store: context.store, assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed });
  const lifecycle = createMusicQueueRecoveryLifecycleService({ store: context.store, withTransaction: context.withTransaction });
  const observation = createMusicQueueExecutionObservationService({ store: context.store, withTransaction: context.withTransaction });
  const recovery = createImportCandidateRecoveryService({ musicQueueRecoveryService: context.service,
    getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId) });
  return { policy, lifecycle, observation, recovery };
}
export async function runMusicQueueRecoveryExecutionWorker(context, runId, candidateId, overrides = {}) {
  const { policy, lifecycle, observation, recovery } = createRecoveryExecutionOwners(context);
  const raw = await context.store.getOrigin(runId, candidateId);
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const calls = { enqueue: 0, confirmed: 0, genericFailure: 0 };
  const worker = createImportCandidateExecutionWorker({
    ...context.executionRuns,
    buildSelectedImportCandidateSummary: async () => {
      const candidate = await context.store.getCandidate(candidateId);
      const selectedCandidates = candidate?.status === 'selected' ? [{ ...candidate, executionStatus: { code: 'ready', message: 'Controlled provider preparation' } }] : [];
      return { selectedCandidates, counts: { totalSelected: selectedCandidates.length, ready: selectedCandidates.length } };
    },
    getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
    ownsRecoveryCandidate: recovery.ownsRecoveryCandidate,
    isCurrentExecutionObservation: context.service.isCurrentExecutionObservation,
    resolveRecoveryExecution: policy.resolveRecoveryExecution,
    assertRecoveryExecutionCurrent: policy.assertRecoveryExecutionCurrent,
    retireRecoveryExecution: lifecycle.retireExecution,
    transitionOwnedExecutionCandidate: observation.transitionOwnedExecutionCandidate,
    handleImportCandidateDownloadFailure: recovery.handleImportCandidateDownloadFailure,
    markImportCandidateDownloadFailed: async () => { calls.genericFailure += 1; throw new Error('Owned failure must not precommit a generic transition'); },
    enqueueDownloads: async ({ files }) => { calls.enqueue += 1; return { enqueued: files.map((file) => ({ ...file, id: randomUUID() })), failed: [] }; },
    recordConfirmedTransfers: async () => { calls.confirmed += 1; },
    recordAcceptedCandidateObservation: (input) => recordImportExecutionAcceptedObservation(input, context.pool),
    listImportExecutionRunItems: (id) => listImportExecutionRunItems(id, context.pool),
    replaceImportExecutionRunItems: (id, items) => replaceImportExecutionRunItems(id, items, context.pool),
    upsertImportExecutionRunItem: (input) => upsertImportExecutionRunItem(input, context.pool),
    updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool),
    ...overrides,
    releaseLease: async (input) => { await context.executionRuns.releaseLease(input); finish(); },
  });
  await worker.startWorkerRun({ runId, selectedCandidateId: candidateId, requestedCandidateCount: 1,
    sourceSearchId: raw.summary.sourceSearchId, triggerSource: raw.summary.triggerSource ?? 'manual' });
  await finished;
  return calls;
}
