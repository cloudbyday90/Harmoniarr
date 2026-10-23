import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createImportCandidateMediaInspectionRunStore } from '../../src/server/import-candidates/import-candidate-media-inspection-run-store.js';
import { createImportCandidateTranscodeRunStore } from '../../src/server/import-candidates/import-candidate-transcode-run-store.js';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaCommandAdmission } from '../../src/server/media/media-command-admission.js';
import { createMediaToolingStatusService } from '../../src/server/media/media-tooling-status-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { withOperationRunInterruption } from '../../src/server/worker-interruption-scope.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { withDeploymentMediaFixture } from '../../testing/server/deployment-media-fixture.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

await requireDeploymentMemoryProfile(); after(closePool);
const selected = async () => ({ selectedCandidates: [{ id: 'fixture', executionStatus: { code: 'ready' } }] });
async function claim(store, operationType) {
  const run = await store.createOperationRun({ requestedCandidateCount: 1, transcodeCandidateFileCount: 1 });
  assert.equal((await createOperationQueueStore().claimNextRunnableRun({ operationTypes: [operationType] })).id, run.id);
  return run.id;
}
async function assertCancelled(store, runId, leaseKey) {
  assert.equal((await store.getRunById(runId)).status, 'cancelled');
  const lease = (await getPool().query('SELECT released_at, status FROM job_leases WHERE lease_key = $1', [leaseKey])).rows[0];
  assert.ok(lease.released_at); assert.equal(lease.status, 'cancelled');
}

test('durable readiness cancellation retains a real Linux child and active lease until acknowledged close', { timeout: 40_000 }, async t => {
  const pool = getPool(); const store = createImportCandidateMediaInspectionRunStore();
  const runId = await claim(store, 'import_candidate_media_inspection'); const ready = Promise.withResolvers(); const terminating = Promise.withResolvers();
  const closed = Promise.withResolvers(); let child; let retired = false;
  const command = createMediaCommandService({ allowedBinaries: [process.execPath], admission: createMediaCommandAdmission({ concurrency: 1 }), defaultTimeoutMs: 15_000,
    spawnFn: (_binary, _args, options) => {
      assert.equal(child, undefined, 'Queued second tooling check must never spawn after cancellation');
      child = spawn(process.execPath, ['--input-type=module', '-e',
        "process.on('SIGTERM', () => process.send('terminating')); process.on('message', () => process.disconnect()); process.send('ready');"],
      { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      child.on('message', message => { if (message === 'ready') ready.resolve(); if (message === 'terminating') terminating.resolve(); });
      child.once('close', () => { retired = true; closed.resolve(); }); return child;
    } });
  const tooling = createMediaToolingStatusService({ mediaCommandService: command, ffmpegBinary: process.execPath, ffprobeBinary: process.execPath });
  const inspection = createMediaInspectionService({ mediaCommandService: command, ffprobeBin: process.execPath, getMediaToolingStatus: tooling.getStatus });
  const worker = createImportCandidateMediaInspectionWorker({ ...store, buildSelectedImportCandidateSummary: selected,
    previewImportCandidateApply: async ({ signal }) => ({ files: [{ inspection: await inspection.inspectSourceFile({ sourcePath: '/fixture/source.flac', signal }) }] }) });
  const { completion } = await worker.startWorkerRun({ runId }); const closing = worker.close();
  try {
    await waitForFixtureReady({ ready: ready.promise, operation: completion, signal: t.signal });
    await createOperationRunControlService().requestOperationRunCancellation({ requestedByUserId: null, runId });
    await waitForFixtureReady({ ready: terminating.promise, operation: completion, signal: t.signal });
    assert.equal(retired, false); assert.equal((await store.getRunById(runId)).status, 'running');
    assert.equal((await pool.query('SELECT released_at FROM job_leases WHERE lease_key = $1', [`import_candidate_media_inspection:${runId}`])).rows[0].released_at, null);
    assert.deepEqual(command.getAdmissionState(), { active: 1, queued: 0 });
    child.send('finish'); await completion; await closing; await closed.promise;
    await assertCancelled(store, runId, `import_candidate_media_inspection:${runId}`);
    assert.deepEqual(command.getAdmissionState(), { active: 0, queued: 0 });
    t.diagnostic(JSON.stringify({ scenario: 'held-native-readiness-cancel', closeAcknowledged: true, cancelledRuns: 1, releasedLeases: 1, activeCommands: 0 }));
  } finally {
    if (child?.connected) child.send('finish');
    await Promise.allSettled([completion, closing, child ? closed.promise : undefined]);
  }
});

test('durable preflight cancellation stops actual FFmpeg encoding and preserves all source bytes', { timeout: 90_000 }, async t => {
  const result = await withDeploymentMediaFixture(async fixture => {
    const store = createImportCandidateTranscodeRunStore(); const runId = await claim(store, 'import_candidate_transcode_orchestration');
    const started = Promise.withResolvers(); const records = []; let killedEncoder = false;
    const command = createMediaCommandService({ allowedBinaries: ['ffmpeg', 'ffprobe'], spawnFn: (binary, args, options) => {
      const child = spawn(binary, args, options); const encoder = args.includes('-c:a');
      const record = { closed: false }; records.push(record);
      const kill = child.kill.bind(child); child.kill = signal => { if (encoder) killedEncoder = true; return kill(signal); };
      if (encoder) child.once('spawn', () => started.resolve()); child.once('close', () => { record.closed = true; }); return child;
    } });
    const tooling = createMediaToolingStatusService({ mediaCommandService: command });
    const encoding = createMediaTranscodeExecutionService({ mediaCommandService: command, ffmpegThreads: 2, getMediaToolingStatus: tooling.getStatus });
    const worker = createImportCandidateTranscodeWorker({ ...store, buildSelectedImportCandidateSummary: selected,
      // A short qualification interval ensures active codec interruption, not a production latency claim.
      withOperationRunInterruptionFn: (options, work) => withOperationRunInterruption({ ...options, pollIntervalMs: 25 }, work),
      previewImportCandidateApply: async () => ({ files: [{ sourceFile: { path: fixture.longSource }, transcodePlan: { recommendedAction: 'transcode_candidate', target: { audioCodec: 'opus' } } }] }),
      executeTranscodeCandidate: encoding.executeCandidate,
    });
    const { completion } = await worker.startWorkerRun({ runId }); const closing = worker.close();
    try {
      await waitForFixtureReady({ ready: started.promise, operation: completion, signal: t.signal });
      await createOperationRunControlService().requestOperationRunCancellation({ requestedByUserId: null, runId });
      await completion; await closing; assert.equal(killedEncoder, true); assert.ok(records.every(row => row.closed));
      await assertCancelled(store, runId, `import_candidate_transcode_orchestration:${runId}`);
      assert.deepEqual(command.getAdmissionState(), { active: 0, queued: 0 });
      return { nativeCommands: records.length, killedEncoder, closedCommands: records.length, cancelledRuns: 1, releasedLeases: 1 };
    } finally { await Promise.allSettled([completion, closing]); }
  });
  assert.equal(result.mediaFixture.originalFilesUnchanged, true);
  t.diagnostic(JSON.stringify({ scenario: 'actual-encode-cancel', nativeCommands: result.nativeCommands, closedCommands: result.closedCommands,
    killedEncoder: result.killedEncoder, cancelledRuns: result.cancelledRuns, releasedLeases: result.releasedLeases,
    originalFilesUnchanged: true, ffmpegVersion: result.mediaFixture.ffmpegVersion, qualificationPollIntervalMs: 25 }));
});
