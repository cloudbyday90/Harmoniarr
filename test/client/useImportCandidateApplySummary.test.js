import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportCandidateApplySummary } from '../../src/client/composables/useImportCandidateApplySummary.js';

test('useImportCandidateApplySummary loads the shared apply summary payload', async () => {
  const workflow = useImportCandidateApplySummary({
    fetchImportCandidateApplySummary: async () => ({
      importCandidateApply: {
        currentRun: {
          id: 'apply-run-1',
          items: [{
            id: 'item-1',
            itemStatus: 'applied',
          }],
          status: 'completed',
        },
        latestRun: {
          id: 'apply-run-1',
          status: 'completed',
        },
        summary: {
          status: 'ready',
          message: '1 candidate was applied into the library.',
        },
      },
    }),
  });

  await workflow.loadImportCandidateApplySummary();

  assert.equal(workflow.currentRun.value.id, 'apply-run-1');
  assert.equal(workflow.summary.value.status, 'ready');
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.isLoading.value, false);
});

test('useImportCandidateApplySummary starts an apply run and reloads summary', async (t) => {
  const fetchImportCandidateApplySummary = t.mock.fn(async () => ({
    importCandidateApply: {
      currentRun: {
        id: 'apply-run-2',
        status: 'pending',
      },
      latestRun: {
        id: 'apply-run-2',
        status: 'pending',
      },
      summary: {
        status: 'running',
        message: 'Import apply is in progress.',
      },
    },
  }));
  const startImportCandidateApplyRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'apply-run-2',
      status: 'pending',
    },
  }));
  const workflow = useImportCandidateApplySummary({
    fetchImportCandidateApplySummary,
    startImportCandidateApplyRun,
  });

  await workflow.startApplyRun();

  assert.equal(startImportCandidateApplyRun.mock.callCount(), 1);
  assert.equal(fetchImportCandidateApplySummary.mock.callCount(), 1);
  assert.equal(workflow.currentRun.value.id, 'apply-run-2');
  assert.equal(workflow.actionErrorMessage.value, '');
});