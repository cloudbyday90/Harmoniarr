import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportCandidatePreview } from '../../src/client/composables/useImportCandidatePreview.js';

test('useImportCandidatePreview loads preview state from the injected shared service', async (t) => {
  const fetchPreview = t.mock.fn(async (importCandidateId) => ({
    importCandidatePreview: {
      candidate: { id: importCandidateId },
      validation: {
        canPreview: true,
        blockers: [],
        warnings: [],
      },
    },
  }));
  const previewState = useImportCandidatePreview({ fetchPreview });

  await previewState.loadPreview('candidate-1');

  assert.equal(fetchPreview.mock.callCount(), 1);
  assert.deepEqual(fetchPreview.mock.calls[0].arguments, ['candidate-1']);
  assert.equal(previewState.preview.value.candidate.id, 'candidate-1');
  assert.equal(previewState.previewError.value, '');
  assert.equal(previewState.isLoadingPreview.value, false);
});

test('useImportCandidatePreview clears stale preview state on failure and reset', async () => {
  const previewState = useImportCandidatePreview({
    fetchPreview: async () => {
      throw new Error('preview route offline');
    },
  });

  await previewState.loadPreview('candidate-1');
  assert.equal(previewState.preview.value, null);
  assert.equal(previewState.previewError.value, 'preview route offline');

  previewState.clearPreview();
  assert.equal(previewState.preview.value, null);
  assert.equal(previewState.previewError.value, '');
});