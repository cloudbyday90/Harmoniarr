import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';

test('getOperatorReleaseGroupSelection returns stored selection state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      id: 'selection-1',
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'release-group-1',
      resolved_metadata_release_id: 'release-1',
      selection_source: 'manual',
      selection_state: 'partial',
    }],
  }));
  const store = createOperatorReleaseGroupSelectionStore({ getPoolFn: () => ({ query }) });

  const result = await store.getOperatorReleaseGroupSelection({
    appUserId: 'user-1',
    metadataReleaseGroupId: 'release-group-1',
  });

  assert.deepEqual(result, {
    appUserId: 'user-1',
    id: 'selection-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    resolvedMetadataReleaseId: 'release-1',
    selectionSource: 'manual',
    selectionState: 'partial',
  });
});

test('getOperatorReleaseGroupSelection returns null when no row exists', async () => {
  const store = createOperatorReleaseGroupSelectionStore({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
  });

  const result = await store.getOperatorReleaseGroupSelection({
    appUserId: 'user-1',
    metadataReleaseGroupId: 'release-group-1',
  });

  assert.equal(result, null);
});

test('upsertOperatorReleaseGroupSelection stores the selection policy', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createOperatorReleaseGroupSelectionStore({ getPoolFn: () => ({ query }) });

  await store.upsertOperatorReleaseGroupSelection({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'release-group-1',
    resolvedMetadataReleaseId: 'release-1',
    selectionSource: 'policy',
    selectionState: 'selected',
  });

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO operator_release_group_selection/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'artist-1',
    'release-group-1',
    'selected',
    'release-1',
    'policy',
  ]);
});

test('listOperatorReleaseGroupSelections filters by operator and artist when requested', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      id: 'selection-1',
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'release-group-1',
      resolved_metadata_release_id: 'release-1',
      selection_source: 'manual',
      selection_state: 'selected',
    }],
  }));
  const store = createOperatorReleaseGroupSelectionStore({ getPoolFn: () => ({ query }) });

  const result = await store.listOperatorReleaseGroupSelections({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.match(query.mock.calls[0].arguments[0], /WHERE app_user_id = \$1 AND metadata_artist_id = \$2/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['user-1', 'artist-1']);
  assert.equal(result.length, 1);
  assert.equal(result[0].selectionState, 'selected');
});

test('replaceOperatorReleaseGroupSelectionsSnapshot replaces the backup snapshot transactionally', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const connect = t.mock.fn(async () => ({ query, release }));
  const store = createOperatorReleaseGroupSelectionStore({
    getPoolFn: () => ({ connect }),
  });

  await store.replaceOperatorReleaseGroupSelectionsSnapshot({
    operatorReleaseGroupSelections: [{
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      resolvedMetadataReleaseId: 'release-1',
      selectionSource: 'manual',
      selectionState: 'partial',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls[1].arguments[0], 'DELETE FROM operator_release_group_selection');
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO operator_release_group_selection/);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'user-1',
    'artist-1',
    'release-group-1',
    'partial',
    'release-1',
    'manual',
  ]);
  assert.equal(release.mock.callCount(), 1);
});
