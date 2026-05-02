import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportCandidateExecutionSummary } from '../../src/client/composables/useImportCandidateExecutionSummary.js';

test('useImportCandidateExecutionSummary loads the shared execution summary payload', async () => {
  const workflow = useImportCandidateExecutionSummary({
    fetchImportCandidateExecutionSummary: async () => ({
      importCandidateExecution: {
        currentRun: {
          id: 'run-1',
          items: [{
            id: 'item-1',
            liveTransferSummary: {
              status: 'queued',
              total: 1,
            },
          }],
          status: 'completed',
        },
        latestRun: {
          id: 'run-1',
          status: 'completed',
        },
        summary: {
          status: 'ready',
          message: '1 candidate was enqueued for download.',
        },
      },
    }),
  });

  await workflow.loadImportCandidateExecutionSummary();

  assert.equal(workflow.currentRun.value.id, 'run-1');
  assert.equal(workflow.summary.value.status, 'ready');
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.isLoading.value, false);
});

test('useImportCandidateExecutionSummary starts a planning run and reloads summary', async (t) => {
  const fetchImportCandidateExecutionSummary = t.mock.fn(async () => ({
    importCandidateExecution: {
      currentRun: {
        id: 'run-2',
        status: 'pending',
      },
      latestRun: {
        id: 'run-2',
        status: 'pending',
      },
      summary: {
        status: 'running',
        message: 'Download enqueue is in progress.',
      },
    },
  }));
  const startImportCandidateExecutionRun = t.mock.fn(async () => ({
    accepted: true,
    run: {
      id: 'run-2',
      status: 'pending',
    },
  }));
  const workflow = useImportCandidateExecutionSummary({
    fetchImportCandidateExecutionSummary,
    startImportCandidateExecutionRun,
  });

  await workflow.startExecutionRun();

  assert.equal(startImportCandidateExecutionRun.mock.callCount(), 1);
  assert.equal(fetchImportCandidateExecutionSummary.mock.callCount(), 1);
  assert.equal(workflow.currentRun.value.id, 'run-2');
  assert.equal(workflow.actionErrorMessage.value, '');
});

test('useImportCandidateExecutionSummary reconciles transfer state and reloads summary', async (t) => {
  const fetchImportCandidateExecutionSummary = t.mock.fn(async () => ({
    importCandidateExecution: {
      currentRun: {
        id: 'run-3',
        status: 'completed',
      },
      summary: {
        status: 'ready',
        message: 'Transfer state persisted.',
      },
    },
  }));
  const reconcileImportCandidateExecutionState = t.mock.fn(async () => ({ ok: true }));
  const workflow = useImportCandidateExecutionSummary({
    fetchImportCandidateExecutionSummary,
    reconcileImportCandidateExecutionState,
  });

  await workflow.reconcileExecutionState();

  assert.equal(reconcileImportCandidateExecutionState.mock.callCount(), 1);
  assert.equal(fetchImportCandidateExecutionSummary.mock.callCount(), 1);
  assert.equal(workflow.currentRun.value.id, 'run-3');
  assert.equal(workflow.actionErrorMessage.value, '');
});

test('useImportCandidateExecutionSummary can load an exact historical run detail independently of the latest summary run', async () => {
  const workflow = useImportCandidateExecutionSummary({
    fetchImportCandidateExecutionRunDetail: async (runId) => ({
      importCandidateExecutionRun: {
        checkedAt: '2026-05-01T18:00:00.000Z',
        run: {
          id: runId,
          items: [{ id: 'item-older-1' }],
          status: 'failed',
        },
      },
    }),
    fetchImportCandidateExecutionSummary: async () => ({
      importCandidateExecution: {
        currentRun: {
          id: 'run-latest',
          status: 'completed',
        },
        latestRun: {
          id: 'run-latest',
          status: 'completed',
        },
        summary: {
          status: 'ready',
          message: 'Latest execution run completed.',
        },
      },
    }),
  });

  await workflow.loadImportCandidateExecutionSummary({ preferredRunId: 'run-older-44' });

  assert.equal(workflow.selectedRunId.value, 'run-older-44');
  assert.equal(workflow.currentRun.value.id, 'run-older-44');
  assert.equal(workflow.runDetailErrorMessage.value, '');
});