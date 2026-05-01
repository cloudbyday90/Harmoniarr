import assert from 'node:assert/strict';
import test from 'node:test';
import { useSelectedImportCandidateSummary } from '../../src/client/composables/useSelectedImportCandidateSummary.js';

test('useSelectedImportCandidateSummary loads selected planning status from the injected api', async () => {
  const workflow = useSelectedImportCandidateSummary({
    fetchSummary: async () => ({
      selectedImportCandidates: {
        counts: {
          blocked: 1,
          ready: 0,
          readyWithWarnings: 1,
          totalSelected: 2,
        },
        selectedCandidates: [{ id: 'candidate-1' }, { id: 'candidate-2' }],
        summary: {
          status: 'blocked',
          message: '1 selected candidate is blocked.',
        },
      },
    }),
  });

  await workflow.loadSelectedSummary();

  assert.equal(workflow.counts.value.totalSelected, 2);
  assert.equal(workflow.selectedCandidates.value.length, 2);
  assert.equal(workflow.summary.value.status, 'blocked');
  assert.equal(workflow.errorMessage.value, '');
  assert.equal(workflow.isLoading.value, false);
});

test('useSelectedImportCandidateSummary clears stale state on failure', async () => {
  const workflow = useSelectedImportCandidateSummary({
    fetchSummary: async () => {
      throw new Error('selected summary unavailable');
    },
  });

  await workflow.loadSelectedSummary();

  assert.equal(workflow.selectedSummary.value, null);
  assert.equal(workflow.errorMessage.value, 'selected summary unavailable');
  assert.equal(workflow.selectedCandidates.value.length, 0);
  assert.equal(workflow.isLoading.value, false);
});