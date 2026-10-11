/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const lease = () => createOperationRunLeaseFixture({ runId: 'inspection', jobType: 'import_candidate_media_inspection' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('inspection coalesces a duplicate through held release with shared actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun({ runId: 'inspection', requestedCandidateCount: 0 }); await entered.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'inspection', requestedCandidateCount: 0 }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued inspection acceptance propagates through its handler while close seals admission', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let completed = false;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ markRunStarted: async () => { entered.resolve(); await gate.promise; return true; },
    markRunCompleted: async () => { completed = true; return true; } }));
  const handlers = createOperationQueueHandlers({ importCandidateModule: { importCandidateMediaInspectionWorker: worker } });
  const accepted = await handlers.import_candidate_media_inspection({ run: { id: 'inspection', summary: { requestedCandidateCount: 0 } } });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(completed, false); assert.equal(typeof accepted.completion.then, 'function');
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(completed, true);
});

for (const primary of [new Error('inspection acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes with no unowned release`, async () => {
    const worker = createImportCandidateMediaInspectionWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('Unowned failure must not update a run'),
      releaseLease: async () => assert.fail('Unowned acquisition must not release'),
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'inspection' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });

  test(`failed inspection persistence ${primary === null ? 'null' : 'Error'} survives renewal/release fallout`, async () => {
    let releases = 0;
    const worker = createImportCandidateMediaInspectionWorker(callbacks({
      buildSelectedImportCandidateSummary: async () => { throw new Error('inspection input'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('release fallout'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'inspection' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(releases, 1);
  });
}

test('expected lease refusal/loss keeps domain and release policy', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createImportCandidateMediaInspectionWorker(callbacks({ acquireLease: async () => { throw Object.assign(new Error('expected lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('No acquired lease may be marked failed'),
      releaseLease: async () => assert.fail('No acquired lease may be released'),
    }));
    await (await worker.startWorkerRun({ runId: 'inspection' })).completion; await worker.close();
  }
});

test('null inspection failure is persisted with its fixed fallback message', async () => {
  let message;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ buildSelectedImportCandidateSummary: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  await (await worker.startWorkerRun({ runId: 'inspection' })).completion; await worker.close();
  assert.equal(message, 'Media inspection failed');
});

test('lease-coded failure after acquisition retains the owning domain outcome and captured release', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    let failed; let released;
    const worker = createImportCandidateMediaInspectionWorker(callbacks({ buildSelectedImportCandidateSummary: async () => {
      throw Object.assign(new Error('inspection dependency lease outcome'), { code });
    }, markRunFailed: async input => { failed = input; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun({ runId: 'inspection' })).completion; await worker.close();
    assert.deepEqual(released.expectedLease, lease());
    if (code === 'operation_run_lease_lost') { assert.equal(failed, undefined); assert.equal(released.status, 'completed'); }
    else { assert.equal(failed.errorMessage, 'inspection dependency lease outcome'); assert.equal(released.status, 'failed'); }
  }
});

test('inspection waits for actual admitted renewal before releasing the captured lease', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'inspection' }); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('renewal drain failure still attempts lease release and remains primary', async () => {
  const primary = new Error('renewal drain'); let released = false;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ renewLease: async () => true,
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
    releaseLease: async () => { released = true; throw new Error('release fallout'); },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'inspection' });
  await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});

test('normal media-command close flows through real inspection/preview before best-effort Activity drains', { timeout: 10000 }, async t => {
  const spawned = Promise.withResolvers(); const activityEntered = Promise.withResolvers(); const activityGate = Promise.withResolvers();
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.pid = 123; child.exitCode = null; child.signalCode = null; child.kill = () => assert.fail('Controlled command must close without forced termination');
  const command = createMediaCommandService({ allowedBinaries: ['ffprobe'], spawnFn: (binary, args, options) => {
    assert.equal(binary, 'ffprobe'); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(args.at(-1), '/owned/source.flac'); spawned.resolve(); return child;
  } });
  const inspection = createMediaInspectionService({ ffprobeBin: 'ffprobe', mediaCommandService: command });
  const preview = createImportCandidateApplyPreviewService({ mediaInspectionService: inspection,
    previewImportCandidate: async () => ({ naming: { filePreviews: [{ fileId: 'file', filename: 'source.flac', sourcePath: '/owned/source.flac' }] } }),
    statFn: async () => ({ isDirectory: () => false, size: 12 }),
  });
  let completed; let released = false;
  const worker = createImportCandidateMediaInspectionWorker(callbacks({
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'candidate', executionStatus: { code: 'ready' } }] }),
    previewImportCandidateApply: preview.previewImportCandidateApply,
    markRunCompleted: async input => { completed = input; return true; }, releaseLease: async () => { released = true; },
    recordActivityEventFn: async () => { activityEntered.resolve(); await activityGate.promise; throw null; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'inspection', requestedCandidateCount: 1 }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: spawned.promise, operation: completion, signal: t.signal });
    child.stdout.write(JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'flac' }], format: {} }));
    child.exitCode = 0; child.emit('exit', 0, null); await flush();
    assert.equal(completed, undefined); assert.equal(released, false);
    child.stdout.end(); child.stderr.end(); child.emit('close', 0, null);
    await waitForFixtureReady({ ready: activityEntered.promise, operation: completion, signal: t.signal }); await flush();
    assert.equal(completed.summary.inspectedFileCount, 1); assert.equal(released, false);
    activityGate.resolve(); await completion; await closing; assert.equal(released, true);
  } finally { child.emit('close', 0, null); activityGate.resolve(); await completion; await closing; }
});

test('failed inspection lease release rejects actual completion and canonical close', async () => {
  const primary = new Error('inspection release');
  const worker = createImportCandidateMediaInspectionWorker(callbacks({ releaseLease: async () => { throw primary; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'inspection' }); await assert.rejects(completion, error => error === primary);
  const closing = worker.close(); assert.equal(worker.close(), closing); await assert.rejects(closing, error => error === primary);
});
