import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperatorReleaseReconciliationPresentation,
  buildOperatorReleaseSelectionPresentation,
  findMusicQueueReleaseForReleaseGroup,
} from '../../src/client/lib/operator-release-selection-presentation.js';

test('manual release selection presentation uses durable state rather than an action name', () => {
  assert.deepEqual(
    buildOperatorReleaseSelectionPresentation({
      selectionOrigin: 'manual_edition',
      selectionSource: 'manual',
      selectionState: 'selected',
    }),
    {
      detail: 'This edition was selected in Artist Detail.',
      label: 'Edition selected',
      tone: 'info',
    },
  );
  assert.deepEqual(
    buildOperatorReleaseSelectionPresentation({
      selectionOrigin: 'manual_inclusion',
      selectionSource: 'manual',
      selectionState: 'selected',
    }),
    {
      detail: 'This release was included from Missing Music.',
      label: 'Manual inclusion',
      tone: 'info',
    },
  );
  assert.deepEqual(
    buildOperatorReleaseSelectionPresentation({
      selectionSource: 'manual',
      selectionState: 'selected',
    }),
    {
      detail: 'This release was manually selected.',
      label: 'Manual selection',
      tone: 'info',
    },
  );
  assert.deepEqual(
    buildOperatorReleaseSelectionPresentation({
      selectionSource: 'manual',
      selectionState: 'partial',
    }),
    {
      detail: 'Tracks are selected manually for this release group.',
      label: 'Manual partial selection',
      tone: 'info',
    },
  );
  assert.equal(
    buildOperatorReleaseSelectionPresentation({
      selectionSource: 'policy',
      selectionState: 'selected',
    }),
    null,
  );
});

test('manual release reconciliation status explains queued, running, and failed work without promising a download', () => {
  const operatorState = { selectionSource: 'manual', selectionState: 'selected' };

  assert.deepEqual(
    buildOperatorReleaseReconciliationPresentation({
      operatorState,
      reconciliation: { status: 'queued' },
    }),
    {
      detail: 'Music Queue will update when reconciliation begins.',
      label: 'Latest save queued',
      tone: 'info',
    },
  );
  assert.deepEqual(
    buildOperatorReleaseReconciliationPresentation({
      operatorState,
      reconciliation: { status: 'running' },
    }),
    {
      detail: 'Reconciliation is preparing this saved selection for Music Queue.',
      label: 'Updating Music Queue',
      tone: 'info',
    },
  );
  assert.deepEqual(
    buildOperatorReleaseReconciliationPresentation({
      operatorState,
      reconciliation: { status: 'failed' },
    }),
    {
      detail: 'Use Retry reconciliation at the top of this page to try again.',
      label: 'Update did not finish',
      tone: 'danger',
    },
  );
  assert.equal(
    buildOperatorReleaseReconciliationPresentation({
      operatorState: { selectionSource: 'policy', selectionState: 'selected' },
      reconciliation: { status: 'queued' },
    }),
    null,
  );
});

test('Music Queue correlation uses the release-group identifier instead of title text', () => {
  const matchingRelease = {
    id: 'wanted-2',
    metadataReleaseGroupId: 'release-group-2',
    releaseTitle: 'Same title',
  };

  assert.equal(
    findMusicQueueReleaseForReleaseGroup([
      { id: 'wanted-1', metadataReleaseGroupId: 'release-group-1', releaseTitle: 'Same title' },
      matchingRelease,
    ], 'release-group-2'),
    matchingRelease,
  );
  assert.equal(findMusicQueueReleaseForReleaseGroup([matchingRelease], 'missing'), null);
  assert.equal(findMusicQueueReleaseForReleaseGroup([matchingRelease], ''), null);
});
