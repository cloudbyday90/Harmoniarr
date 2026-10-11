/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplyWorker } from '../../src/server/import-candidates/import-candidate-apply-worker.js';
import { createTestJobLease } from '../../testing/server/job-lease-fixtures.js';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';

test('apply worker coalesces its run until the final lease release actually settles', { timeout: 10_000 }, async (t) => {
  const gate = createFixtureGate({ signal: t.signal });
  const entered = Promise.withResolvers();
  const releases = [];
  let acquisitions = 0;
  const worker = createImportCandidateApplyWorker({
    acquireLease: async ({ runId }) => { acquisitions += 1; return createTestJobLease('import_candidate_apply', runId); },
    markRunStarted: async () => false,
    releaseLease: () => {
      const pending = gate.promise.then(() => {});
      releases.push(pending);
      entered.resolve();
      return pending;
    },
  });
  try {
    const first = await worker.startWorkerRun({ runId: 'held-release' });
    await entered.promise;
    const duplicate = await worker.startWorkerRun({ runId: 'held-release' });
    assert.strictEqual(duplicate.completion, first.completion);
    assert.equal(acquisitions, 1);
  } finally {
    gate.release();
    await Promise.all(releases);
    await worker.close?.();
  }
});

for (const failure of [new Error('acquisition failed'), null]) {
  test(`apply acquisition ${failure === null ? 'null' : 'Error'} settles owned completion before cleanup`, async () => {
    const worker = createImportCandidateApplyWorker({ acquireLease: async () => { throw failure; } });
    await worker.startWorkerRun({ runId: 'failed-start' });
    await assert.rejects(worker.close(), error => error === failure);
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  });
}

test('apply completion drains held renewal work before releasing its captured lease', { timeout: 10_000 }, async (t) => {
  const gate = createFixtureGate({ signal: t.signal });
  const entered = Promise.withResolvers();
  let released = false;
  const worker = createImportCandidateApplyWorker({
    acquireLease: async ({ runId }) => createTestJobLease('import_candidate_apply', runId),
    renewLease: async () => { entered.resolve(); await gate.promise; },
    markRunStarted: async () => false,
    releaseLease: async () => { released = true; },
  });
  await worker.startWorkerRun({ runId: 'held-renewal' });
  const closing = worker.close();
  try {
    await entered.promise;
    assert.equal(released, false);
  } finally { gate.release(); await closing; }
  assert.equal(released, true);
});

test('apply completion owns advisory callbacks beyond persisted terminal status', { timeout: 10_000 }, async (t) => {
  const gate = createFixtureGate({ signal: t.signal });
  const completed = Promise.withResolvers();
  const advisoryKinds = new Set();
  let released = false;
  const advisory = kind => async () => { advisoryKinds.add(kind); await gate.promise; };
  const worker = createImportCandidateApplyWorker({
    acquireLease: async ({ runId }) => createTestJobLease('import_candidate_apply', runId),
    markRunStarted: async () => {},
    markRunCompleted: async () => { completed.resolve(); },
    markRunFailed: async () => assert.fail('Advisory work must not fail the domain run'),
    releaseLease: async () => { released = true; },
    buildImportPendingCandidateSummary: async () => ({ counts: { totalImportPending: 1, ready: 1 },
      importPendingCandidates: [{ id: 'candidate', username: 'fixture', folderPath: 'Fixture', planning: {},
        importStatus: { code: 'ready', message: 'Ready' }, requestOwnership: { sourceRequestedForUserId: 'fixture-user' } }] }),
    applyImportCandidatePreview: async () => ({ summary: { appliedFileCount: 1, failedFileCount: 0, totalFiles: 1 } }),
    enqueueSpectralAnalysisFn: advisory('spectral'),
    sendFulfillmentNotificationFn: advisory('notification'),
    onReleaseAddedFn: advisory('release'),
    recordActivityEventFn: advisory('activity'),
  });
  await worker.startWorkerRun({ runId: 'held-advisory' });
  const closing = worker.close();
  try {
    await completed.promise;
    assert.deepEqual([...advisoryKinds].sort(), ['activity', 'notification', 'release', 'spectral']);
    assert.equal(released, false);
  } finally { gate.release(); await closing; }
  assert.equal(released, true);
});

test('an escaping worker error wins over heartbeat and lease cleanup failures, and release is attempted', async () => {
  const primary = new Error('unrecorded run failure');
  let released = false;
  const worker = createImportCandidateApplyWorker({
    acquireLease: async ({ runId }) => createTestJobLease('import_candidate_apply', runId),
    renewLease: async () => {},
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw null; } }),
    markRunStarted: async () => { throw new Error('run failed'); },
    markRunFailed: async () => { throw primary; },
    releaseLease: async () => { released = true; throw new Error('lease cleanup failed'); },
  });
  await worker.startWorkerRun({ runId: 'failed-cleanup' });
  await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});
