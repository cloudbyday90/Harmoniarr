import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperatorArtistReconciliationSnapshotService,
  normalizeOperatorArtistReconciliationSnapshotPayload,
} from '../../src/server/metadata/operator-artist-reconciliation-snapshot-service.js';

test('normalizeOperatorArtistReconciliationSnapshotPayload requires a plain object', () => {
  assert.throws(
    () => normalizeOperatorArtistReconciliationSnapshotPayload(['not', 'valid']),
    {
      code: 'validation_error',
      message: 'snapshotPayload must be a plain object',
      status: 400,
    },
  );
});

test('saveOperatorArtistReconciliationSnapshot validates and persists an immutable snapshot', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1' }] };
    }

    return { rows: [] };
  });
  const createOperatorArtistReconciliationSnapshot = t.mock.fn(async () => ({
    appUserId: 'user-1',
    createdAt: '2026-05-25T12:10:00.000Z',
    id: 'snapshot-3',
    metadataArtistId: 'artist-1',
    snapshotPayload: { mode: 'save', selectedReleaseCount: 5 },
    snapshotRevision: 3,
    updatedAt: '2026-05-25T12:10:00.000Z',
  }));
  const service = createOperatorArtistReconciliationSnapshotService({
    getPoolFn: () => ({ query }),
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot,
      getLatestOperatorArtistReconciliationSnapshot: async () => null,
    },
  });

  const result = await service.saveOperatorArtistReconciliationSnapshot({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotPayload: {
      mode: 'save',
      selectedReleaseCount: 5,
    },
  });

  assert.deepEqual(createOperatorArtistReconciliationSnapshot.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotPayload: {
      mode: 'save',
      selectedReleaseCount: 5,
    },
  });
  assert.equal(result.snapshotRevision, 3);
});

test('saveOperatorArtistReconciliationSnapshot retries once on unique revision collision', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('FROM app_users')) {
      return { rows: [{ id: 'user-1' }] };
    }

    if (sql.includes('FROM metadata_artists')) {
      return { rows: [{ id: 'artist-1' }] };
    }

    return { rows: [] };
  });
  let attemptCount = 0;
  const createOperatorArtistReconciliationSnapshot = t.mock.fn(async () => {
    attemptCount += 1;
    if (attemptCount === 1) {
      const error = new Error('duplicate key value violates unique constraint');
      error.code = '23505';
      throw error;
    }

    return {
      appUserId: 'user-1',
      createdAt: '2026-05-25T12:10:05.000Z',
      id: 'snapshot-4',
      metadataArtistId: 'artist-1',
      snapshotPayload: { mode: 'save', selectedReleaseCount: 6 },
      snapshotRevision: 4,
      updatedAt: '2026-05-25T12:10:05.000Z',
    };
  });
  const service = createOperatorArtistReconciliationSnapshotService({
    getPoolFn: () => ({ query }),
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot,
      getLatestOperatorArtistReconciliationSnapshot: async () => null,
    },
  });

  const result = await service.saveOperatorArtistReconciliationSnapshot({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    snapshotPayload: {
      mode: 'save',
      selectedReleaseCount: 6,
    },
  });

  assert.equal(createOperatorArtistReconciliationSnapshot.mock.callCount(), 2);
  assert.equal(result.snapshotRevision, 4);
});

test('getLatestOperatorArtistReconciliationSnapshot rejects missing app users', async () => {
  const service = createOperatorArtistReconciliationSnapshotService({
    getPoolFn: () => ({
      query: async (sql) => {
        if (sql.includes('FROM app_users')) {
          return { rows: [] };
        }

        return { rows: [{ id: 'artist-1' }] };
      },
    }),
    operatorArtistReconciliationSnapshotStore: {
      createOperatorArtistReconciliationSnapshot: async () => null,
      getLatestOperatorArtistReconciliationSnapshot: async () => null,
    },
  });

  await assert.rejects(
    service.getLatestOperatorArtistReconciliationSnapshot({
      appUserId: 'missing-user',
      metadataArtistId: 'artist-1',
    }),
    {
      code: 'app_user_not_found',
      message: 'App user was not found: missing-user',
      status: 404,
    },
  );
});
