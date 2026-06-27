import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseVisibilityStore } from '../../src/server/library/library-release-visibility-store.js';

test('setLibraryReleaseVisibility upserts operator-scoped release visibility', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      id: 'visibility-1',
      app_user_id: 'user-1',
      metadata_release_id: 'release-1',
      visibility_state: 'removed',
      reason: 'Not part of this operator library',
      removed_at: '2026-06-30T10:00:00.000Z',
      restored_at: null,
      updated_by_user_id: 'user-1',
      created_at: '2026-06-30T09:59:00.000Z',
      updated_at: '2026-06-30T10:00:00.000Z',
    }],
  }));
  const store = createLibraryReleaseVisibilityStore({ getPoolFn: () => ({ query }) });

  const result = await store.setLibraryReleaseVisibility({
    appUserId: 'user-1',
    metadataReleaseId: 'release-1',
    reason: 'Not part of this operator library',
    updatedByUserId: 'user-1',
    visibilityState: 'removed',
  });

  assert.match(query.mock.calls[0].arguments[0], /INSERT INTO operator_library_release_visibility/);
  assert.match(query.mock.calls[0].arguments[0], /ON CONFLICT \(app_user_id, metadata_release_id\) DO UPDATE/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'release-1',
    'removed',
    'Not part of this operator library',
    'user-1',
  ]);
  assert.deepEqual(result, {
    appUserId: 'user-1',
    createdAt: '2026-06-30T09:59:00.000Z',
    id: 'visibility-1',
    metadataReleaseId: 'release-1',
    reason: 'Not part of this operator library',
    removedAt: '2026-06-30T10:00:00.000Z',
    restoredAt: null,
    updatedAt: '2026-06-30T10:00:00.000Z',
    updatedByUserId: 'user-1',
    visibilityState: 'removed',
  });
});

test('getLibraryReleaseVisibilityTarget returns the reconciled library release identity', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      artist_name: 'Radiohead',
      metadata_artist_id: 'artist-1',
      metadata_release_group_id: 'rg-1',
      metadata_release_id: 'release-1',
      release_group_title: 'OK Computer',
      release_title: 'OK Computer',
    }],
  }));
  const store = createLibraryReleaseVisibilityStore({ getPoolFn: () => ({ query }) });

  const result = await store.getLibraryReleaseVisibilityTarget({ metadataReleaseId: 'release-1' });

  assert.match(query.mock.calls[0].arguments[0], /FROM library_release_reconciliations/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['release-1']);
  assert.deepEqual(result, {
    artistName: 'Radiohead',
    metadataArtistId: 'artist-1',
    metadataReleaseGroupId: 'rg-1',
    metadataReleaseId: 'release-1',
    releaseGroupTitle: 'OK Computer',
    releaseTitle: 'OK Computer',
  });
});
