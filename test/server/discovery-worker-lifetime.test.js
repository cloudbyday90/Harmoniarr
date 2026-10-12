/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const lease = () => createOperationRunLeaseFixture({ runId: 'discovery', jobType: 'library_discovery_dispatch' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('discovery coalesces a duplicate through held release with shared actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createLibraryDiscoveryWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun({ runId: 'discovery' }); await entered.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'discovery' }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued discovery acceptance propagates through its handler while close seals admission', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let completed = false;
  const worker = createLibraryDiscoveryWorker(callbacks({ markRunStarted: async () => { entered.resolve(); await gate.promise; return true; },
    markRunCompleted: async () => { completed = true; return true; } }));
  const handlers = createOperationQueueHandlers({ libraryModule: { libraryDiscoveryWorker: worker } });
  const accepted = await handlers.library_discovery_dispatch({ run: { id: 'discovery', summary: {} } });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(completed, false); assert.equal(typeof accepted.completion.then, 'function');
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(completed, true);
});

for (const primary of [new Error('discovery acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes with no unowned release`, async () => {
    const worker = createLibraryDiscoveryWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('Unowned failure must not update a run'),
      releaseLease: async () => assert.fail('Unowned acquisition must not release'),
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'discovery' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });

  test(`failed discovery persistence ${primary === null ? 'null' : 'Error'} survives renewal/release fallout`, async () => {
    let releases = 0;
    const worker = createLibraryDiscoveryWorker(callbacks({
      dispatchDiscoveryRequests: async () => { throw new Error('discovery input'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('release fallout'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'discovery' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(releases, 1);
  });
}

test('expected lease refusal/loss keeps domain and release policy', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createLibraryDiscoveryWorker(callbacks({ acquireLease: async () => { throw Object.assign(new Error('expected lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('No acquired lease may be marked failed'),
      releaseLease: async () => assert.fail('No acquired lease may be released'),
    }));
    await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
  }
});

test('null discovery failure is persisted with its fixed fallback message', async () => {
  let message;
  const worker = createLibraryDiscoveryWorker(callbacks({ dispatchDiscoveryRequests: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
  assert.equal(message, 'Library discovery failed');
});

test('lease-coded failure after acquisition retains the owning domain outcome and captured release', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    let failed; let released;
    const worker = createLibraryDiscoveryWorker(callbacks({ dispatchDiscoveryRequests: async () => {
      throw Object.assign(new Error('discovery dependency lease outcome'), { code });
    }, markRunFailed: async input => { failed = input; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
    assert.deepEqual(released.expectedLease, lease());
    if (code === 'operation_run_lease_lost') { assert.equal(failed, undefined); assert.equal(released.status, 'failed'); }
    else { assert.equal(failed.errorMessage, 'discovery dependency lease outcome'); assert.equal(released.status, 'failed'); }
  }
});

test('discovery waits for actual admitted renewal before releasing the captured lease', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createLibraryDiscoveryWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'discovery' }); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('renewal drain failure still attempts lease release and remains primary', async () => {
  const primary = new Error('renewal drain'); let released = false;
  const worker = createLibraryDiscoveryWorker(callbacks({ renewLease: async () => true,
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
    releaseLease: async () => { released = true; throw new Error('release fallout'); },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'discovery' });
  await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});

test('held eligible pruning keeps duplicate coalescing and close pending after release', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0; let releases = 0; let settled = false;
  const worker = createLibraryDiscoveryWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { releases++; }, pruneOldRuns: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun({ runId: 'discovery' }); await entered.promise;
  const second = await worker.startWorkerRun({ runId: 'discovery' }); const closing = worker.close();
  void closing.then(() => { settled = true; });
  try { await flush(); assert.equal(acquisitions, 1); assert.equal(releases, 1); assert.equal(settled, false);
    assert.equal(first.completion, second.completion); }
  finally { gate.resolve(); await first.completion; await closing; }
});

test('eligible pruning failure rejects completion and canonical close after release', async () => {
  const primary = new Error('pruning'); let released = false;
  const worker = createLibraryDiscoveryWorker(callbacks({ releaseLease: async () => { released = true; }, pruneOldRuns: async () => { throw primary; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'discovery' }); await assert.rejects(completion, error => error === primary);
  const closing = worker.close(); assert.equal(worker.close(), closing); await assert.rejects(closing, error => error === primary);
  assert.equal(released, true);
});

test('pruning is skipped for lost/refused authority and failed renewal/release cleanup', async () => {
  for (const mode of ['lost', 'started_false', 'completed_false', 'renewal', 'release', 'empty']) {
    let pruned = 0; let releases = 0; const primary = new Error(mode);
    const worker = createLibraryDiscoveryWorker(callbacks({
      ...(mode === 'empty' ? { acquireLease: async () => null } : {}),
      markRunStarted: async () => mode !== 'started_false', markRunCompleted: async () => mode !== 'completed_false',
      dispatchDiscoveryRequests: async () => {
        if (mode === 'lost') throw Object.assign(new Error('lost'), { code: 'operation_run_lease_lost' });
        return { attemptedCount: 0 };
      },
      ...(mode === 'renewal' ? { renewLease: async () => true,
        createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }) } : {}),
      releaseLease: async () => { releases++; if (mode === 'release') throw primary; }, pruneOldRuns: async () => { pruned++; },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'discovery' });
    if (['renewal', 'release'].includes(mode)) { await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary); }
    else { await completion; await worker.close(); }
    assert.equal(pruned, 0); assert.equal(releases, mode === 'empty' ? 0 : 1);
  }
});

test('handled domain failure still prunes after captured lease release', async () => {
  const calls = [];
  const worker = createLibraryDiscoveryWorker(callbacks({ dispatchDiscoveryRequests: async () => { throw new Error('dispatch'); },
    markRunFailed: async () => { calls.push('failed'); return true; }, releaseLease: async () => { calls.push('release'); },
    pruneOldRuns: async () => { calls.push('prune'); },
  }));
  await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
  assert.deepEqual(calls, ['failed', 'release', 'prune']);
});

test('reconciliation, artwork and provider promises are owned in order while close waits', { timeout: 10000 }, async t => {
  const calls = []; const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const artworkEntered = Promise.withResolvers(); const artworkGate = Promise.withResolvers();
  const worker = createLibraryDiscoveryWorker(callbacks({
    reconcileWantedReleases: async input => { assert.deepEqual(input.workerContext.expectedLease, lease()); calls.push('wanted'); },
    reconcileDiscoveryRequests: async () => { calls.push('reconcile'); },
    prefetchMonitoredArtistArtwork: async () => { calls.push('artwork'); artworkEntered.resolve(); await artworkGate.promise; return { cachedCount: 1 }; },
    dispatchDiscoveryRequests: async input => { calls.push('provider'); assert.deepEqual(input, { actorUserId: 'actor', requestMetadata: { controlled: true } });
      entered.resolve(); await gate.promise; return { attemptedCount: 1, dispatchedCount: 1 }; },
    releaseLease: async () => { released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'discovery', triggeredByUserId: 'actor', requestMetadata: { controlled: true } }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: artworkEntered.promise, operation: completion, signal: t.signal });
    assert.deepEqual(calls, ['wanted', 'reconcile', 'artwork']); assert.equal(released, false); artworkGate.resolve();
    await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal });
    assert.deepEqual(calls, ['wanted', 'reconcile', 'artwork', 'provider']); assert.equal(released, false); }
  finally { artworkGate.resolve(); gate.resolve(); await completion; await closing; }
});

test('scoped recovery forwards its run identity and excludes global work', async () => {
  const calls = []; let forwarded;
  const worker = createLibraryDiscoveryWorker(callbacks({ reconcileWantedReleases: async () => { calls.push('wanted'); },
    reconcileDiscoveryRequests: async () => { calls.push('reconcile'); }, prefetchMonitoredArtistArtwork: async () => { calls.push('artwork'); },
    dispatchDiscoveryRequests: async input => { forwarded = input; return { attemptedCount: 1, dispatchedCount: 1 }; },
  }));
  await (await worker.startWorkerRun({ runId: 'discovery', triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE })).completion; await worker.close();
  assert.deepEqual(calls, []); assert.deepEqual(forwarded, { actorUserId: null, requestMetadata: null, runId: 'discovery', triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE });
});

test('null artwork failure stays best-effort with a fixed message, while artwork lease loss forbids dispatch/pruning', async () => {
  for (const lost of [false, true]) {
    let completed; let dispatches = 0; let pruned = 0;
    const worker = createLibraryDiscoveryWorker(callbacks({ prefetchMonitoredArtistArtwork: async () => {
      if (lost) throw Object.assign(new Error('lost'), { code: 'operation_run_lease_lost' }); throw null;
    }, dispatchDiscoveryRequests: async () => { dispatches++; return { attemptedCount: 1, dispatchedCount: 1 }; },
    markRunCompleted: async input => { completed = input; return true; }, pruneOldRuns: async () => { pruned++; } }));
    await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
    assert.equal(dispatches, lost ? 0 : 1); assert.equal(pruned, lost ? 0 : 1);
    if (lost) assert.equal(completed, undefined);
    else assert.deepEqual(completed.summary.monitoredArtistArtwork, { errorMessage: 'Monitored artist artwork prefetch failed', status: 'failed' });
  }
});

for (const primary of [new Error('failed persistence'), null]) {
  test(`escaping work ${primary === null ? 'null' : 'Error'} survives eligible pruning failure`, async () => {
    let pruned = 0;
    const worker = createLibraryDiscoveryWorker(callbacks({ dispatchDiscoveryRequests: async () => { throw new Error('dispatch'); },
      markRunFailed: async () => { throw primary; }, pruneOldRuns: async () => { pruned++; throw new Error('pruning fallout'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'discovery' }); await assert.rejects(completion, error => error === primary);
    await assert.rejects(worker.close(), error => error === primary); assert.equal(pruned, 1);
  });
}

test('pause/cancellation retain eligible pruning and refused marks skip it', async () => {
  for (const mode of ['cancel_ok', 'pause_ok', 'cancel_false', 'pause_false', 'failed_false']) {
    let pruned = 0; let released;
    const worker = createLibraryDiscoveryWorker(callbacks({
      isCancellationRequested: async () => mode.startsWith('cancel') ? true : mode.startsWith('pause')
        ? { kind: 'paused', pauseCode: 'controlled', pauseMessage: 'controlled' } : false,
      markRunCancelled: async () => mode === 'cancel_ok', markRunPaused: async () => mode === 'pause_ok', markRunFailed: async () => false,
      dispatchDiscoveryRequests: async () => { throw new Error('dispatch'); },
      releaseLease: async input => { released = input; }, pruneOldRuns: async () => { pruned++; },
    }));
    await (await worker.startWorkerRun({ runId: 'discovery' })).completion; await worker.close();
    assert.equal(pruned, mode.endsWith('ok') ? 1 : 0);
    assert.equal(released.status, mode === 'cancel_ok' ? 'cancelled' : mode === 'pause_ok' ? 'paused' : 'failed');
  }
});
