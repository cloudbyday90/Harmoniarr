import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationService } from '../../src/server/metadata/operator-artist-reconciliation-service.js';

test('queueOperatorArtistReconciliation creates a new reconciliation run from the latest snapshot', async (t) => {
  const queueLatestSnapshotRun = t.mock.fn(async ({
    appUserId,
    artistName,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    triggerSource,
    triggeredByUserId,
  }) => ({
    runningRun: null,
    action: 'created',
    run: {
      appUserId,
      artistName,
      id: 'run-1',
      metadataArtistId,
      snapshotId,
      snapshotRevision,
      status: 'pending',
      triggerSource,
      triggeredByUserId,
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOperatorArtistReconciliationService({
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      id: 'snapshot-4',
      snapshotRevision: 4,
    }),
    getMetadataArtist: async () => ({
      artist: {
        id: 'artist-1',
        name: 'Autechre',
      },
    }),
    queueLatestSnapshotRun,
    recordAuditEventFn,
  });

  const result = await service.queueOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
    requestMetadata: {
      ipAddress: '203.0.113.2',
      userAgent: 'HarmoniarrTest/1.0',
    },
    triggeredByUserId: 'operator-1',
  });

  assert.deepEqual(queueLatestSnapshotRun.mock.calls[0].arguments[0], {
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
    triggerSource: 'save',
    triggeredByUserId: 'operator-1',
  });
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(result, {
    accepted: true,
    coalesced: false,
    queuedBehindRun: false,
    replacedPending: false,
    run: {
      appUserId: 'user-1',
      artistName: 'Autechre',
      id: 'run-1',
      metadataArtistId: 'artist-1',
      snapshotId: 'snapshot-4',
      snapshotRevision: 4,
      status: 'pending',
      triggerSource: 'save',
      triggeredByUserId: 'operator-1',
    },
    runningRun: null,
  });
});

test('queueOperatorArtistReconciliation queues a follow-up behind a running run', async (t) => {
  const queueLatestSnapshotRun = t.mock.fn(async () => ({
    action: 'queued_follow_up',
    run: {
      id: 'run-9b',
      metadataArtistId: 'artist-1',
      snapshotRevision: 4,
      status: 'pending',
    },
    runningRun: {
      id: 'run-9',
      metadataArtistId: 'artist-1',
      snapshotRevision: 2,
      status: 'running',
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOperatorArtistReconciliationService({
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      id: 'snapshot-4',
      snapshotRevision: 4,
    }),
    getMetadataArtist: async () => ({
      artist: {
        id: 'artist-1',
        name: 'Autechre',
      },
    }),
    queueLatestSnapshotRun,
    recordAuditEventFn,
  });

  const result = await service.queueOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.deepEqual(result, {
    accepted: true,
    coalesced: false,
    queuedBehindRun: true,
    replacedPending: false,
    run: {
      id: 'run-9b',
      metadataArtistId: 'artist-1',
      snapshotRevision: 4,
      status: 'pending',
    },
    runningRun: {
      id: 'run-9',
      metadataArtistId: 'artist-1',
      snapshotRevision: 2,
      status: 'running',
    },
  });
});

test('queueOperatorArtistReconciliation replaces an existing pending follow-up with the latest snapshot', async (t) => {
  const queueLatestSnapshotRun = t.mock.fn(async () => ({
    action: 'replaced_pending_follow_up',
    run: {
      id: 'run-pending',
      metadataArtistId: 'artist-1',
      snapshotRevision: 5,
      status: 'pending',
    },
    runningRun: {
      id: 'run-running',
      metadataArtistId: 'artist-1',
      snapshotRevision: 3,
      status: 'running',
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOperatorArtistReconciliationService({
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      id: 'snapshot-5',
      snapshotRevision: 5,
    }),
    getMetadataArtist: async () => ({
      artist: {
        id: 'artist-1',
        name: 'Autechre',
      },
    }),
    queueLatestSnapshotRun,
    recordAuditEventFn,
  });

  const result = await service.queueOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.equal(recordAuditEventFn.mock.callCount(), 0);
  assert.deepEqual(result, {
    accepted: true,
    coalesced: true,
    queuedBehindRun: true,
    replacedPending: true,
    run: {
      id: 'run-pending',
      metadataArtistId: 'artist-1',
      snapshotRevision: 5,
      status: 'pending',
    },
    runningRun: {
      id: 'run-running',
      metadataArtistId: 'artist-1',
      snapshotRevision: 3,
      status: 'running',
    },
  });
});

test('queueOperatorArtistReconciliation rejects requests without a saved snapshot', async () => {
  const service = createOperatorArtistReconciliationService({
    queueLatestSnapshotRun: async () => {
      throw new Error('should not create run');
    },
    getLatestOperatorArtistReconciliationSnapshot: async () => null,
    getMetadataArtist: async () => ({
      artist: {
        id: 'artist-1',
        name: 'Autechre',
      },
    }),
  });

  await assert.rejects(
    service.queueOperatorArtistReconciliation({
      appUserId: 'user-1',
      metadataArtistId: 'artist-1',
    }),
    {
      code: 'operator_artist_reconciliation_not_ready',
      message: 'No saved artist reconciliation snapshot is available yet for this operator and artist',
      status: 409,
    },
  );
});

test('queueOperatorArtistReconciliation rejects missing metadata artists', async () => {
  const service = createOperatorArtistReconciliationService({
    queueLatestSnapshotRun: async () => {
      throw new Error('should not create run');
    },
    getLatestOperatorArtistReconciliationSnapshot: async () => ({
      id: 'snapshot-4',
      snapshotRevision: 4,
    }),
    getMetadataArtist: async () => ({ artist: null }),
  });

  await assert.rejects(
    service.queueOperatorArtistReconciliation({
      appUserId: 'user-1',
      metadataArtistId: 'artist-missing',
    }),
    {
      code: 'metadata_artist_not_found',
      message: 'The requested metadata artist could not be found: artist-missing',
      status: 404,
    },
  );
});
