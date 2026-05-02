import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkAssignmentService } from '../../src/server/artwork/artwork-assignment-service.js';

test('assignPreferredArtwork demotes other preferred assignments before upserting the new preferred asset', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const release = t.mock.fn(() => {});
  const refreshArtworkAssetAssignmentState = t.mock.fn(async () => []);
  const upsertArtworkAssignment = t.mock.fn(async (assignment) => ({
    id: 'assignment-1',
    ...assignment,
  }));
  const artworkAssignmentService = createArtworkAssignmentService({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
    refreshArtworkAssetAssignmentStateFn: refreshArtworkAssetAssignmentState,
    upsertArtworkAssignmentFn: upsertArtworkAssignment,
  });

  const assignment = await artworkAssignmentService.assignPreferredArtwork({
    artworkAssetId: 'asset-1',
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 0,
    sourceProvider: 'embedded',
    sourceReference: 'Cover (front)',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /UPDATE artwork_assignments/);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['library_file', 'file-1', 'front_cover', 'asset-1']);
  assert.equal(upsertArtworkAssignment.mock.callCount(), 1);
  assert.deepEqual(upsertArtworkAssignment.mock.calls[0].arguments[0], {
    artworkAssetId: 'asset-1',
    artworkRole: 'front_cover',
    isPreferred: true,
    observedAt: null,
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 0,
    sourceProvider: 'embedded',
    sourceReference: 'Cover (front)',
  });
  assert.deepEqual(refreshArtworkAssetAssignmentState.mock.calls[0].arguments, [['asset-1'], {
    query,
    release,
  }]);
  assert.equal(query.mock.calls[2].arguments[0], 'COMMIT');
  assert.equal(release.mock.callCount(), 1);
  assert.equal(assignment.id, 'assignment-1');
});

test('assignPreferredArtwork validates required identifiers and priority', async () => {
  const artworkAssignmentService = createArtworkAssignmentService({
    getPoolFn: () => ({
      connect: async () => {
        throw new Error('should not connect');
      },
    }),
  });

  await assert.rejects(
    () => artworkAssignmentService.assignPreferredArtwork({
      artworkAssetId: '',
      artworkRole: 'front_cover',
      ownerId: 'file-1',
      ownerType: 'library_file',
    }),
    { code: 'validation_error', status: 400 },
  );

  await assert.rejects(
    () => artworkAssignmentService.assignPreferredArtwork({
      artworkAssetId: 'asset-1',
      artworkRole: 'front_cover',
      ownerId: 'file-1',
      ownerType: 'library_file',
      priority: -1,
    }),
    { code: 'validation_error', status: 400 },
  );
});

test('reconcilePreferredArtwork keeps a better existing preferred assignment and stores the incoming source as non-preferred', async (t) => {
  const query = t.mock.fn(async (_sql) => (_sql.includes('DELETE FROM artwork_assignments')
    ? { rows: [] }
    : { rows: [] }));
  const release = t.mock.fn(() => {});
  const refreshArtworkAssetAssignmentState = t.mock.fn(async () => []);
  const upsertArtworkAssignment = t.mock.fn(async (assignment) => ({
    id: 'assignment-sidecar-1',
    ...assignment,
  }));
  const artworkAssignmentService = createArtworkAssignmentService({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
    listArtworkAssignmentsFn: async () => ([{
      artworkAssetId: 'asset-embedded-1',
      artworkRole: 'front_cover',
      createdAt: '2026-05-01T12:00:00.000Z',
      id: 'assignment-embedded-1',
      isPreferred: true,
      ownerId: 'file-1',
      ownerType: 'library_file',
      priority: 0,
      sourceProvider: 'embedded',
      sourceReference: 'Cover (front)',
    }]),
    refreshArtworkAssetAssignmentStateFn: refreshArtworkAssetAssignmentState,
    upsertArtworkAssignmentFn: upsertArtworkAssignment,
  });

  const result = await artworkAssignmentService.reconcilePreferredArtwork({
    artworkAssetId: 'asset-sidecar-1',
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 10,
    sourceProvider: 'sidecar',
    sourceReference: 'cover.jpg',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /DELETE FROM artwork_assignments/);
  assert.deepEqual(query.mock.calls[1].arguments[1], [
    'library_file',
    'file-1',
    'front_cover',
    'sidecar',
    'asset-sidecar-1',
  ]);
  assert.deepEqual(upsertArtworkAssignment.mock.calls[0].arguments[0], {
    artworkAssetId: 'asset-sidecar-1',
    artworkRole: 'front_cover',
    isPreferred: false,
    observedAt: null,
    ownerId: 'file-1',
    ownerType: 'library_file',
    priority: 10,
    sourceProvider: 'sidecar',
    sourceReference: 'cover.jpg',
  });
  assert.deepEqual(refreshArtworkAssetAssignmentState.mock.calls[0].arguments, [['asset-sidecar-1'], {
    query,
    release,
  }]);
  assert.equal(query.mock.calls.at(-1).arguments[0], 'COMMIT');
  assert.equal(result.promotedToPreferred, false);
  assert.equal(result.assignment.id, 'assignment-sidecar-1');
  assert.equal(release.mock.callCount(), 1);
});

test('clearArtworkSource removes stale source assignments and promotes the next-best remaining candidate', async (t) => {
  const query = t.mock.fn(async (_sql) => {
    if (_sql === 'BEGIN' || _sql === 'COMMIT' || _sql === 'ROLLBACK') {
      return { rows: [] };
    }

    if (_sql.includes('DELETE FROM artwork_assignments')) {
      return {
        rowCount: 1,
        rows: [{ artwork_asset_id: 'asset-embedded-1' }],
      };
    }

    return { rowCount: 1, rows: [] };
  });
  const release = t.mock.fn(() => {});
  const refreshArtworkAssetAssignmentState = t.mock.fn(async () => []);
  const artworkAssignmentService = createArtworkAssignmentService({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release,
      }),
    }),
    listArtworkAssignmentsFn: async () => ([{
      artworkAssetId: 'asset-sidecar-1',
      artworkRole: 'front_cover',
      createdAt: '2026-05-01T12:05:00.000Z',
      id: 'assignment-sidecar-1',
      isPreferred: false,
      ownerId: 'file-1',
      ownerType: 'library_file',
      priority: 10,
      sourceProvider: 'sidecar',
      sourceReference: 'cover.jpg',
    }]),
    refreshArtworkAssetAssignmentStateFn: refreshArtworkAssetAssignmentState,
  });

  const result = await artworkAssignmentService.clearArtworkSource({
    artworkRole: 'front_cover',
    ownerId: 'file-1',
    ownerType: 'library_file',
    sourceProvider: 'embedded',
  });

  assert.equal(query.mock.calls[0].arguments[0], 'BEGIN');
  assert.match(query.mock.calls[1].arguments[0], /DELETE FROM artwork_assignments/);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['library_file', 'file-1', 'front_cover', 'embedded']);
  assert.match(query.mock.calls[2].arguments[0], /UPDATE artwork_assignments/);
  assert.deepEqual(query.mock.calls[2].arguments[1], ['library_file', 'file-1', 'front_cover']);
  assert.match(query.mock.calls[3].arguments[0], /UPDATE artwork_assignments/);
  assert.deepEqual(query.mock.calls[3].arguments[1], ['library_file', 'file-1', 'front_cover', 'asset-sidecar-1']);
  assert.deepEqual(refreshArtworkAssetAssignmentState.mock.calls[0].arguments, [['asset-embedded-1'], {
    query,
    release,
  }]);
  assert.equal(query.mock.calls[4].arguments[0], 'COMMIT');
  assert.deepEqual(result, {
    clearedCount: 1,
    promotedArtworkAssetId: 'asset-sidecar-1',
  });
  assert.equal(release.mock.callCount(), 1);
});