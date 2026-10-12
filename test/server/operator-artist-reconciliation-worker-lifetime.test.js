/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const run = { runId: 'reconcile', appUserId: 'operator', metadataArtistId: 'artist', artistName: 'Artist', snapshotId: 'snapshot', snapshotRevision: 4 };
const lease = () => createOperationRunLeaseFixture({ runId: run.runId, jobType: 'operator_artist_reconciliation' });
const result = { snapshotId: run.snapshotId, snapshotRevision: run.snapshotRevision, downstreamCreatedRequestCount: 1, downstreamCreatedRequestIds: ['request'], discoveryReconciled: true };
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), isCancellationRequested: async () => false,
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    markRunCancelled: async () => true, markRunPaused: async () => true,
    executeOperatorArtistReconciliation: async () => result, releaseLease: async () => {}, ...overrides };
}

test('operator reconciliation coalesces duplicate admission through held release and shares completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createOperatorArtistReconciliationWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun(run); await entered.promise; let second;
  try { second = await worker.startWorkerRun(run); await flush(); assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion); }
  finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued handler retains captured actor and snapshot through execution and terminal close', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let input; let completed; let released = false;
  const worker = createOperatorArtistReconciliationWorker(callbacks({ executeOperatorArtistReconciliation: async value => {
    input = value; entered.resolve(); await gate.promise; return result;
  }, markRunCompleted: async value => { completed = value; return true; }, releaseLease: async () => { released = true; } }));
  const handlers = createOperationQueueHandlers({ metadataModule: { operatorArtistReconciliationWorker: worker } });
  const accepted = await handlers.operator_artist_reconciliation({ run: { id: run.runId, summary: run } });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(typeof accepted.completion.then, 'function'); assert.equal(completed, undefined); assert.equal(released, false);
    for (const field of ['appUserId', 'metadataArtistId', 'snapshotId', 'snapshotRevision']) assert.equal(input[field], run[field]);
    await input.throwIfCancelled(); await assert.rejects(worker.startWorkerRun({ ...run, runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(released, true); assert.equal(completed.summary.triggerSource, 'save');
  for (const field of Object.keys(result)) assert.deepEqual(completed.summary[field], result[field]);
  assert.deepEqual(completed.expectedLease, lease());
});

for (const primary of [new Error('acquisition'), null]) {
  test(`unexpected reconciliation acquisition ${primary === null ? 'null' : 'Error'} remains observable without unowned writes`, async () => {
    const worker = createOperatorArtistReconciliationWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });
  test(`failed reconciliation persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release fallout`, async () => {
    let released = false;
    const worker = createOperatorArtistReconciliationWorker(callbacks({ executeOperatorArtistReconciliation: async () => { throw new Error('execution'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal'); } }),
      releaseLease: async () => { released = true; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary); assert.equal(released, true);
  });
  test(`reconciliation renewal ${primary === null ? 'null' : 'Error'} still attempts captured release`, async () => {
    let released;
    const worker = createOperatorArtistReconciliationWorker(callbacks({ renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
      releaseLease: async value => { released = value; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'completed' });
  });
  test(`reconciliation release ${primary === null ? 'null' : 'Error'} rejects completion and canonical close`, async () => {
    const worker = createOperatorArtistReconciliationWorker(callbacks({ releaseLease: async () => { throw primary; } }));
    const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); void closing.catch(() => {});
    assert.equal(worker.close(), closing); await assert.rejects(completion, error => error === primary); await assert.rejects(closing, error => error === primary);
  });
}

test('expected empty/unavailable/lost reconciliation acquisition authorizes no writes or release', async () => {
  for (const code of [null, 'operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createOperatorArtistReconciliationWorker(callbacks({ acquireLease: async () => {
      if (!code) return null; throw Object.assign(new Error('expected'), { code });
    }, markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
  }
});

test('null reconciliation domain failure persists a fixed message and failed release', async () => {
  let message; let status;
  const worker = createOperatorArtistReconciliationWorker(callbacks({ executeOperatorArtistReconciliation: async () => { throw null; },
    markRunFailed: async value => { message = value.errorMessage; return true; }, releaseLease: async value => { status = value.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(message, 'Operator artist reconciliation failed'); assert.equal(status, 'failed');
});

test('actual admitted reconciliation renewal settles before captured release and close', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const worker = createOperatorArtistReconciliationWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async value => { assert.deepEqual(value.expectedLease, lease()); released = true; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('refused reconciliation start/completed/failed/pause/cancel marks retain authority policy', async () => {
  for (const mark of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunPaused', 'markRunCancelled']) {
    let status; let executed = false;
    const worker = createOperatorArtistReconciliationWorker(callbacks({ [mark]: async () => false,
      executeOperatorArtistReconciliation: async () => { executed = true; if (mark === 'markRunFailed') throw new Error('execution'); return result; },
      isCancellationRequested: async () => mark === 'markRunPaused' ? { kind: 'paused' } : mark === 'markRunCancelled',
      releaseLease: async value => { status = value.status; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
    assert.equal(executed, mark === 'markRunCompleted' || mark === 'markRunFailed');
  }
});

test('lost reconciliation authority suppresses failure persistence while acquired unavailable remains a domain failure', async () => {
  for (const code of ['operation_run_lease_lost', 'operation_run_lease_unavailable']) {
    let failed = false; let released;
    const worker = createOperatorArtistReconciliationWorker(callbacks({ executeOperatorArtistReconciliation: async () => { throw Object.assign(new Error('dependency'), { code }); },
      markRunFailed: async () => { failed = true; return true; }, releaseLease: async value => { released = value; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(failed, code !== 'operation_run_lease_lost');
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'failed' });
  }
});

test('captured reconciliation cancellation hook stops execution at its existing dependency checkpoint', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let cancelled = false; let status;
  const worker = createOperatorArtistReconciliationWorker(callbacks({ isCancellationRequested: async () => cancelled,
    executeOperatorArtistReconciliation: async input => { entered.resolve(); await gate.promise; await input.throwIfCancelled(); return result; },
    releaseLease: async value => { status = value.status; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { cancelled = true; }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(status, 'cancelled');
});
