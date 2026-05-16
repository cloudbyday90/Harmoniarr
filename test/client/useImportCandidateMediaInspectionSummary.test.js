import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportCandidateMediaInspectionSummary } from '../../src/client/composables/useImportCandidateMediaInspectionSummary.js';

test('useImportCandidateMediaInspectionSummary loads the shared media inspection summary payload', async () => {
  const workflow = useImportCandidateMediaInspectionSummary({
    fetchImportCandidateMediaInspectionSummary: async () => ({
      importCandidateMediaInspection: {
        currentRun: {
          id: 'inspection-run-1',
          status: 'completed',
        },
        latestRun: {
          id: 'inspection-run-1',
          status: 'completed',
        },
        recentRuns: [{
          id: 'inspection-run-1',
          status: 'completed',
        }],
        summary: {
          status: 'ready',
          message: '6 files were inspected successfully.',
        },
      },
    }),
  });

  await workflow.loadImportCandidateMediaInspectionSummary();

  assert.equal(workflow.currentRun.value.id, 'inspection-run-1');
  assert.equal(workflow.recentRuns.value.length, 1);
  assert.equal(workflow.summary.value.status, 'ready');
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.isLoading.value, false);
});

test('useImportCandidateMediaInspectionSummary starts a media inspection run and reloads summary', async (t) => {
  const fetchImportCandidateMediaInspectionSummary = t.mock.fn(async () => ({
    importCandidateMediaInspection: {
      currentRun: {
        id: 'inspection-run-2',
        status: 'pending',
      },
      latestRun: {
        id: 'inspection-run-2',
        status: 'pending',
      },
      recentRuns: [{
        id: 'inspection-run-2',
        status: 'pending',
      }],
      summary: {
        status: 'running',
        message: 'Import media inspection is in progress.',
      },
    },
  }));
  const startImportCandidateMediaInspectionRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'inspection-run-2',
      status: 'pending',
    },
  }));
  const workflow = useImportCandidateMediaInspectionSummary({
    fetchImportCandidateMediaInspectionSummary,
    startImportCandidateMediaInspectionRun,
  });

  await workflow.startMediaInspectionRun();

  assert.equal(startImportCandidateMediaInspectionRun.mock.callCount(), 1);
  assert.equal(fetchImportCandidateMediaInspectionSummary.mock.callCount(), 1);
  assert.equal(workflow.currentRun.value.id, 'inspection-run-2');
  assert.equal(workflow.actionErrorMessage.value, '');
});

test('useImportCandidateMediaInspectionSummary can load an exact historical run detail independently of the latest summary run', async () => {
  const workflow = useImportCandidateMediaInspectionSummary({
    fetchImportCandidateMediaInspectionRunDetail: async (runId) => ({
      importCandidateMediaInspectionRun: {
        checkedAt: '2026-05-01T18:10:00.000Z',
        run: {
          id: runId,
          status: 'failed',
          warningCount: 2,
        },
      },
    }),
    fetchImportCandidateMediaInspectionSummary: async () => ({
      importCandidateMediaInspection: {
        currentRun: {
          id: 'inspection-run-latest',
          status: 'completed',
        },
        latestRun: {
          id: 'inspection-run-latest',
          status: 'completed',
        },
        recentRuns: [{
          id: 'inspection-run-latest',
          status: 'completed',
        }],
        summary: {
          status: 'ready',
          message: 'Latest media inspection run completed.',
        },
      },
    }),
  });

  await workflow.loadImportCandidateMediaInspectionSummary({ preferredRunId: 'inspection-run-older-4' });

  assert.equal(workflow.selectedRunId.value, 'inspection-run-older-4');
  assert.equal(workflow.currentRun.value.id, 'inspection-run-older-4');
  assert.equal(workflow.runDetailErrorMessage.value, '');
});
