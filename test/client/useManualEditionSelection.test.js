import assert from 'node:assert/strict';
import test from 'node:test';
import { useManualEditionSelection } from '../../src/client/composables/useManualEditionSelection.js';

function createToastDouble(t) {
  return {
    dismiss: t.mock.fn(),
    error: t.mock.fn(),
    info: t.mock.fn(),
    success: t.mock.fn(),
    warning: t.mock.fn(),
  };
}

function createSelection(overrides = {}) {
  return {
    expectedSnapshotRevision: 3,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-2',
    title: 'United States edition',
    ...overrides,
  };
}

test('useManualEditionSelection persists a scoped edition and returns the refreshed projection', async (t) => {
  const selectManualEdition = t.mock.fn(async () => ({
    alreadySelected: false,
    projection: { artist: { id: 'artist-1' } },
  }));
  const toast = createToastDouble(t);
  const workflow = useManualEditionSelection({ selectManualEdition, toast });
  const selection = createSelection();

  const result = await workflow.selectEdition(selection);

  assert.deepEqual(selectManualEdition.mock.calls[0].arguments[0], {
    expectedSnapshotRevision: 3,
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-2',
  });
  assert.deepEqual(result, {
    alreadySelected: false,
    ok: true,
    projection: { artist: { id: 'artist-1' } },
  });
  assert.equal(workflow.isSelecting(selection), false);
  assert.match(toast.success.mock.calls[0].arguments[0], /Reconciliation queued/);
});

test('useManualEditionSelection suppresses duplicate work and cleans up failed work', async (t) => {
  let resolveSelection;
  const pending = new Promise((resolve) => { resolveSelection = resolve; });
  const selectManualEdition = t.mock.fn(async () => pending);
  const toast = createToastDouble(t);
  const workflow = useManualEditionSelection({ selectManualEdition, toast });
  const selection = createSelection();

  const first = workflow.selectEdition(selection);
  const duplicate = await workflow.selectEdition(selection);
  resolveSelection({ projection: null });
  await first;

  assert.deepEqual(duplicate, { ok: false, skipped: true, reason: 'selecting' });
  assert.equal(selectManualEdition.mock.callCount(), 1);

  const failure = new Error('edition unavailable');
  const errorWorkflow = useManualEditionSelection({
    selectManualEdition: async () => { throw failure; },
    toast,
  });
  const failedResult = await errorWorkflow.selectEdition(selection);
  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.error, failure);
  assert.equal(errorWorkflow.isSelecting(selection), false);
  assert.equal(toast.error.mock.callCount(), 1);
});
