/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { before, after, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunLeaseHeartbeat } from '../../src/server/heartbeat/operation-run-lease-heartbeat.js';
import { createImportCandidateMediaInspectionRunStore } from '../../src/server/import-candidates/import-candidate-media-inspection-run-store.js';
import { createImportCandidateTranscodeRunStore } from '../../src/server/import-candidates/import-candidate-transcode-run-store.js';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createImportCandidateApplyPreviewService } from '../../src/server/import-candidates/import-candidate-apply-preview-service.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaCommandAdmission } from '../../src/server/media/media-command-admission.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { createMediaToolingStatusService } from '../../src/server/media/media-tooling-status-service.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('media lease interruption preserves replacement acquisition authority', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const kind of ['inspection', 'preflight']) for (const phase of ['readiness', 'queued', 'active']) for (const replaced of phase === 'active' ? [true, false] : [true]) {
    test(`${kind} lease ${replaced ? 'replacement' : 'expiry'} during ${phase} drains native work without stale publication`, { timeout: config.scenarioTimeoutMs }, async t => {
      await postgres.runIsolatedDatabase(async ({ getPoolFn }) => {
        await applyPendingMigrations({ getPoolFn });
        const type = kind === 'inspection' ? 'import_candidate_media_inspection' : 'import_candidate_transcode_orchestration';
        const store = kind === 'inspection' ? createImportCandidateMediaInspectionRunStore({ getPoolFn }) : createImportCandidateTranscodeRunStore({ getPoolFn });
        const queued = await store.createOperationRun({ requestedCandidateCount: 1, transcodeCandidateFileCount: 1 });
        assert.equal((await createOperationQueueStore({ getPoolFn }).claimNextRunnableRun({ operationTypes: [type] })).id, queued.id);
        const nativeReady = Promise.withResolvers(); const waiting = Promise.withResolvers(); const releasing = Promise.withResolvers(); const releaseGate = Promise.withResolvers();
        const records = []; const fifo = createMediaCommandAdmission({ concurrency: 1 });
        const command = createMediaCommandService({ allowedBinaries: [process.execPath], defaultTimeoutMs: 15_000,
          admission: { ...fifo, run(task, options) { const result = fifo.run(task, options); if (options?.signal) waiting.resolve(); return result; } },
          spawnFn: (_binary, _args, options) => {
            const child = spawn(process.execPath, ['--input-type=module', '-e',
              "process.stdout.write(JSON.stringify({ streams: [{ codec_type: 'audio', codec_name: 'flac' }], format: {} })); process.send('ready'); process.on('message', () => process.disconnect());"],
            { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
            const record = { child, closed: false, done: Promise.withResolvers() }; records.push(record);
            child.once('message', () => nativeReady.resolve()); child.once('close', () => { record.closed = true; record.done.resolve(); }); return child;
          } });
        const tooling = createMediaToolingStatusService({ mediaCommandService: command, ffmpegBinary: process.execPath, ffprobeBinary: process.execPath });
        const getMediaToolingStatus = phase === 'readiness' ? tooling.getStatus : async () => ({ details: { ffmpegAvailable: true, ffprobeAvailable: true } });
        const inspection = createMediaInspectionService({ ffprobeBin: process.execPath, mediaCommandService: command, getMediaToolingStatus });
        const encoding = createMediaTranscodeExecutionService({ ffmpegBin: process.execPath, mediaCommandService: command, getMediaToolingStatus });
        const preview = createImportCandidateApplyPreviewService({ mediaInspectionService: inspection,
          statFn: async () => ({ isDirectory: () => false, size: 12 }),
          previewImportCandidate: async () => ({ naming: { filePreviews: [1, 2].map(id => ({ fileId: String(id), sourcePath: `/fixture/${id}.flac` })) } }),
        });
        let blocker; let completion; let closing; let captured; let heartbeat; let replacement;
        try {
          if (phase === 'queued') { blocker = command.runCommand({ binary: process.execPath }); void blocker.catch(() => {}); await nativeReady.promise; }
          const workerOptions = { ...store,
            createOperationRunLeaseHeartbeatFn: options => {
              heartbeat = createOperationRunLeaseHeartbeat({ ...options,
                createIntervalHeartbeatRunnerFn: ({ onTick }) => ({ start() {}, stop() {}, tick: onTick }) });
              return heartbeat;
            },
            markRunCompleted: async () => assert.fail('Stale owner must not publish completion'),
            markRunFailed: async () => assert.fail('Confirmed loss must not publish failure'),
            markRunPaused: async () => assert.fail('Confirmed loss must not publish pause'),
            acquireLease: async input => { captured = await store.acquireLease(input); return captured; },
            buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'controlled', executionStatus: { code: 'ready' } }] }),
            previewImportCandidateApply: kind === 'inspection' ? preview.previewImportCandidateApply : async () => ({ files: [{ sourceFile: { path: '/fixture/source.wav' }, transcodePlan: { recommendedAction: 'transcode_candidate' } }] }),
            executeTranscodeCandidate: encoding.executeCandidate,
            markRunCancelled: async () => assert.fail('Confirmed loss must not publish cancellation'),
            releaseLease: async input => { assert.equal(input.expectedLease, captured); assert.equal(input.status, 'failed'); assert.ok(records.every(row => phase === 'queued' || row.closed)); releasing.resolve(); await releaseGate.promise; return store.releaseLease(input); },
          };
          const worker = kind === 'inspection' ? createImportCandidateMediaInspectionWorker(workerOptions) : createImportCandidateTranscodeWorker(workerOptions);
          ({ completion } = await worker.startWorkerRun({ runId: queued.id, requestedCandidateCount: 1, transcodeCandidateFileCount: 1 })); closing = worker.close();
          await waitForFixtureReady({ ready: phase === 'queued' ? waiting.promise : nativeReady.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'running');
          await getPoolFn().query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [captured.leaseKey]);
          if (replaced) replacement = await createJobLeaseStore({ getPoolFn, ownerInstanceId: 'replacement-fixture' }).acquireLease({ jobType: type, leaseKey: captured.leaseKey });
          if (replaced) assert.notEqual(replacement.acquisitionId, captured.acquisitionId);
          assert.deepEqual(await heartbeat.tick(), { skipped: true, reason: 'lease_lost' });
          await waitForFixtureReady({ ready: releasing.promise, operation: completion, signal: t.signal });
          assert.equal((await store.getRunById(queued.id)).status, 'running');
          assert.equal((await getPoolFn().query('SELECT released_at FROM job_leases WHERE lease_key = $1', [captured.leaseKey])).rows[0].released_at, null);
          assert.equal(command.getAdmissionState().queued, 0);
          if (phase === 'queued') { assert.equal(records.length, 1); assert.equal(records[0].closed, false); }
          else assert.ok(records.every(row => row.closed));
          releaseGate.resolve(); await completion; await closing;
          const lease = await createJobLeaseStore({ getPoolFn }).getLease({ leaseKey: captured.leaseKey });
          if (replaced) {
            assert.equal(lease.acquisitionId, replacement.acquisitionId); assert.equal(lease.ownerInstanceId, 'replacement-fixture');
            assert.equal(lease.releasedAt, null); assert.equal(lease.status, 'active');
          } else { assert.equal(lease.acquisitionId, captured.acquisitionId); assert.ok(lease.releasedAt); assert.equal(lease.status, 'failed'); }
          assert.equal((await store.getRunById(queued.id)).status, 'running');
          assert.equal(await store.markRunCompleted({ runId: queued.id, expectedLease: captured }), false);
          assert.equal(await store.releaseLease({ runId: queued.id, expectedLease: captured, status: 'failed' }), null);
        } finally {
          releaseGate.resolve();
          for (const row of records) if (!row.closed) row.child.kill();
          await Promise.allSettled([blocker, completion, closing, ...records.map(row => row.done.promise)]);
        }
      });
    });
  }
});
