/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createImportCandidateMediaInspectionWorker } from '../../src/server/import-candidates/import-candidate-media-inspection-worker.js';
import { createImportCandidateTranscodeWorker } from '../../src/server/import-candidates/import-candidate-transcode-worker.js';
import { createMediaCommandService } from '../../src/server/media/media-command-service.js';
import { createMediaInspectionService } from '../../src/server/media/media-inspection-service.js';
import { createMediaTranscodeExecutionService } from '../../src/server/media/media-transcode-execution-service.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

export async function withDeploymentMediaWorkers({ application, pool, fixture, observer }, work) {
  const library = application.libraryModule; const imports = application.importCandidateModule;
  const scanStore = library.libraryScanRunStore; const inspectionStore = imports.importCandidateMediaInspectionRunStore;
  const transcodeStore = imports.importCandidateTranscodeRunStore; const queue = createOperationQueueStore();
  const owners = []; const completions = [];
  const scan = createLibraryScanWorker({ ...scanStore,
    captureLibraryScanReceiptSnapshot: library.libraryScanCatalogueService.captureLibraryScanReceiptSnapshot,
    recordLibraryScanCatalogue: library.libraryScanCatalogueService.recordLibraryScanCatalogue,
    extractLibraryFileTags: async input => { await observer.enterScan(); return library.libraryTagExtractionService.extractLibraryFileTags(input); },
    captureLibrarySidecarArtwork: library.librarySidecarArtworkService.captureSidecarArtwork,
    matchLibraryFiles: library.libraryFileMatcherService.matchLibraryFiles,
    reconcileLibraryReleases: library.libraryReleaseReconciliationService.reconcileLibraryReleases,
    reconcileWantedReleases: library.libraryWantedReleaseService.reconcileWantedReleases,
    reconcileDiscoveryRequests: library.libraryDiscoveryRequestService.reconcileDiscoveryRequests,
  }); owners.push(scan);
  const mediaCommandService = createMediaCommandService({ allowedBinaries: ['ffprobe', 'ffmpeg'], spawnFn: (...args) => {
    if (args[0] === 'ffmpeg') {
      assert.deepEqual(args[1].slice(-3), ['-f', 'null', '-']); assert.equal(args[1][args[1].indexOf('-c:a') + 1], 'libopus');
    }
    return observer.spawnMedia(args[0] === 'ffmpeg' ? 'encode' : 'probe', ...args);
  } });
  const inspection = createMediaInspectionService({ mediaCommandService });
  const selected = fixture.sources.map(path => ({ id: randomUUID(), path, executionStatus: { code: 'ready' } }));
  const probeWorker = createImportCandidateMediaInspectionWorker({ ...inspectionStore,
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: selected }),
    previewImportCandidateApply: async ({ importCandidateId, signal }) => {
      await observer.waitForEncoder(); const source = selected.find(row => row.id === importCandidateId);
      return { files: [{ sourceFile: { path: source.path }, inspection: await inspection.inspectSourceFile({ sourcePath: source.path, signal }) }] };
    },
  }); owners.push(probeWorker);
  const transcode = createMediaTranscodeExecutionService({ ffmpegThreads: application.runtimeResourceService.getRuntimeConfiguration().mediaCommands.ffmpegThreads,
    mediaCommandService,
  });
  const encodeWorker = createImportCandidateTranscodeWorker({ ...transcodeStore,
    buildSelectedImportCandidateSummary: async () => ({ selectedCandidates: [{ id: 'fixture-transcode', executionStatus: { code: 'ready' } }] }),
    previewImportCandidateApply: async () => ({ files: [{ sourceFile: { path: fixture.longSource },
      transcodePlan: { recommendedAction: 'transcode_candidate', target: { audioCodec: 'opus' } } }] }),
    executeTranscodeCandidate: transcode.executeCandidate,
  }); owners.push(encodeWorker);
  const start = async (worker, store, type, input) => {
    const run = await store.createOperationRun(input); const claimed = await queue.claimNextRunnableRun({ operationTypes: [type] });
    assert.equal(claimed.id, run.id); const { completion } = await worker.startWorkerRun({ runId: run.id, ...input });
    completions.push(completion); void completion.catch(() => {}); return run.id;
  };
  return withWorkerTaskCleanup(async () => {
    const scanId = await start(scan, scanStore, 'library_scan', { libraryRoot: fixture.libraryRoot });
    void completions[0].finally(() => observer.finishScan()).catch(() => {});
    await Promise.race([observer.waitForScan(), completions[0].then(() => assert.fail('Scan missed its owned tag stage'))]);
    const encodeId = await start(encodeWorker, transcodeStore, 'import_candidate_transcode_orchestration', { requestedCandidateCount: 1, transcodeCandidateFileCount: 1 });
    const probeId = await start(probeWorker, inspectionStore, 'import_candidate_media_inspection', { requestedCandidateCount: selected.length });
    await observer.waitForOverlap(); observer.releaseScan();
    const result = await work(); await Promise.all(completions);
    const scanRun = await scanStore.getRunById(scanId); const probeRun = await inspectionStore.getRunById(probeId); const encodeRun = await transcodeStore.getRunById(encodeId);
    for (const run of [scanRun, probeRun, encodeRun]) assert.equal(run.status, 'completed');
    assert.equal(scanRun.filesMatched, fixture.fileCount); assert.equal(probeRun.inspectedFileCount, 4); assert.equal(probeRun.inspectionUnavailableCount, 0);
    assert.equal(encodeRun.passedPreflightCount, 1); assert.equal(encodeRun.failedPreflightCount, 0);
    const rows = (await pool.query("SELECT count(*)::int AS files, count(tag_payload)::int AS tags, count(*) FILTER (WHERE tag_payload->>'artist' = 'Qualification Artist')::int AS parsed_tags FROM library_files WHERE library_root_id = (SELECT id FROM library_roots WHERE path = $1)", [fixture.libraryRoot])).rows[0];
    assert.equal(rows.files, fixture.fileCount); assert.equal(rows.tags, fixture.fileCount); assert.equal(rows.parsed_tags, fixture.fileCount);
    const leases = (await pool.query("SELECT count(*)::int AS count, count(*) FILTER (WHERE released_at IS NOT NULL AND status = 'completed')::int AS released, count(*) FILTER (WHERE released_at IS NULL AND expires_at > clock_timestamp())::int AS active FROM job_leases WHERE lease_key = ANY($1::text[])", [
      [`library_scan:${scanId}`, `import_candidate_media_inspection:${probeId}`, `import_candidate_transcode_orchestration:${encodeId}`],
    ])).rows[0];
    assert.deepEqual(leases, { count: 3, released: 3, active: 0 });
    assert.deepEqual(mediaCommandService.getAdmissionState(), { active: 0, queued: 0 });
    return { ...result, media: { ...observer.getState(), cataloguedFiles: rows.files, taggedFiles: rows.tags, inspectedFiles: 4,
      passedPreflights: 1, mode: 'preflight_only', completedRuns: 3, releasedLeases: leases.released, activeLeases: leases.active,
      ffmpegThreads: application.runtimeResourceService.getRuntimeConfiguration().mediaCommands.ffmpegThreads } };
  }, async () => {
    observer.releaseScan();
    const settled = await Promise.allSettled(owners.map(owner => owner.close()));
    await Promise.allSettled(completions);
    let failed = settled.find(row => row.status === 'rejected');
    try { await observer.close(); } catch (reason) { failed ??= { reason }; }
    if (failed) throw failed.reason;
  });
}
