import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createTestJobLease } from '../../testing/server/job-lease-fixtures.js';

const flush = () => new Promise(resolve => { setImmediate(resolve); });

for (const kind of ['inspection', 'preflight']) for (const paused of [false, true]) {
  test(`${kind} ${paused ? 'pause' : 'cancellation'} owns active native close and captured lease release`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let interrupted = false; let supplied; let terminal; let released; let closed = false;
    const entered = Promise.withResolvers(); const releaseGate = Promise.withResolvers(); const releasing = Promise.withResolvers();
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), pid: 4321, exitCode: null, signalCode: null });
    let kills = 0; child.kill = () => { kills++; return true; };
    const command = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe'], spawnFn: () => { entered.resolve(); return child; } });
    const inspection = createMediaInspectionService({ mediaCommandService: command });
    const encoder = createMediaTranscodeExecutionService({ mediaCommandService: command });
    const captured = createTestJobLease(kind === 'inspection' ? 'import_candidate_media_inspection' : 'import_candidate_transcode_orchestration', 'owned');
    const options = {
      acquireLease: async () => captured, markRunStarted: async () => true,
      isCancellationRequested: async () => interrupted ? (paused ? { kind: 'paused', pauseCode: 'maintenance' } : true) : false,
      buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'fixture', executionStatus: { code: 'ready' } }] }),
      markRunCompleted: async () => assert.fail('Interrupted work must not complete'), markRunFailed: async () => assert.fail('Interruption is not a normal failure'),
      markRunCancelled: async input => { assert.equal(closed, true); terminal = input; },
      markRunPaused: async input => { assert.equal(closed, true); terminal = input; },
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
      await entered.promise; interrupted = true; t.mock.timers.tick(1000); await flush();
      assert.ok(supplied instanceof AbortSignal); assert.equal(kills, 1); assert.equal(terminal, undefined); assert.equal(released, undefined); assert.equal(settled, false);
      assert.equal(command.getAdmissionState().active, 1); child.emit('exit', null, 'SIGTERM'); await flush(); assert.equal(terminal, undefined);
      closed = true; child.signalCode = 'SIGTERM'; child.emit('close', null, 'SIGTERM'); await releasing.promise;
      assert.equal(settled, false); assert.equal(terminal.runId, 'owned'); assert.equal(released, undefined);
      if (paused) assert.equal(terminal.summary.pauseCode, 'maintenance');
      releaseGate.resolve(); await completion; await closing;
      assert.equal(released.status, paused ? 'paused' : 'cancelled'); assert.deepEqual(released.expectedLease, captured);
      assert.deepEqual(command.getAdmissionState(), { active: 0, queued: 0 });
    } finally { closed = true; child.emit('close', null, 'SIGTERM'); releaseGate.resolve(); await Promise.allSettled([completion, closing]); }
  });
}
