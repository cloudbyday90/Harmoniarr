import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';

test('replaceLibraryReleaseReconciliations replaces the current reconciliation projection in one transaction', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.replaceLibraryReleaseReconciliations({
    reconciliations: [{
      duplicateTrackCount: 0,
      evidence: {
        strategy: 'matched_track_coverage',
        trackCoverage: 1,
      },
      expectedTrackCount: 2,
      matchedFileCount: 2,
      matchedTrackCount: 2,
      metadataArtistId: 'artist-1',
      metadataReleaseGroupId: 'release-group-1',
      metadataReleaseId: 'release-1',
      missingTrackCount: 0,
      reconciliationStatus: 'complete',
    }],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /DELETE FROM library_release_reconciliations/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [['release-1']]);
  assert.match(query.mock.calls[2].arguments[0], /INSERT INTO library_release_reconciliations/);
  assert.deepEqual(query.mock.calls[2].arguments[1], [
    'artist-1',
    'release-group-1',
    'release-1',
    'complete',
    2,
    2,
    0,
    2,
    0,
    '{"strategy":"matched_track_coverage","trackCoverage":1}',
  ]);
  assert.equal(query.mock.calls[3].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});

test('replaceLibraryReleaseReconciliations clears the projection when no reconciliations remain', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const store = createLibraryReleaseReconciliationStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
  });

  await store.replaceLibraryReleaseReconciliations({
    reconciliations: [],
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.equal(query.mock.calls[1].arguments[0], 'DELETE FROM library_release_reconciliations');
  assert.equal(query.mock.calls[2].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
});