import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateMediaInspectionSummaryService } from '../../src/server/import-candidates/import-candidate-media-inspection-summary-service.js';

test('buildImportCandidateMediaInspectionSummary returns the current media inspection run and recent history', async () => {
  const service = createImportCandidateMediaInspectionSummaryService({
    importCandidateMediaInspectionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        blockedCandidateCount: 0,
        currentStep: 'Inspection complete',
        errorMessage: null,
        finishedAt: '2026-05-01T01:00:00.000Z',
        id: 'inspection-run-1',
        inspectedCandidateCount: 2,
        inspectedFileCount: 6,
        inspectionUnavailableCount: 0,
        requestedCandidateCount: 2,
        startedAt: '2026-05-01T00:59:00.000Z',
        status: 'completed',
        warningCount: 1,
      }),
      listRecentRuns: async () => [{
        blockedCandidateCount: 0,
        currentStep: 'Inspection complete',
        errorMessage: null,
        finishedAt: '2026-05-01T01:00:00.000Z',
        id: 'inspection-run-1',
        inspectedCandidateCount: 2,
        inspectedFileCount: 6,
        inspectionUnavailableCount: 0,
        requestedCandidateCount: 2,
        startedAt: '2026-05-01T00:59:00.000Z',
        status: 'completed',
        warningCount: 1,
      }],
    },
  });

  const summary = await service.buildImportCandidateMediaInspectionSummary();

  assert.equal(summary.currentRun.id, 'inspection-run-1');
  assert.equal(summary.recentRuns.length, 1);
  assert.equal(summary.recentRuns[0].id, 'inspection-run-1');
  assert.equal(summary.summary.status, 'attention');
});

test('buildImportCandidateMediaInspectionSummary reports no run when none exist', async () => {
  const service = createImportCandidateMediaInspectionSummaryService({
    importCandidateMediaInspectionRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => null,
      listRecentRuns: async () => [],
    },
  });

  const summary = await service.buildImportCandidateMediaInspectionSummary();

  assert.equal(summary.currentRun, null);
  assert.deepEqual(summary.recentRuns, []);
  assert.equal(summary.summary.status, 'not_started');
});

test('buildImportCandidateMediaInspectionRunDetail returns a specific historical run', async () => {
  const service = createImportCandidateMediaInspectionSummaryService({
    importCandidateMediaInspectionRunStore: {
      getRunById: async (runId) => ({
        blockedCandidateCount: 1,
        currentStep: 'Inspection complete',
        errorMessage: null,
        finishedAt: '2026-05-01T01:30:00.000Z',
        id: runId,
        inspectedCandidateCount: 3,
        inspectionDiagnostics: [{
          candidateId: 'candidate-1',
          code: 'media_inspection_probe_failed',
          fileId: 'file-1',
          filename: 'alpha.flac',
          folderPath: '/private/staging/Boards of Canada/Geogaddi',
          message: 'Probe failed',
          username: 'remote-peer',
        }],
        inspectedFileCount: 9,
        inspectionUnavailableCount: 0,
        requestedCandidateCount: 4,
        startedAt: '2026-05-01T01:20:00.000Z',
        status: 'completed',
        warningCount: 0,
      }),
    },
  });

  const detail = await service.buildImportCandidateMediaInspectionRunDetail({
    runId: 'inspection-run-7',
  });

  assert.equal(detail.run.id, 'inspection-run-7');
  assert.equal(detail.run.blockedCandidateCount, 1);
  assert.deepEqual(detail.run.inspectionDiagnostics, [{
    candidateId: 'candidate-1',
    code: 'media_inspection_probe_failed',
    fileId: 'file-1',
    filename: 'alpha.flac',
    folderPath: '/private/staging/Boards of Canada/Geogaddi',
    message: 'Probe failed',
    username: 'remote-peer',
  }]);
});

test('buildImportCandidateMediaInspectionRunDetail preserves not-found semantics', async () => {
  const service = createImportCandidateMediaInspectionSummaryService({
    importCandidateMediaInspectionRunStore: {
      getRunById: async () => null,
    },
  });

  await assert.rejects(
    () => service.buildImportCandidateMediaInspectionRunDetail({ runId: 'missing-run' }),
    {
      code: 'import_candidate_media_inspection_run_not_found',
      message: 'Import media inspection run not found',
      status: 404,
    },
  );
});
