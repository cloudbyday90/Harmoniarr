import assert from 'node:assert/strict';
import test from 'node:test';
import { useImportCandidateApplyPreview } from '../../src/client/composables/useImportCandidateApplyPreview.js';

test('useImportCandidateApplyPreview loads apply preview state from the injected shared service', async (t) => {
  const fetchApplyPreview = t.mock.fn(async (importCandidateId) => ({
    importCandidateApplyPreview: {
      preview: {
        candidate: { id: importCandidateId },
      },
      summary: {
        status: 'ready',
        message: '1 file is ready.',
      },
    },
  }));
  const previewState = useImportCandidateApplyPreview({ fetchApplyPreview });

  await previewState.loadApplyPreview('candidate-1');

  assert.equal(fetchApplyPreview.mock.callCount(), 1);
  assert.deepEqual(fetchApplyPreview.mock.calls[0].arguments, ['candidate-1']);
  assert.equal(previewState.applyPreview.value.preview.candidate.id, 'candidate-1');
  assert.equal(previewState.applyPreviewError.value, '');
  assert.equal(previewState.isLoadingApplyPreview.value, false);
});

test('useImportCandidateApplyPreview clears stale apply preview state on failure and reset', async () => {
  const previewState = useImportCandidateApplyPreview({
    fetchApplyPreview: async () => {
      throw new Error('apply preview route offline');
    },
  });

  await previewState.loadApplyPreview('candidate-1');
  assert.equal(previewState.applyPreview.value, null);
  assert.equal(previewState.applyPreviewError.value, 'apply preview route offline');

  previewState.clearApplyPreview();
  assert.equal(previewState.applyPreview.value, null);
  assert.equal(previewState.applyPreviewError.value, '');
});