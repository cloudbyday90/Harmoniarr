/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createMetadataArtistRefreshWorker } from '../../src/server/metadata/metadata-artist-refresh-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const run = { runId: 'refresh', metadataArtistId: 'artist', musicBrainzArtistId: 'mb-artist', artistName: 'Artist' };
const lease = () => createOperationRunLeaseFixture({ runId: run.runId, jobType: 'metadata_artist_refresh' });
const result = { refreshedAt: '2026-10-12T00:00:00.000Z', releaseGroupCount: 2, wantedReconciliationCompleted: true };
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), isCancellationRequested: async () => false,
    markRunStarted: async () => true, markRunCompleted: async () => true, markRunFailed: async () => true,
    markRunCancelled: async () => true, markRunPaused: async () => true,
    refreshMetadataArtist: async () => result, releaseLease: async () => {}, ...overrides };
}

test('metadata refresh coalesces duplicate admission through held release and shares completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createMetadataArtistRefreshWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun(run); await entered.promise; let second;
  try { second = await worker.startWorkerRun(run); await flush(); assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion); }
  finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued handler completion retains provider and scheduling work with captured lease context', async () => {
  const provider = Promise.withResolvers(); const providerEntered = Promise.withResolvers();
  const schedule = Promise.withResolvers(); const scheduleEntered = Promise.withResolvers();
  let input; let scheduled; let completed; let released = false; let settled = false;
  const nextRefreshAt = '2026-10-13T00:00:00.000Z';
  const detailed = { ...result, detectedReleaseGroupCount: 1, materializedEligibleReleaseGroupCount: 2,
    materializedImportedReleaseCount: 3, materializedSkippedExistingCanonicalCount: 4, materializedSkippedExistingReleaseCount: 5,
    materializedSkippedNoCandidateCount: 6, operatorReconciliationQueuedCount: 7, operatorReconciliationSkippedNotReadyCount: 8 };
  const worker = createMetadataArtistRefreshWorker(callbacks({ refreshMetadataArtist: async value => {
    input = value; providerEntered.resolve(); await provider.promise; return detailed;
  }, recordArtistRefreshCompleted: async value => { scheduled = value; scheduleEntered.resolve(); await schedule.promise; return { nextRefreshAt }; },
  markRunCompleted: async value => { completed = value; return true; }, releaseLease: async () => { released = true; } }));
  const handlers = createOperationQueueHandlers({ metadataModule: { metadataArtistRefreshWorker: worker } });
  const accepted = await handlers.metadata_artist_refresh({ run: { id: run.runId, summary: run } });
  const closing = worker.close(); assert.equal(worker.close(), closing); void closing.then(() => { settled = true; }); await providerEntered.promise;
  try {
    assert.equal(typeof accepted.completion.then, 'function'); assert.equal(completed, undefined); assert.equal(scheduled, undefined);
    assert.deepEqual(input.workerContext, { operationType: 'metadata_artist_refresh', runId: run.runId, expectedLease: lease() });
    assert.equal(input.metadataArtistId, run.metadataArtistId); assert.equal(input.musicBrainzArtistId, run.musicBrainzArtistId);
    assert.equal(input.runId, run.runId); assert.equal(input.triggerSource, 'manual'); await input.throwIfCancelled();
    await assert.rejects(worker.startWorkerRun({ ...run, runId: 'late' }), { code: 'worker_closing' }); provider.resolve(); await scheduleEntered.promise;
    assert.deepEqual(scheduled, { metadataArtistId: run.metadataArtistId, refreshedAt: result.refreshedAt });
    await flush(); assert.equal(settled, false); assert.equal(released, false); assert.equal(completed, undefined);
  } finally { provider.resolve(); schedule.resolve(); await accepted.completion; await closing; }
  assert.equal(released, true); assert.equal(completed.summary.nextRefreshAt, nextRefreshAt);
  for (const field of Object.keys(detailed)) assert.equal(completed.summary[field], detailed[field]);
  assert.deepEqual(completed.expectedLease, lease());
});

for (const primary of [new Error('acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} remains observable without unowned writes`, async () => {
    const worker = createMetadataArtistRefreshWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });
  test(`failed persistence ${primary === null ? 'null' : 'Error'} wins over renewal and release fallout`, async () => {
    let released = false;
    const worker = createMetadataArtistRefreshWorker(callbacks({ refreshMetadataArtist: async () => { throw new Error('provider'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal'); } }),
      releaseLease: async () => { released = true; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(released, true);
  });
  test(`renewal ${primary === null ? 'null' : 'Error'} still attempts captured release`, async () => {
    let released;
    const worker = createMetadataArtistRefreshWorker(callbacks({ renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
      releaseLease: async value => { released = value; throw new Error('release'); } }));
    const { completion } = await worker.startWorkerRun(run);
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'completed' });
  });
  test(`release ${primary === null ? 'null' : 'Error'} rejects completion and canonical close`, async () => {
    const worker = createMetadataArtistRefreshWorker(callbacks({ releaseLease: async () => { throw primary; } }));
    const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); void closing.catch(() => {});
    assert.equal(worker.close(), closing); await assert.rejects(completion, error => error === primary);
    await assert.rejects(closing, error => error === primary);
  });
}

test('expected empty/unavailable/lost acquisition authorizes no writes or release', async () => {
  for (const code of [null, 'operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createMetadataArtistRefreshWorker(callbacks({ acquireLease: async () => {
      if (!code) return null; throw Object.assign(new Error('expected'), { code });
    }, markRunFailed: async () => assert.fail('no owned lease'), releaseLease: async () => assert.fail('no owned lease') }));
    await (await worker.startWorkerRun(run)).completion; await worker.close();
  }
});

test('null domain failure persists a fixed message and failed release', async () => {
  let message; let status;
  const worker = createMetadataArtistRefreshWorker(callbacks({ refreshMetadataArtist: async () => { throw null; },
    markRunFailed: async value => { message = value.errorMessage; return true; }, releaseLease: async value => { status = value.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close();
  assert.equal(message, 'Metadata artist refresh failed'); assert.equal(status, 'failed');
});

test('actual admitted renewal settles before captured release and close', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let released = false;
  const worker = createMetadataArtistRefreshWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
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
    let status; let refreshed = false;
    const worker = createMetadataArtistRefreshWorker(callbacks({ [mark]: async () => false,
      refreshMetadataArtist: async () => { refreshed = true; if (mark === 'markRunFailed') throw new Error('provider'); return result; },
      isCancellationRequested: async () => mark === 'markRunPaused' ? { kind: 'paused' } : mark === 'markRunCancelled',
      releaseLease: async value => { status = value.status; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(status, 'failed');
    assert.equal(refreshed, mark === 'markRunCompleted' || mark === 'markRunFailed');
  }
});

test('lost authority suppresses failure persistence while acquired unavailable remains a domain failure', async () => {
  for (const code of ['operation_run_lease_lost', 'operation_run_lease_unavailable']) {
    let failed = false; let released;
    const worker = createMetadataArtistRefreshWorker(callbacks({ refreshMetadataArtist: async () => { throw Object.assign(new Error('dependency'), { code }); },
      markRunFailed: async () => { failed = true; return true; }, releaseLease: async value => { released = value; } }));
    await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(failed, code !== 'operation_run_lease_lost');
    assert.deepEqual(released, { runId: run.runId, expectedLease: lease(), status: 'failed' });
  }
});

test('captured cancellation hook stops refresh before scheduling when its dependency checks it', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let cancelled = false; let status;
  const worker = createMetadataArtistRefreshWorker(callbacks({ isCancellationRequested: async () => cancelled,
    refreshMetadataArtist: async input => { entered.resolve(); await gate.promise; await input.throwIfCancelled(); return result; },
    recordArtistRefreshCompleted: async () => assert.fail('cancelled refresh must not schedule'), releaseLease: async value => { status = value.status; } }));
  const { completion } = await worker.startWorkerRun(run); const closing = worker.close(); await entered.promise;
  try { cancelled = true; }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(status, 'cancelled');
});

test('nullable unmonitored schedule retains null nextRefreshAt', async () => {
  let summary;
  const worker = createMetadataArtistRefreshWorker(callbacks({ recordArtistRefreshCompleted: async () => null,
    markRunCompleted: async value => { summary = value.summary; return true; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(summary.nextRefreshAt, null);
});

test('schedule persistence failure stays an ordinary failed domain outcome', async () => {
  let failed; let status;
  const worker = createMetadataArtistRefreshWorker(callbacks({ recordArtistRefreshCompleted: async () => { throw new Error('schedule persistence'); },
    markRunFailed: async value => { failed = value; return true; }, releaseLease: async value => { status = value.status; } }));
  await (await worker.startWorkerRun(run)).completion; await worker.close(); assert.equal(failed.errorMessage, 'schedule persistence'); assert.equal(status, 'failed');
});
