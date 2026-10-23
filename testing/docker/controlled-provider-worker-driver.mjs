/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

async function execute({ store, worker, runId, inputs }) {
  const run = await store.getRunById(runId);
  assert.equal(run?.status, 'pending', 'the fixture must start the accepted pending run');
  const { completion } = await worker.startWorkerRun({ runId, ...inputs(run), triggerSource: run.triggerSource });
  assert.equal(typeof completion?.then, 'function', 'owned worker completion is required');
  await completion;
  const finished = await store.getRunById(runId);
  assert.equal(finished?.status, 'completed', `Run ended as ${finished?.status}: ${finished?.errorMessage ?? 'no recorded error'}`);
  return finished;
}

export function executeControlledDownload(module, runId) {
  return execute({ store: module.importCandidateExecutionRunStore, worker: module.importCandidateExecutionWorker, runId,
    inputs: run => ({ requestedCandidateCount: run.requestedCandidateCount ?? 1,
      selectedCandidateId: run.selectedCandidateId, sourceSearchId: run.sourceSearchId }) });
}
export function executeControlledApply(module, runId) {
  return execute({ store: module.importCandidateApplyRunStore, worker: module.importCandidateApplyWorker, runId,
    inputs: run => ({ applySafetyMode: run.applySafetyMode, importCandidateIds: run.importCandidateIds,
      executableCandidateCount: run.executableCandidateCount ?? 1,
      requestedCandidateCount: run.requestedCandidateCount ?? 1 }) });
}
export function executeControlledDiscovery(module, runId) {
  return execute({ store: module.libraryDiscoveryRunStore, worker: module.libraryDiscoveryWorker, runId,
    inputs: run => ({ triggeredByUserId: run.triggeredByUserId ?? null }) });
}
