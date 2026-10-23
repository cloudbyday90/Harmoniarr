import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createTestJobLease } from '../../testing/server/job-lease-fixtures.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });

for (const kind of ['inspection', 'preflight']) for (const failure of ['lost', 'error', 'null']) {
  test(`${kind} heartbeat ${failure} retains native close and captured cleanup`, async () => {
    let heartbeat; let supplied; let terminal; const reason = failure === 'null' ? null : new Error('renewal unavailable'); let released; let closed = false;
    const entered = Promise.withResolvers(); const releaseGate = Promise.withResolvers(); const releasing = Promise.withResolvers();
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), pid: 4321, exitCode: null, signalCode: null });
    let kills = 0; child.kill = () => { kills++; return true; };
    const command = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe'], spawnFn: () => { entered.resolve(); return child; } });
    const inspection = createMediaInspectionService({ mediaCommandService: command });
    const encoder = createMediaTranscodeExecutionService({ mediaCommandService: command });
    const captured = createTestJobLease(kind === 'inspection' ? 'import_candidate_media_inspection' : 'import_candidate_transcode_orchestration', 'owned');
    const options = {
      acquireLease: async () => captured, markRunStarted: async () => true,
      isCancellationRequested: async () => false,
      renewLease: async () => { if (failure === 'lost') return null; throw reason; },
      createOperationRunLeaseHeartbeatFn: input => {
        heartbeat = createOperationRunLeaseHeartbeat({ ...input,
          createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() {}, stop() {}, tick: onTick }) });
        return heartbeat;
      },
      buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'fixture', executionStatus: { code: 'ready' } }] }),
      markRunCompleted: async () => assert.fail('Interrupted work must not complete'), markRunFailed: async input => { assert.notEqual(failure, 'lost'); assert.equal(closed, true); terminal = input; },
      markRunCancelled: async () => assert.fail('Lease failure is not cancellation'),
      markRunPaused: async () => assert.fail('Lease failure is not pause'),
      releaseLease: async input => { releasing.resolve(); await releaseGate.promise; released = input; },
      previewImportCandidateApply: async ({ signal }) => {
        supplied = signal;
        if (kind === 'inspection') return { files: [{ inspection: await inspection.inspectSourceFile({ sourcePath: '/fixture/owned.wav', signal }) }] };
        return { files: [{ sourceFile: { path: '/fixture/owned.wav' }, transcodePlan: { recommendedAction: 'transcode_candidate' } }] };
      }, executeTranscodeCandidate: encoder.executeCandidate,
    };
    const worker = kind === 'inspection' ? createImportCandidateMediaInspectionWorker(options) : createImportCandidateTranscodeWorker(options);
    const { completion } = await worker.startWorkerRun({ runId: 'owned' }); const closing = worker.close(); let settled = false;
    void completion.then(() => { settled = true; });
    try {
      await entered.promise; assert.deepEqual(await heartbeat.tick(), { skipped: true, reason: failure === 'lost' ? 'lease_lost' : 'error' }); await flush();
      assert.ok(supplied instanceof AbortSignal); assert.equal(kills, 1); assert.equal(terminal, undefined); assert.equal(released, undefined); assert.equal(settled, false);
      assert.equal(command.getAdmissionState().active, 1); child.emit('exit', null, 'SIGTERM'); await flush(); assert.equal(terminal, undefined);
      closed = true; child.signalCode = 'SIGTERM'; child.emit('close', null, 'SIGTERM'); await releasing.promise;
      assert.equal(settled, false); if (failure === 'lost') assert.equal(terminal, undefined); else assert.equal(terminal.runId, 'owned'); assert.equal(released, undefined);
      releaseGate.resolve(); await completion; await closing;
      assert.equal(released.status, 'failed'); assert.deepEqual(released.expectedLease, captured);
      assert.deepEqual(command.getAdmissionState(), { active: 0, queued: 0 });
    } finally { closed = true; child.emit('close', null, 'SIGTERM'); releaseGate.resolve(); await Promise.allSettled([completion, closing]); }
  });
}

for (const kind of ['inspection', 'preflight']) {
  test(`${kind} refuses completion after lease loss during selected-candidate lookup`, async () => {
    const entered = Promise.withResolvers(); const gate = Promise.withResolvers(); let heartbeat; let released;
    const lease = createTestJobLease('media', 'owned');
    const options = { acquireLease: async () => lease, renewLease: async () => null, markRunStarted: async () => true,
      createOperationRunLeaseHeartbeatFn: input => {
        heartbeat = createOperationRunLeaseHeartbeat({ ...input,
          createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() {}, stop() {}, tick: onTick }) }); return heartbeat;
      },
      buildSelectedImportCandidateSummary: async () => { entered.resolve(); await gate.promise; return { selectedCandidates: [] }; },
      markRunCompleted: async () => assert.fail('Lost lease cannot complete'), markRunFailed: async () => assert.fail('Lost lease cannot fail the run'),
      releaseLease: async input => { released = input; },
    };
    const worker = kind === 'inspection' ? createImportCandidateMediaInspectionWorker(options) : createImportCandidateTranscodeWorker(options);
    const { completion } = await worker.startWorkerRun({ runId: 'owned' }); await entered.promise;
    try { await heartbeat.tick(); assert.equal(released, undefined); } finally { gate.resolve(); await completion; await worker.close(); }
    assert.deepEqual(released, { runId: 'owned', status: 'failed', expectedLease: lease });
  });
}
