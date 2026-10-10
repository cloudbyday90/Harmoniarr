/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';
import { createImportExecutionHandoffStore } from '../../src/server/import-candidates/import-execution-handoff-store.js';
import { createImportExecutionTransferLinkStore } from '../../src/server/import-candidates/import-execution-transfer-link-store.js';
import { createImportCandidateExecutionRunStore } from '../../src/server/import-candidates/import-candidate-execution-run-store.js';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportExecutionPreProviderService } from '../../src/server/import-candidates/import-execution-pre-provider-service.js';
import { createImportExecutionPreProviderStore } from '../../src/server/import-candidates/import-execution-pre-provider-store.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { initializeImportExecutionRunItems, upsertImportExecutionRunItem, listImportExecutionRunItems,
  updateImportExecutionRunItem } from '../../src/server/import-candidates/import-candidate-execution-repository.js';
import { seedImportCandidateFixture } from './import-candidate-fixtures.js';
import { createFixtureWorkerObserver, withFixtureLifecycle } from './fixture-lifecycle.js';

export function createImportExecutionHandoffFixtureContext({ getPoolFn }) {
  const store = createImportExecutionHandoffStore({ getPoolFn });
  const links = createImportExecutionTransferLinkStore({ getPoolFn });
  const runs = createImportCandidateExecutionRunStore({ getPoolFn });
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
  const preparation = createImportExecutionPreProviderService({ store: createImportExecutionPreProviderStore({ getPoolFn }), withTransaction });
  const handoff = createImportExecutionHandoffService({ store, transferLinkStore: links,
    withTransaction, preProviderService: preparation });
  return { pool: getPoolFn(), getPoolFn, store, links, runs, handoff, preparation, withTransaction };
}

export async function seedImportExecutionHandoffFixture(context, { files = 1 } = {}) {
  const stored = await seedImportCandidateFixture({ queryable: context.pool,
    candidateOverrides: { status: 'selected', username: 'handoff-peer' },
    files: Array.from({ length: files }, (_, index) => ({ filename: `${index + 1}.flac`, extension: 'flac', sizeBytes: 1000 + index, isLocked: false })) });
  const run = await context.runs.createOperationRun({ status: 'running', requestedCandidateCount: 1,
    summary: { executionMode: 'download_enqueue', selectedCandidateId: stored.id, triggerSource: 'manual', sourceSearchId: stored.sourceSearchId } });
  await initializeImportExecutionRunItems(run.id, [{ importCandidateId: stored.id, itemStatus: 'ready', position: 1,
    statusMessage: 'Controlled initial download planning', planningSnapshot: { candidate: { id: stored.id, username: 'handoff-peer' } } }], context.pool);
  const candidate = await context.store.getCandidate(stored.id);
  return { importCandidateId: stored.id, operationRunId: run.id, candidate,
    sourceObservation: captureRecoveryObservation(candidate), username: candidate.username,
    requestedFiles: candidate.files.map((file) => ({ filename: file.rawPayload.filename, size: file.sizeBytes })) };
}

export async function runImportExecutionHandoffFixtureWorker(context, fixture, overrides = {}, {
  createWorkerFn = createImportCandidateExecutionWorker,
  signal = context.fixtureSignal,
} = {}) {
  return withFixtureLifecycle({ signal }, async (scope) => {
  const callbacks = { ...context.runs, ...context.handoff, ...context.preparation,
    getImportCandidate: ({ importCandidateId }) => context.store.getCandidate(importCandidateId),
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ ...(await context.store.getCandidate(fixture.importCandidateId)),
      executionStatus: { code: 'ready', message: 'Controlled valid planning' } }], counts: { totalSelected: 1, ready: 1 } }),
    listImportExecutionRunItems: (id) => listImportExecutionRunItems(id, context.pool),
    initializeImportExecutionRunItems: (id, items) => initializeImportExecutionRunItems(id, items, context.pool),
    upsertImportExecutionRunItem: (input) => upsertImportExecutionRunItem(input, context.pool),
    updateImportExecutionRunItem: (input) => updateImportExecutionRunItem(input, context.pool),
    ...overrides,
  };
  const observer = createFixtureWorkerObserver({ callbacks });
  const worker = createWorkerFn({ ...callbacks, ...observer.callbacks,
    isCancellationRequested: async (input) => scope.signal.aborted || await callbacks.isCancellationRequested?.(input) || false,
  });
  scope.track(observer.finished);
  await worker.startWorkerRun({ runId: fixture.operationRunId, requestedCandidateCount: 1, selectedCandidateId: fixture.importCandidateId });
  await observer.finished;
  });
}
