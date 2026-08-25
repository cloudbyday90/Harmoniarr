import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplySummaryService } from '../../src/server/import-candidates/import-candidate-apply-summary-service.js';

test('buildImportCandidateApplySummary returns the current run with persisted items', async () => {
  const service = createImportCandidateApplySummaryService({
    importCandidateApplyRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        appliedCount: 1,
        appliedWithWarningsCount: 0,
        applyFailedCount: 0,
        blockedCount: 0,
        currentStep: 'Import apply complete',
        executionMode: 'move',
        finishedAt: '2026-04-30T20:00:00.000Z',
        id: 'run-1',
        processedCandidateCount: 1,
        readyCount: 1,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-04-30T19:59:00.000Z',
        status: 'completed',
        totalImportPending: 1,
      }),
      listRecentRuns: async () => [{
        appliedCount: 1,
        appliedWithWarningsCount: 0,
        applyFailedCount: 0,
        blockedCount: 0,
        currentStep: 'Import apply complete',
        executionMode: 'move',
        finishedAt: '2026-04-30T20:00:00.000Z',
        id: 'run-1',
        processedCandidateCount: 1,
        readyCount: 1,
        readyWithWarningsCount: 0,
        requestedCandidateCount: 1,
        startedAt: '2026-04-30T19:59:00.000Z',
        status: 'completed',
        totalImportPending: 1,
      }],
    },
    listImportOperationsFn: async () => [{
      destinationPath: '/data/music/Autechre/Amber/01 Foil.flac',
      errorMessage: null,
      finishedAt: '2026-04-30T20:00:00.000Z',
      id: 'operation-1',
      importCandidateFileId: 'file-1',
      importCandidateId: 'candidate-1',
      operationRunId: 'run-1',
      operationType: 'move',
      position: 2,
      sourcePath: '/data/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
      startedAt: '2026-04-30T19:59:30.000Z',
      status: 'applied',
      stepType: 'finalize',
      transport: 'copy_then_remove',
    }],
    listImportApplyRunItemsFn: async () => [{
      applySnapshot: {
        candidate: { id: 'candidate-1' },
      },
      id: 'item-1',
      importCandidateId: 'candidate-1',
      itemStatus: 'applied',
      statusMessage: '1 file was applied into the library.',
    }],
  });

  const summary = await service.buildImportCandidateApplySummary();

  assert.equal(summary.currentRun.id, 'run-1');
  assert.equal(summary.currentRun.items.length, 1);
  assert.equal(summary.currentRun.items[0].importOperations.length, 1);
  assert.equal(summary.currentRun.items[0].importOperations[0].id, 'operation-1');
  assert.equal(summary.recentRuns.length, 1);
  assert.equal(summary.recentRuns[0].id, 'run-1');
  assert.equal(summary.summary.status, 'ready');
});

test('buildImportCandidateApplySummary reports no run when none exist', async () => {
  const service = createImportCandidateApplySummaryService({
    importCandidateApplyRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => null,
      listRecentRuns: async () => [],
    },
    listImportApplyRunItemsFn: async () => [],
  });

  const summary = await service.buildImportCandidateApplySummary();

  assert.equal(summary.currentRun, null);
  assert.deepEqual(summary.recentRuns, []);
  assert.equal(summary.summary.status, 'not_started');
});

test('buildImportCandidateApplySummary surfaces an explicit filesystem confirmation state', async () => {
  const service = createImportCandidateApplySummaryService({
    importCandidateApplyRunStore: {
      getActiveRun: async () => null,
      getLatestRun: async () => ({
        appliedCount: 0,
        appliedWithWarningsCount: 0,
        applyFailedCount: 0,
        awaitingConfirmationCount: 1,
        blockedCount: 0,
        id: 'run-confirmation-1',
        status: 'completed',
      }),
      listRecentRuns: async () => [],
    },
    listImportApplyRunItemsFn: async () => [],
    listImportOperationsFn: async () => [],
  });

  const summary = await service.buildImportCandidateApplySummary();

  assert.equal(summary.summary.status, 'attention');
  assert.match(summary.summary.message, /filesystem change/);
  assert.match(summary.summary.message, /will not make another file change automatically/);
});
