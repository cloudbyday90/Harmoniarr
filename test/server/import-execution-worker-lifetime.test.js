/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createImportCandidateExecutionWorker } from '../../src/server/import-candidates/import-candidate-execution-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createExecutionWorkerHarness, executionCandidate } from '../../testing/server/import-execution-worker-harness.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const lease = () => createOperationRunLeaseFixture({ runId: 'execution', jobType: 'import_candidate_execution_planning' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('execution coalesces a duplicate through held release and returns the same completion', async () => {
  const releasing = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createImportCandidateExecutionWorker(callbacks({
    acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { releasing.resolve(); await gate.promise; },
  }));
  const first = await worker.startWorkerRun({ runId: 'execution', requestedCandidateCount: 0 });
  await releasing.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'execution', requestedCandidateCount: 0 }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued acceptance precedes work and close seals admission while draining the captured owner', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let completed = false;
  const worker = createImportCandidateExecutionWorker(callbacks({ markRunStarted: async () => { entered.resolve(); await gate.promise; return true; },
    markRunCompleted: async () => { completed = true; return true; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'execution' });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(completed, false);
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await completion; await closing; }
  assert.equal(completed, true);
});

for (const primary of [new Error('execution acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes unchanged`, async () => {
    let released = false;
    const worker = createImportCandidateExecutionWorker(callbacks({ acquireLease: async () => { throw primary; },
      releaseLease: async () => { released = true; } }));
    const { completion } = await worker.startWorkerRun({ runId: 'execution' });
    await assert.rejects(completion, error => error === primary);
    await assert.rejects(worker.close(), error => error === primary); assert.equal(released, false);
  });

  test(`failed domain persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release failures`, async () => {
    let releases = 0;
    const worker = createImportCandidateExecutionWorker(callbacks({
      buildSelectedImportCandidateSummary: async () => { throw new Error('domain'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('release'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'execution' });
    await assert.rejects(completion, error => error === primary);
    await assert.rejects(worker.close(), error => error === primary); assert.equal(releases, 1);
  });
}

test('expected lease unavailable/lost outcomes do not become generic failed runs', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createImportCandidateExecutionWorker(callbacks({ acquireLease: async () => { throw Object.assign(new Error('expected lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('No acquired lease may be marked failed'),
      releaseLease: async () => assert.fail('No acquired lease may be released'),
    }));
    await (await worker.startWorkerRun({ runId: 'execution' })).completion; await worker.close();
  }
});

test('null domain failure persists a bounded message without a secondary TypeError', async () => {
  let message;
  const worker = createImportCandidateExecutionWorker(callbacks({ buildSelectedImportCandidateSummary: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  await (await worker.startWorkerRun({ runId: 'execution' })).completion; await worker.close();
  assert.equal(message, 'Import execution failed');
});

test('actual admitted heartbeat renewal drains before captured lease release', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createImportCandidateExecutionWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'execution' }); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('renewal drainage failure still attempts release and wins over release fallout', async () => {
  const primary = new Error('renewal drain'); let released = false;
  const worker = createImportCandidateExecutionWorker(callbacks({ renewLease: async () => true,
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
    releaseLease: async () => { released = true; throw new Error('release fallout'); },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'execution' });
  await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});

test('returned provider enqueue and advisory Activity settle before local execution cleanup', { timeout: 10000 }, async t => {
  const providerGate = Promise.withResolvers(); const providerEntered = Promise.withResolvers();
  const activityGate = Promise.withResolvers(); const activityEntered = Promise.withResolvers(); let settled = false;
  const harness = createExecutionWorkerHarness(t, { candidates: [executionCandidate()],
    enqueue: async ({ files, username }) => { providerEntered.resolve(); await providerGate.promise;
      return { enqueued: files.map(file => ({ ...file, username, id: randomUUID() })), failed: [] }; },
    workerOverrides: { recordActivityEventFn: async () => { activityEntered.resolve(); await activityGate.promise; throw null; } },
  });
  const { completion } = await harness.worker.startWorkerRun({ runId: 'run-1', requestedCandidateCount: 1 });
  const closing = harness.worker.close(); void completion.then(() => { settled = true; });
  try {
    await waitForFixtureReady({ ready: providerEntered.promise, operation: completion, signal: t.signal });
    assert.equal(harness.marks.completed, null); assert.equal(harness.releaseLease.mock.callCount(), 0);
    providerGate.resolve();
    await waitForFixtureReady({ ready: activityEntered.promise, operation: completion, signal: t.signal }); await flush();
    assert.ok(harness.marks.completed); assert.equal(settled, false); assert.equal(harness.releaseLease.mock.callCount(), 0);
    activityGate.resolve(); await completion; await closing;
    assert.equal(harness.enqueueDownloads.mock.callCount(), 1); assert.equal(harness.releaseLease.mock.callCount(), 1);
    assert.equal(harness.marks.failed, null);
  } finally { providerGate.resolve(); activityGate.resolve(); await completion; await closing; }
});

test('returned receipt confirmation remains owned after provider acceptance', { timeout: 10000 }, async t => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let harness;
  harness = createExecutionWorkerHarness(t, { workerOverrides: { confirmDownloadHandoff: async input => {
    entered.resolve(); await gate.promise; return harness.handoff.confirmDownloadHandoff(input);
  } } });
  const { completion } = await harness.worker.startWorkerRun({ runId: 'run-1', requestedCandidateCount: 1 });
  const closing = harness.worker.close();
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal });
    assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
    assert.equal(harness.marks.completed, null); assert.equal(harness.releaseLease.mock.callCount(), 0);
  } finally { gate.resolve(); await completion; await closing; }
  assert.equal(harness.marks.completed.summary.queuedCount, 1); assert.equal(harness.enqueueDownloads.mock.callCount(), 1);
});

test('failed final lease release rejects actual completion and repeated close unchanged', async () => {
  const primary = new Error('release failure');
  const worker = createImportCandidateExecutionWorker(callbacks({ releaseLease: async () => { throw primary; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'execution' });
  await assert.rejects(completion, error => error === primary);
  const closing = worker.close(); assert.equal(worker.close(), closing);
  await assert.rejects(closing, error => error === primary);
});
