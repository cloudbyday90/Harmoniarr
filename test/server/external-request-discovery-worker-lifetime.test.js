/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestDiscoveryWorker } from '../../src/server/library/library-external-request-discovery-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const run = { runId: 'discovery', mediaRequestId: 'request', intentId: 'intent', triggeredByUserId: 'actor' };
const lease = () => createOperationRunLeaseFixture({ runId: run.runId, jobType: 'library_external_request_discovery' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), isCancellationRequested: async () => false,
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    markRunCancelled: async () => true, markRunPaused: async () => true,
    discoverExternalRequestRelease: async () => ({ candidateCount: 1, fileCount: 1, searchId: 'search' }),
    releaseLease: async () => {}, ...overrides };
}

test('external discovery coalesces duplicate admission through held release and shares completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun(run); await entered.promise; let second;
  try { second = await worker.startWorkerRun(run); await flush(); assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion); }
  finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('handler returns queued acceptance before discovery/persistence while close seals admission', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers();
  let input; let completed; let released = false; let settled = false;
  const result = { candidateCount: 2, fileCount: 4, searchId: 'search', metadataReleaseId: 'release' };
  const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({
    discoverExternalRequestRelease: async value => { input = value; entered.resolve(); await gate.promise; return result; },
    markRunCompleted: async value => { completed = value; return true; }, releaseLease: async () => { released = true; },
  }));
  const handlers = createOperationQueueHandlers({ libraryModule: { libraryExternalRequestDiscoveryWorker: worker } });
  const accepted = await handlers.library_external_request_discovery({ run: { id: run.runId, summary: run, triggeredByUserId: 'actor' } });
  const closing = worker.close(); assert.equal(worker.close(), closing); void closing.then(() => { settled = true; }); await entered.promise;
  try {
    assert.equal(typeof accepted.completion.then, 'function'); assert.equal(completed, undefined);
    assert.deepEqual(input, { intentId: run.intentId, mediaRequestId: run.mediaRequestId, operationRunId: run.runId, triggeredByUserId: 'actor' });
    await assert.rejects(worker.startWorkerRun({ ...run, runId: 'late' }), { code: 'worker_closing' });
    await flush(); assert.equal(settled, false); assert.equal(released, false);
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(released, true);
  assert.deepEqual(completed, { runId: run.runId, expectedLease: lease(), summary: { intentId: run.intentId,
    mediaRequestId: run.mediaRequestId, triggerSource: 'operator_review', failureCode: null, searchOutcome: null,
    ...result, currentStep: 'Candidates ready for import review' } });
});

for (const primary of [new Error('acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes without unowned writes`, async () => {
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });
  test(`failed persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release fallout`, async () => {
    let released = false;
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ discoverExternalRequestRelease: async () => { throw new Error('provider'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal'); } }),
      releaseLease: async () => { released = true; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(released, true);
  });
  test(`renewal ${primary === null ? 'null' : 'Error'} still attempts captured release`, async () => {
    let released;
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
      releaseLease: async value => { released = value; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'completed' });
  });
  test(`release ${primary === null ? 'null' : 'Error'} rejects completion and canonical close`, async () => {
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ releaseLease: async () => { throw primary; } }));
    const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); void closing.catch(() => {});
    assert.equal(worker.close(), closing); await assert.rejects(completion, error => error === primary);
    await assert.rejects(closing, error => error === primary);
  });
}

test('empty/unavailable/lost acquisition retains the expected no-write outcome', async () => {
  for (const code of [null, 'operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ acquireLease: async () => {
      if (!code) return null; throw Object.assign(new Error('expected'), { code });
    }, markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
  }
});

test('generic Error/null domain failure keeps the existing sanitized message', async () => {
  for (const error of [new Error('private-provider-details'), null]) {
    let failed; let released;
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ discoverExternalRequestRelease: async () => { throw error; },
      markRunFailed: async value => { failed = value; return true; }, releaseLease: async value => { released = value; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
    assert.equal(failed.errorMessage, 'External request discovery failed. Review provider health and retry the background job.');
    assert.equal(JSON.stringify(failed).includes('private-provider-details'), false); assert.equal(released.status, 'failed');
  }
});

test('admitted actual renewal settles before captured release and close', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async value => { assert.deepEqual(value.expectedLease, lease()); released = true; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('refused start/completed/failed/pause/cancel marks retain authority policy', async () => {
  for (const mark of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunPaused', 'markRunCancelled']) {
    let status; let searched = false;
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ [mark]: async () => false,
      discoverExternalRequestRelease: async () => { searched = true; if (mark === 'markRunFailed') throw new Error('provider'); return { candidateCount: 1 }; },
      isCancellationRequested: async () => mark === 'markRunPaused' ? { kind: 'paused' } : mark === 'markRunCancelled',
      releaseLease: async value => { status = value.status; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
    assert.equal(searched, mark === 'markRunCompleted' || mark === 'markRunFailed');
  }
});

test('acquired unavailable leaves the chosen lease status while lost lease is failed', async () => {
  for (const code of ['operation_run_lease_lost', 'operation_run_lease_unavailable']) {
    let released;
    const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ discoverExternalRequestRelease: async () => { throw Object.assign(new Error('lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('no terminal write'), releaseLease: async value => { released = value; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: code === 'operation_run_lease_lost' ? 'failed' : 'completed' });
  }
});

test('unavailable during no-candidate persistence retains already failed release status', async () => {
  let status;
  const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ discoverExternalRequestRelease: async () => ({ candidateCount: 0, fileCount: 0 }),
    markRunFailed: async () => { throw Object.assign(new Error('lease outcome'), { code: 'operation_run_lease_unavailable' }); },
    releaseLease: async value => { status = value.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
});

test('cancellation after returned discovery work prevents completed status', async () => {
  let cancelled = false; let status; let marked = false;
  const worker = createLibraryExternalRequestDiscoveryWorker(callbacks({ isCancellationRequested: async () => cancelled,
    discoverExternalRequestRelease: async () => { cancelled = true; return { candidateCount: 1 }; },
    markRunCompleted: async () => assert.fail('cancelled'), markRunCancelled: async () => { marked = true; return true; },
    releaseLease: async value => { status = value.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(marked, true); assert.equal(status, 'cancelled');
});
