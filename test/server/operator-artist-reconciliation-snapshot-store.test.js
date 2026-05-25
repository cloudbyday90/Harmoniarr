import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorArtistReconciliationSnapshotStore,
} from '../../src/server/metadata/operator-artist-reconciliation-snapshot-store.js';

test('getLatestOperatorArtistReconciliationSnapshot returns the newest snapshot row', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      created_at: new Date('2026-05-25T12:05:00.000Z'),
      id: 'snapshot-2',
      metadata_artist_id: 'artist-1',
      snapshot_payload: { mode: 'save', selectedReleaseCount: 4 },
      snapshot_revision: '2',
      updated_at: new Date('2026-05-25T12:05:00.000Z'),
    }],
  }));
  const store = createOperatorArtistReconciliationSnapshotStore({ getPoolFn: () => ({ query }) });

  const result = await store.getLatestOperatorArtistReconciliationSnapshot({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.deepEqual(result, {
    appUserId: 'user-1',
    createdAt: '2026-05-25T12:05:00.000Z',
    id: 'snapshot-2',
    metadataArtistId: 'artist-1',
    snapshotPayload: { mode: 'save', selectedReleaseCount: 4 },
    snapshotRevision: 2,
    updatedAt: '2026-05-25T12:05:00.000Z',
  });
});

test('getLatestOperatorArtistReconciliationSnapshot returns null when no snapshot exists', async () => {
  const store = createOperatorArtistReconciliationSnapshotStore({
    getPoolFn: () => ({
      query: async () => ({ rows: [] }),
    }),
  });

  const result = await store.getLatestOperatorArtistReconciliationSnapshot({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.equal(result, null);
});

test('createOperatorArtistReconciliationSnapshot inserts the next revision and returns the created row', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      created_at: new Date('2026-05-25T12:10:00.000Z'),
      id: 'snapshot-3',
      metadata_artist_id: 'artist-1',
      snapshot_payload: { mode: 'save', selectedReleaseCount: 5 },
      snapshot_revision: '3',
      updated_at: new Date('2026-05-25T12:10:00.000Z'),
    }],
  }));
  const store = createOperatorArtistReconciliationSnapshotStore({ getPoolFn: () => ({ query }) });

  const result = await store.createOperatorArtistReconciliationSnapshot({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotPayload: { mode: 'save', selectedReleaseCount: 5 },
  });

  assert.match(
    query.mock.calls[0].arguments[0],
    /COALESCE\(MAX\(snapshot_revision\), 0\) \+ 1 AS snapshot_revision/,
  );
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'user-1',
    'artist-1',
    '{"mode":"save","selectedReleaseCount":5}',
  ]);
  assert.equal(result.snapshotRevision, 3);
});

test('listOperatorArtistReconciliationSnapshots filters by owner context when requested', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      app_user_id: 'user-1',
      created_at: new Date('2026-05-25T12:05:00.000Z'),
      id: 'snapshot-2',
      metadata_artist_id: 'artist-1',
      snapshot_payload: { mode: 'save' },
      snapshot_revision: '2',
      updated_at: new Date('2026-05-25T12:05:00.000Z'),
    }],
  }));
  const store = createOperatorArtistReconciliationSnapshotStore({ getPoolFn: () => ({ query }) });

  const result = await store.listOperatorArtistReconciliationSnapshots({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.match(query.mock.calls[0].arguments[0], /WHERE app_user_id = \$1 AND metadata_artist_id = \$2/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['user-1', 'artist-1']);
  assert.equal(result.length, 1);
});
