/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });
const lease = () => createOperationRunLeaseFixture({ runId: 'transcode', jobType: 'import_candidate_transcode' });
function callbacks(overrides = {}) {
  return { acquireLease: async () => lease(), markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true,
    releaseLease: async () => {}, ...overrides };
}

test('transcode coalesces a duplicate through held release with shared actual completion', async () => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let acquisitions = 0;
  const worker = createImportCandidateTranscodeWorker(callbacks({ acquireLease: async () => { acquisitions++; return lease(); },
    releaseLease: async () => { entered.resolve(); await gate.promise; } }));
  const first = await worker.startWorkerRun({ runId: 'transcode', requestedCandidateCount: 0 }); await entered.promise;
  let second;
  try {
    second = await worker.startWorkerRun({ runId: 'transcode', requestedCandidateCount: 0 }); await flush();
    assert.equal(acquisitions, 1); assert.equal(first.completion, second.completion);
  } finally { gate.resolve(); await first?.completion; await second?.completion; }
  await worker.close();
});

test('queued transcode acceptance propagates through its handler while close seals admission', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let completed = false;
  const worker = createImportCandidateTranscodeWorker(callbacks({ markRunStarted: async () => { entered.resolve(); await gate.promise; return true; },
    markRunCompleted: async () => { completed = true; return true; } }));
  const handlers = createOperationQueueHandlers({ importCandidateModule: { importCandidateTranscodeWorker: worker } });
  const accepted = await handlers.import_candidate_transcode_orchestration({ run: { id: 'transcode', summary: { requestedCandidateCount: 0 } } });
  const closing = worker.close(); assert.equal(worker.close(), closing); await entered.promise;
  try {
    assert.equal(completed, false); assert.equal(typeof accepted.completion.then, 'function');
    await assert.rejects(worker.startWorkerRun({ runId: 'late' }), { code: 'worker_closing' });
  } finally { gate.resolve(); await accepted.completion; await closing; }
  assert.equal(completed, true);
});

for (const primary of [new Error('transcode acquisition'), null]) {
  test(`unexpected acquisition ${primary === null ? 'null' : 'Error'} escapes with no unowned release`, async () => {
    const worker = createImportCandidateTranscodeWorker(callbacks({ acquireLease: async () => { throw primary; },
      markRunFailed: async () => assert.fail('Unowned failure must not update a run'),
      releaseLease: async () => assert.fail('Unowned acquisition must not release'),
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'transcode' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  });

  test(`failed transcode persistence ${primary === null ? 'null' : 'Error'} survives renewal/release fallout`, async () => {
    let releases = 0;
    const worker = createImportCandidateTranscodeWorker(callbacks({
      buildSelectedImportCandidateSummary: async () => { throw new Error('transcode input'); },
      markRunFailed: async () => { throw primary; }, renewLease: async () => true,
      createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw new Error('renewal drain'); } }),
      releaseLease: async () => { releases++; throw new Error('release fallout'); },
    }));
    const { completion } = await worker.startWorkerRun({ runId: 'transcode' });
    await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
    assert.equal(releases, 1);
  });
}

test('expected lease refusal/loss keeps domain and release policy', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    const worker = createImportCandidateTranscodeWorker(callbacks({ acquireLease: async () => { throw Object.assign(new Error('expected lease outcome'), { code }); },
      markRunFailed: async () => assert.fail('No acquired lease may be marked failed'),
      releaseLease: async () => assert.fail('No acquired lease may be released'),
    }));
    await (await worker.startWorkerRun({ runId: 'transcode' })).completion; await worker.close();
  }
});

test('null transcode failure is persisted with its fixed fallback message', async () => {
  let message;
  const worker = createImportCandidateTranscodeWorker(callbacks({ buildSelectedImportCandidateSummary: async () => { throw null; },
    markRunFailed: async input => { message = input.errorMessage; return true; } }));
  await (await worker.startWorkerRun({ runId: 'transcode' })).completion; await worker.close();
  assert.equal(message, 'Transcode orchestration failed');
});

test('lease-coded failure after acquisition retains the owning domain outcome and captured release', async () => {
  for (const code of ['operation_run_lease_unavailable', 'operation_run_lease_lost']) {
    let failed; let released;
    const worker = createImportCandidateTranscodeWorker(callbacks({ buildSelectedImportCandidateSummary: async () => {
      throw Object.assign(new Error('transcode dependency lease outcome'), { code });
    }, markRunFailed: async input => { failed = input; return true; }, releaseLease: async input => { released = input; } }));
    await (await worker.startWorkerRun({ runId: 'transcode' })).completion; await worker.close();
    assert.deepEqual(released.expectedLease, lease());
    if (code === 'operation_run_lease_lost') { assert.equal(failed, undefined); assert.equal(released.status, 'completed'); }
    else { assert.equal(failed.errorMessage, 'transcode dependency lease outcome'); assert.equal(released.status, 'failed'); }
  }
});

test('transcode waits for actual admitted renewal before releasing the captured lease', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); let released = false;
  const worker = createImportCandidateTranscodeWorker(callbacks({ renewLease: async () => { entered.resolve(); await gate.promise; return true; },
    createOperationRunLeaseHeartbeatFn: options => createOperationRunLeaseHeartbeat({ ...options,
      createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() { void onTick(); }, stop() {}, tick: onTick }) }),
    releaseLease: async input => { assert.deepEqual(input.expectedLease, lease()); released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'transcode' }); const closing = worker.close(); await entered.promise;
  try { await flush(); assert.equal(released, false); }
  finally { gate.resolve(); await completion; await closing; }
  assert.equal(released, true);
});

test('renewal drain failure still attempts lease release and remains primary', async () => {
  const primary = new Error('renewal drain'); let released = false;
  const worker = createImportCandidateTranscodeWorker(callbacks({ renewLease: async () => true,
    createOperationRunLeaseHeartbeatFn: () => ({ start() {}, stopAndDrain: async () => { throw primary; } }),
    releaseLease: async () => { released = true; throw new Error('release fallout'); },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'transcode' });
  await assert.rejects(completion, error => error === primary); await assert.rejects(worker.close(), error => error === primary);
  assert.equal(released, true);
});

test('normal preflight owns command/stdout closure and preserves null output arguments', { timeout: 10000 }, async t => {
  const spawned = Promise.withResolvers();
  const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.pid = 123; child.exitCode = null; child.signalCode = null; child.kill = () => assert.fail('Controlled command must close normally');
  const command = createMediaCommandService({ allowedBinaries: ['ffmpeg'], spawnFn: (binary, args, options) => {
    assert.equal(binary, 'ffmpeg'); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(args[args.indexOf('-i') + 1], '/owned/source.mp3'); assert.deepEqual(args.slice(-3), ['-f', 'null', '-']);
    spawned.resolve(); return child;
  } });
  const preflight = createMediaTranscodeExecutionService({ ffmpegBin: 'ffmpeg', mediaCommandService: command });
  let completed; let released = false;
  const worker = createImportCandidateTranscodeWorker(callbacks({
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'candidate', executionStatus: { code: 'ready' } }] }),
    previewImportCandidateApply: async () => ({ files: [{ sourceFile: { path: '/owned/source.mp3' },
      transcodePlan: { recommendedAction: 'transcode_candidate', target: { audioCodec: 'opus' } } }] }),
    executeTranscodeCandidate: preflight.executeCandidate,
    markRunCompleted: async input => { completed = input; return true; }, releaseLease: async () => { released = true; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'transcode', requestedCandidateCount: 1 }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: spawned.promise, operation: completion, signal: t.signal });
    child.exitCode = 0; child.emit('exit', 0, null); await flush();
    assert.equal(completed, undefined); assert.equal(released, false);
    child.stdout.end(); child.stderr.end(); child.emit('close', 0, null); await completion; await closing;
    assert.equal(completed.summary.passedPreflightCount, 1); assert.equal(completed.summary.failedPreflightCount, 0);
    assert.equal(released, true);
  } finally { child.emit('close', 0, null); await completion; await closing; }
});

test('admitted preview drains before cooperative cancellation refuses per-file preflight', { timeout: 10000 }, async t => {
  const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let cancelled = false; let marked; let released;
  const worker = createImportCandidateTranscodeWorker(callbacks({
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'candidate', executionStatus: { code: 'ready' } }] }),
    previewImportCandidateApply: async () => { entered.resolve(); await gate.promise; return { files: [{
      sourceFile: { path: '/owned/source.mp3' }, transcodePlan: { recommendedAction: 'transcode_candidate' },
    }] }; },
    isCancellationRequested: async () => cancelled,
    executeTranscodeCandidate: async () => assert.fail('Cancelled preview must not admit file preflight'),
    markRunCancelled: async input => { marked = input; return true; }, releaseLease: async input => { released = input; },
  }));
  const { completion } = await worker.startWorkerRun({ runId: 'transcode', requestedCandidateCount: 1 }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: completion, signal: t.signal }); cancelled = true;
    assert.equal(marked, undefined); assert.equal(released, undefined);
  } finally { gate.resolve(); await completion; await closing; }
  assert.equal(marked.summary.currentStep, 'Transcode orchestration cancelled'); assert.equal(released.status, 'cancelled');
});

test('failed transcode lease release rejects actual completion and canonical close', async () => {
  const primary = new Error('transcode release');
  const worker = createImportCandidateTranscodeWorker(callbacks({ releaseLease: async () => { throw primary; } }));
  const { completion } = await worker.startWorkerRun({ runId: 'transcode' }); await assert.rejects(completion, error => error === primary);
  const closing = worker.close(); assert.equal(worker.close(), closing); await assert.rejects(closing, error => error === primary);
});
