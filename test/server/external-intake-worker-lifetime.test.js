/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalIntakeWorker } from '../../src/server/library/library-external-intake-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const run = { runId: 'planning', mediaRequestId: 'request', canonicalUrl: 'launch-metadata',
  resourceType: 'release', sourceIdentifier: 'launch-id', sourceProvider: 'spotify', triggeredByUserId: 'actor' };
const lease = () => createOperationRunLeaseFixture({ runId: run.runId, jobType: 'library_external_intake_planning' });
const result = { normalizedSource: { canonicalUrl: 'https://open.spotify.com/album/stored-id',
  resourceType: 'release', sourceIdentifier: 'stored-id', provider: 'spotify' },
  plannedAt: '2026-10-11T00:00:00.000Z', providerIngestRequests: [{ id: 'ingest' }] };
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), isCancellationRequested: async () => false,
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    markRunCancelled: async () => true, markRunPaused: async () => true,
    planExternalMediaRequest: async () => result, releaseLease: async () => {}, ...overrides };
}

test('intake coalesces the same run through held release and shares actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createLibraryExternalIntakeWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun(run); await entered.promise; let second;
  try {
    second = await worker.startWorkerRun(run); await flush(); assert.equal(acquisitions, 1);
    assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued handler acceptance stays earlier than planning/handoff and close seals admission', async () => {
  const planning = Promise.withResolvers(); const planEntered = Promise.withResolvers();
  const queue = Promise.withResolvers(); const queueEntered = Promise.withResolvers();
  let handoff; let planned; let completed = false; let released = false; let settled = false;
  const worker = createLibraryExternalIntakeWorker(callbacks({
    planExternalMediaRequest: async input => { planned = input; planEntered.resolve(); await planning.promise; return result; },
    queueExternalMediaRequestExecution: async input => { handoff = input; queueEntered.resolve(); await queue.promise; },
    markRunCompleted: async () => { completed = true; return true; }, releaseLease: async () => { released = true; },
  }));
  const handlers = createOperationQueueHandlers({ libraryModule: { libraryExternalIntakeWorker: worker } });
  const accepted = await handlers.library_external_intake_planning({ run: { id: run.runId, summary: run, triggeredByUserId: run.triggeredByUserId } });
  const closing = worker.close(); assert.equal(worker.close(), closing);
  void closing.then(() => { settled = true; }); await planEntered.promise;
  try {
    assert.equal(typeof accepted.completion.then, 'function'); assert.equal(completed, false); assert.equal(handoff, undefined);
    await assert.rejects(worker.startWorkerRun({ ...run, runId: 'late' }), { code: 'worker_closing' });
    planning.resolve(); await queueEntered.promise;
    assert.deepEqual(planned, { mediaRequestId: run.mediaRequestId, operationRunId: run.runId,
      triggeredByUserId: run.triggeredByUserId, triggerSource: 'request_submit' });
    assert.deepEqual(handoff, { canonicalUrl: result.normalizedSource.canonicalUrl, mediaRequestId: run.mediaRequestId,
      resourceType: 'release', sourceIdentifier: 'stored-id', sourceProvider: 'spotify', triggerSource: 'planning_complete', triggeredByUserId: 'actor' });
    await flush(); assert.equal(completed, false); assert.equal(released, false); assert.equal(settled, false);
  } finally { planning.resolve(); queue.resolve(); await accepted.completion; await closing; }
  assert.equal(completed, true); assert.equal(released, true);
});

for (const primary of [new Error('acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} stays observable without unowned writes`, async () => {
    const worker = createLibraryExternalIntakeWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });
  test(`work persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release fallout`, async () => {
    let released = false;
    const worker = createLibraryExternalIntakeWorker(callbacks({ planExternalMediaRequest: async () => { throw new Error('domain'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal'); } }),
      releaseLease: async () => { released = true; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(released, true);
  });
  test(`renewal ${primary === null ? 'null' : 'Error'} still attempts captured release`, async () => {
    let released;
    const worker = createLibraryExternalIntakeWorker(callbacks({ renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
      releaseLease: async input => { released = input; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'completed' });
  });
  test(`release ${primary === null ? 'null' : 'Error'} rejects actual completion and canonical close`, async () => {
    const worker = createLibraryExternalIntakeWorker(callbacks({ releaseLease: async () => { throw primary; } }));
    const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); void closing.catch(() => {});
    assert.equal(worker.close(), closing); await assert.rejects(completion, error => error === primary);
    await assert.rejects(closing, error => error === primary);
  });
}

test('expected empty/unavailable/lost acquisition does not authorize writes or release', async () => {
  for (const code of [null, 'operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createLibraryExternalIntakeWorker(callbacks({ acquireLease: async () => {
      if (!code) return null; throw Object.assign(new Error('expected'), { code });
    }, markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
  }
});

test('null domain failure persists a fixed message and normal failed release', async () => {
  let message; let status;
  const worker = createLibraryExternalIntakeWorker(callbacks({ planExternalMediaRequest: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; }, releaseLease: async input => { status = input.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(message, 'External provider ingest planning failed'); assert.equal(status, 'failed');
});

test('admitted heartbeat renewal finishes before captured release and close', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const worker = createLibraryExternalIntakeWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('refused start/completed/failed/pause/cancel marks retain authority policy', async () => {
  for (const mark of ['markRunStarted', 'markRunCompleted', 'markRunFailed', 'markRunPaused', 'markRunCancelled']) {
    let status; let queued = false;
    const worker = createLibraryExternalIntakeWorker(callbacks({ [mark]: async () => false,
      ...(mark === 'markRunFailed' ? { planExternalMediaRequest: async () => { throw new Error('domain'); } } : {}),
      isCancellationRequested: async () => mark === 'markRunPaused' ? { kind: 'paused', pauseMessage: 'maintenance' } : mark === 'markRunCancelled',
      queueExternalMediaRequestExecution: async () => { queued = true; }, releaseLease: async input => { status = input.status; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
    assert.equal(queued, mark === 'markRunCompleted');
  }
});

test('lost lease suppresses failure persistence while acquired unavailable remains a domain failure', async () => {
  for (const code of ['operation_run_lease_lost', 'operation_run_lease_unavailable']) {
    let failed = false; let released;
    const worker = createLibraryExternalIntakeWorker(callbacks({ planExternalMediaRequest: async () => { throw Object.assign(new Error('dependency'), { code }); },
      markRunFailed: async () => { failed = true; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(failed, code !== 'operation_run_lease_lost');
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'failed' });
  }
});

test('empty plans do not create an execution handoff', async () => {
  const worker = createLibraryExternalIntakeWorker(callbacks({ planExternalMediaRequest: async () => ({ ...result, providerIngestRequests: [] }),
    queueExternalMediaRequestExecution: async () => assert.fail('empty plan') }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
});

test('cancellation after admitted queue handoff cannot report planning completed', async () => {
  let cancelled = false; let status; let marked = false; let queued = 0;
  const worker = createLibraryExternalIntakeWorker(callbacks({ isCancellationRequested: async () => cancelled,
    queueExternalMediaRequestExecution: async () => { queued++; cancelled = true; },
    markRunCompleted: async () => assert.fail('cancelled'), markRunCancelled: async () => { marked = true; return true; },
    releaseLease: async input => { status = input.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(queued, 1); assert.equal(marked, true); assert.equal(status, 'cancelled');
});
