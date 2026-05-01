import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportPendingCandidateSummary } from '../../src/client/composables/useImportPendingCandidateSummary.js';

test('useImportPendingCandidateSummary loads completed download readiness from the injected api', async () => {
  const workflow = useImportPendingCandidateSummary({
    fetchSummary: async () => ({
      importPendingCandidates: {
        counts: {
          blocked: 0,
          ready: 1,
          readyWithWarnings: 1,
          totalImportPending: 2,
        },
        importPendingCandidates: [{ id: 'candidate-1' }, { id: 'candidate-2' }],
        summary: {
          status: 'attention',
          message: '1 completed download candidate has warnings.',
        },
      },
    }),
  });

  await workflow.loadImportPendingSummary();

  assert.equal(workflow.counts.value.totalImportPending, 2);
  assert.equal(workflow.importPendingCandidates.value.length, 2);
  assert.equal(workflow.summary.value.status, 'attention');
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.isLoading.value, false);
});

test('useImportPendingCandidateSummary clears stale state on failure', async () => {
  const workflow = useImportPendingCandidateSummary({
    fetchSummary: async () => {
      throw new Error('import-pending summary unavailable');
    },
  });

  await workflow.loadImportPendingSummary();

  assert.equal(workflow.importPendingSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'import-pending summary unavailable');
  assert.equal(workflow.importPendingCandidates.value.length, 0);
  assert.equal(workflow.isLoading.value, false);
});