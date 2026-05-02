import assert from 'node:assert/strict';
import test from 'node:test';
import { createArtworkCleanupRunService } from '../../src/server/artwork/artwork-cleanup-run-service.js';

test('startArtworkCleanupRun queues a cleanup run for eligible unassigned artwork', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'run-1',
    status: 'pending',
  }));
  const getArtworkCleanupSnapshotFn = t.mock.fn(async () => ({
    eligibleAssetCount: 3,
    oldestUnassignedAt: '2026-01-10T12:00:00.000Z',
    unassignedAssetCount: 5,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createArtworkCleanupRunService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
      }),
    },
    createOperationRun,
    getArtworkCleanupSnapshotFn,
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
    recordAuditEventFn,
  });

  const result = await service.startArtworkCleanupRun({
    requestMetadata: {
      ipAddress: '127.0.0.1',
      userAgent: 'artwork-test',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    requestedAssetCount: 3,
    retentionCutoff: '2026-01-31T12:00:00.000Z',
    status: 'pending',
    triggeredByUserId: 'user-1',
  }]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('startArtworkCleanupRun rejects when no cleanup candidates are retention-eligible', async () => {
  const service = createArtworkCleanupRunService({
    artworkPolicyService: {
      getArtworkRuntimePolicy: async () => ({
        cleanup: {
          unassignedRetentionDays: 90,
        },
      }),
    },
    getArtworkCleanupSnapshotFn: async () => ({
      eligibleAssetCount: 0,
      oldestUnassignedAt: '2026-04-25T12:00:00.000Z',
      unassignedAssetCount: 2,
    }),
    nowFn: () => new Date('2026-05-01T12:00:00.000Z'),
  });

  await assert.rejects(
    () => service.startArtworkCleanupRun(),
    (error) => error.code === 'artwork_cleanup_not_ready',
  );
});