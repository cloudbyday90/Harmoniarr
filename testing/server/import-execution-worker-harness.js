/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createImportExecutionHandoffService } from '../../src/server/import-candidates/import-execution-handoff-service.js';

export function executionCandidate(overrides = {}) {
  return {
    id: 'candidate-1', status: 'selected', updatedAt: '2026-10-08T12:00:00.000Z',
    selectedAt: '2026-10-08T12:00:00.000Z', sourceProvider: 'slskd',
    sourceSearchId: 'search-1', sourceResponseKey: 'response-1', username: 'peer',
    folderPath: 'Artist/Album', normalizedPayload: {},
    executionStatus: { code: 'ready', message: 'Ready for download.' },
    planning: {}, fileCount: 1, lockedFileCount: 0, totalSizeBytes: 123,
    files: [{ id: 'file-1', filename: '01.flac', folderPath: 'Artist/Album',
      extension: '.flac', sizeBytes: 123, isLocked: false,
      rawPayload: { filename: 'Artist\\Album\\01.flac' } }],
    ...overrides,
  };
}

/** Uses the real receipt/confirmation service; persistence is an explicit unit-test seam. */
export function createExecutionWorkerHarness(t, { candidates = [executionCandidate()], existingItems = [],
  enqueue = async ({ files, username }) => ({ enqueued: files.map((file) => ({ ...file, username, id: randomUUID(), state: 'Queued' })), failed: [] }),
  workerOverrides = {},
} = {}) {
  const candidateRows = new Map(candidates.map((candidate) => [candidate.id, structuredClone(candidate)]));
  const items = new Map(existingItems.map((item) => [item.importCandidateId, structuredClone(item)]));
  const marks = { completed: null, failed: null, paused: null, cancelled: null };
  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const lease = { leaseKey: 'import_candidate_execution_planning:run-1', acquisitionId: randomUUID(), ownerInstanceId: 'unit-worker', acquiredAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), state: 'active', releasedAt: null, status: 'active' };
  const recordConfirmedTransfers = t.mock.fn(async () => []);
  const transitionDownloading = t.mock.fn(async ({ candidate }) => {
    const updated = { ...candidateRows.get(candidate.id), status: 'downloading' };
    candidateRows.set(candidate.id, updated);
    return structuredClone(updated);
  });
  const recordAuditEventFn = t.mock.fn(async () => {});
  const updateCheckpoint = async ({ item, expectedAttemptId, execution, itemStatus, statusMessage }) => {
    const current = items.get(item.importCandidateId);
    if (!current || (current.planningSnapshot?.execution?.handoff?.attempt?.attemptId ?? null) !== expectedAttemptId) return null;
    const updated = { ...current, itemStatus, statusMessage, planningSnapshot: { ...current.planningSnapshot, execution } };
    items.set(item.importCandidateId, updated);
    return structuredClone(updated);
  };
  const handoff = createImportExecutionHandoffService({
    withTransaction: async (work) => work({ unitQueryable: true }), recordAuditEventFn,
    transferLinkStore: { recordConfirmedTransfers },
    store: {
      lockEvidence: async ({ importCandidateId, operationRunId }) => {
        const item = items.get(importCandidateId);
        return item?.operationRunId === operationRunId ? structuredClone(item) : null;
      },
      getCandidate: async (id) => structuredClone(candidateRows.get(id) ?? null),
      isCurrentOrigin: async () => true, isDispatchRunActive: async () => true, updateCheckpoint, transitionDownloading,
      findUnresolvedOtherHandoff: async () => null,
      recordPendingCheck: async ({ importCandidateId }) => items.get(importCandidateId),
    },
  });
  const initializeImportExecutionRunItems = t.mock.fn(async (runId, proposed) => {
    for (const item of proposed) if (!items.has(item.importCandidateId)) {
      items.set(item.importCandidateId, { ...structuredClone(item), id: randomUUID(), operationRunId: runId });
    }
    return [...items.values()];
  });
  const updateImportExecutionRunItem = t.mock.fn(async (item) => {
    const updated = { ...items.get(item.importCandidateId), ...structuredClone(item) };
    items.set(item.importCandidateId, updated);
    return updated;
  });
  const enqueueDownloads = t.mock.fn(enqueue);
  const buildSelectedImportCandidateSummary = t.mock.fn(async ({ candidateIds } = {}) => {
    const selectedCandidates = [...candidateRows.values()].filter((candidate) => candidate.status === 'selected'
      && (!candidateIds || candidateIds.includes(candidate.id)));
    return { selectedCandidates: structuredClone(selectedCandidates), counts: {
      blocked: selectedCandidates.filter((candidate) => candidate.executionStatus.code === 'blocked').length,
      ready: selectedCandidates.filter((candidate) => candidate.executionStatus.code === 'ready').length,
      readyWithWarnings: 0, totalSelected: selectedCandidates.length,
    } };
  });
  const releaseLease = t.mock.fn(async (args) => { finish(args); });
  const worker = createImportCandidateExecutionWorker({
    acquireLease: async () => lease, getLease: async () => lease, releaseLease,
    buildSelectedImportCandidateSummary, enqueueDownloads,
    getImportCandidate: async ({ importCandidateId }) => structuredClone(candidateRows.get(importCandidateId) ?? null),
    listImportExecutionRunItems: async () => [...items.values()].map((item) => structuredClone(item)),
    initializeImportExecutionRunItems, upsertImportExecutionRunItem: async (item) => {
      if (!items.has(item.importCandidateId)) items.set(item.importCandidateId, { ...item, id: randomUUID() });
      return items.get(item.importCandidateId);
    },
    updateImportExecutionRunItem, ...handoff,
    markRunStarted: async () => {},
    markRunCompleted: async (args) => { marks.completed = args; },
    markRunFailed: async (args) => { marks.failed = args; },
    markRunPaused: async (args) => { marks.paused = args; },
    markRunCancelled: async (args) => { marks.cancelled = args; },
    markImportCandidateDownloadFailed: async ({ importCandidateId }) => {
      const candidate = { ...candidateRows.get(importCandidateId), status: 'failed' };
      candidateRows.set(importCandidateId, candidate);
      return { candidate };
    },
    ...workerOverrides,
  });
  return { worker, handoff, lease, candidateRows, items, marks, enqueueDownloads, recordConfirmedTransfers,
    transitionDownloading, recordAuditEventFn, initializeImportExecutionRunItems, updateImportExecutionRunItem,
    buildSelectedImportCandidateSummary, releaseLease,
    run: async (args = {}) => {
      await worker.startWorkerRun({ requestedCandidateCount: candidates.length, runId: 'run-1', ...args });
      return finished;
    },
  };
}
