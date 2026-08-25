import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getManualSelectionLabel,
  useManualReleaseInclusion,
} from '../../src/client/composables/useManualReleaseInclusion.js';

function createToastDouble(t) {
  return {
    dismiss: t.mock.fn(),
    error: t.mock.fn(),
    info: t.mock.fn(),
    success: t.mock.fn(),
    warning: t.mock.fn(),
  };
}

function createRelease(overrides = {}) {
  return {
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
    selectionSource: 'policy',
    selectionState: 'selected',
    title: 'Test Album',
    ...overrides,
  };
}

test('useManualReleaseInclusion submits the complete scoped identity and retains local success state', async (t) => {
  const includeReleaseManually = t.mock.fn(async () => ({ alreadyIncluded: false }));
  const toast = createToastDouble(t);
  const workflow = useManualReleaseInclusion({ includeReleaseManually, toast });
  const release = createRelease();

  const result = await workflow.includeManually(release);

  assert.deepEqual(includeReleaseManually.mock.calls[0].arguments[0], {
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    metadataReleaseId: 'release-1',
  });
  assert.deepEqual(result, { ok: true, alreadyIncluded: false });
  assert.equal(workflow.isManualSelection(release), true);
  assert.equal(workflow.isIncluding(release), false);
  assert.match(toast.success.mock.calls[0].arguments[0], /Reconciliation queued/);
});

test('useManualReleaseInclusion prevents duplicate work and surfaces failures', async (t) => {
  const toast = createToastDouble(t);
  const error = new Error('manual inclusion unavailable');
  const workflow = useManualReleaseInclusion({
    includeReleaseManually: async () => { throw error; },
    toast,
  });
  const release = createRelease();

  const result = await workflow.includeManually(release);

  assert.equal(result.ok, false);
  assert.equal(result.error, error);
  assert.equal(workflow.isIncluding(release), false);
  assert.equal(workflow.isManualSelection(release), false);
  assert.equal(toast.error.mock.callCount(), 1);
});

test('useManualReleaseInclusion does not offer manual inclusion for an existing manual selection', async (t) => {
  const includeReleaseManually = t.mock.fn();
  const workflow = useManualReleaseInclusion({
    includeReleaseManually,
    toast: createToastDouble(t),
  });
  const release = createRelease({ selectionSource: 'manual', selectionState: 'partial' });

  const result = await workflow.includeManually(release);

  assert.equal(workflow.canIncludeManually(release), false);
  assert.deepEqual(result, { ok: true, skipped: true, reason: 'already_included' });
  assert.equal(includeReleaseManually.mock.callCount(), 0);
  assert.equal(getManualSelectionLabel(release), 'Manual partial selection');
});
