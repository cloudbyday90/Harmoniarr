/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryProviderIngestExecutionWorker } from '../../src/server/library/library-provider-ingest-execution-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const run = { runId: 'ingest', mediaRequestId: 'request', canonicalUrl: 'https://open.spotify.com/album/album123',
  resourceType: 'release', sourceIdentifier: 'album123', sourceProvider: 'spotify', triggeredByUserId: 'actor' };
const lease = () => createOperationRunLeaseFixture({ runId: run.runId, jobType: 'library_external_intake_execution' });
const result = { executedCount: 2, failedCount: 1, derivedIngestRequests: [{ id: 'derived' }] };
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), isCancellationRequested: async () => false,
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    markRunCancelled: async () => true, markRunPaused: async () => true,
    executeProviderIngestRequests: async () => result, releaseLease: async () => {}, ...overrides };
}

test('ingest coalesces duplicate admission through held release and shares actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun(run); await entered.promise; let second;
  try { second = await worker.startWorkerRun(run); await flush(); assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion); }
  finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued handler acceptance is earlier than provider work and close preserves partial-result policy', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers();
  let inputs; let completed; let released = false; let settled = false;
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({
    executeProviderIngestRequests: async input => { inputs = input; entered.resolve(); await gate.promise; return result; },
    markRunCompleted: async input => { completed = input; return true; },
    markRunFailed: async () => assert.fail('handled row failure is not a worker failure'), releaseLease: async () => { released = true; },
  }));
  const handlers = createOperationQueueHandlers({ libraryModule: { libraryProviderIngestExecutionWorker: worker } });
  const accepted = await handlers.library_external_intake_execution({ run: { id: run.runId, summary: run, triggeredByUserId: run.triggeredByUserId } });
  const closing = worker.close(); assert.equal(worker.close(), closing); void closing.then(() => { settled = true; }); await entered.promise;
  try {
    assert.equal(typeof accepted.completion.then, 'function'); assert.equal(completed, undefined);
    assert.deepEqual(inputs, { mediaRequestId: run.mediaRequestId, operationRunId: run.runId,
      triggerSource: 'planning_complete', triggeredByUserId: 'actor' });
    await assert.rejects(worker.startWorkerRun({ ...run, runId: 'late' }), { code: 'worker_closing' });
    await flush(); assert.equal(settled, false); assert.equal(released, false);
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(released, true);
  assert.deepEqual(completed, { runId: run.runId, expectedLease: lease(), summary: {
    canonicalUrl: run.canonicalUrl, currentStep: 'Provider ingest execution completed', derivedIngestRequestCount: 1,
    executedCount: 2, failedCount: 1, mediaRequestId: run.mediaRequestId, resourceType: run.resourceType,
    sourceIdentifier: run.sourceIdentifier, sourceProvider: run.sourceProvider, triggerSource: 'planning_complete',
  } });
});

for (const primary of [new Error('acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} remains observable without unowned writes`, async () => {
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });
  test(`work persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release failures`, async () => {
    let released = false;
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ executeProviderIngestRequests: async () => { throw new Error('domain'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal'); } }),
      releaseLease: async () => { released = true; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(released, true);
  });
  test(`renewal ${primary === null ? 'null' : 'Error'} still attempts captured release`, async () => {
    let released;
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
      releaseLease: async input => { released = input; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'completed' });
  });
  test(`release ${primary === null ? 'null' : 'Error'} rejects completion and canonical close`, async () => {
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ releaseLease: async () => { throw primary; } }));
    const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); void closing.catch(() => {});
    assert.equal(worker.close(), closing); await assert.rejects(completion, error => error === primary);
    await assert.rejects(closing, error => error === primary);
  });
}

test('expected empty/unavailable/lost acquisition does not authorize writes or release', async () => {
  for (const code of [null, 'operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ acquireLease: async () => {
      if (!code) return null; throw Object.assign(new Error('expected'), { code });
    }, markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
  }
});

test('null worker domain failure persists its fixed message and failed release', async () => {
  let message; let status;
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({ executeProviderIngestRequests: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; }, releaseLease: async input => { status = input.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(message, 'Provider ingest execution failed'); assert.equal(status, 'failed');
});

test('actual admitted renewal settles before captured release and close', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('refused start/completed/failed/pause/cancel marks retain captured authority policy', async () => {
  for (const mark of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunPaused', 'markRunCancelled']) {
    let status; let executed = false;
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ [mark]: async () => false,
      executeProviderIngestRequests: async () => { executed = true; if (mark === 'markRunFailed') throw new Error('domain'); return result; },
      isCancellationRequested: async () => mark === 'markRunPaused' ? { kind: 'paused', pauseMessage: 'maintenance' } : mark === 'markRunCancelled',
      releaseLease: async input => { status = input.status; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
    assert.equal(executed, mark === 'markRunCompleted' || mark === 'markRunFailed');
  }
});

test('lost lease suppresses failure persistence while acquired unavailable is a domain failure', async () => {
  for (const code of ['operation_run_lease_lost', 'operation_run_lease_unavailable']) {
    let failed = false; let released;
    const worker = createLibraryProviderIngestExecutionWorker(callbacks({ executeProviderIngestRequests: async () => { throw Object.assign(new Error('dependency'), { code }); },
      markRunFailed: async () => { failed = true; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(failed, code !== 'operation_run_lease_lost');
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'failed' });
  }
});

test('one bounded collection batch can complete local execution while collection remains preparing', async () => {
  let summary; let completed = false;
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers();
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({ executeProviderIngestRequests: async () => {
    entered.resolve(); await gate.promise; return { executedCount: 10, failedCount: 0, collection: { status: 'preparing' }, derivedIngestRequests: [] };
  }, markRunCompleted: async input => { summary = input.summary; completed = true; return true; } }));
  const { completion } = await worker.startWorkerRun({ ...run, triggerSource: 'collection_resume' }); const closing = worker.close(); await entered.promise;
  try { assert.equal(completed, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(summary.executedCount, 10); assert.equal(summary.failedCount, 0); assert.equal(summary.triggerSource, 'collection_resume');
});

test('maintenance pause retains retry metadata without executing providers', async () => {
  let paused; let released;
  const worker = createLibraryProviderIngestExecutionWorker(callbacks({ isCancellationRequested: async () => ({ kind: 'paused',
    nextRetryAt: '2026-10-11T15:00:00.000Z', pauseCode: 'recovery_lock_conflict', pauseProvider: 'restore', pauseMessage: 'maintenance' }),
    executeProviderIngestRequests: async () => assert.fail('paused'), markRunPaused: async input => { paused = input; return true; },
    releaseLease: async input => { released = input; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(paused.nextAttemptAt, '2026-10-11T15:00:00.000Z'); assert.equal(paused.summary.pauseProvider, 'restore');
  assert.equal(paused.summary.pauseCode, 'recovery_lock_conflict'); assert.equal(released.status, 'paused');
});
