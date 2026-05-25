import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationService } from '../../src/server/metadata/operator-artist-reconciliation-service.js';

test('queueOperatorArtistReconciliation creates a new reconciliation run from the latest snapshot', async (t) => {
  const createOperationRun = t.mock.fn(async ({
    appUserId,
    artistName,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    triggerSource,
    triggeredByUserId,
  }) => ({
    appUserId,
    artistName,
    id: 'run-1',
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    status: 'pending',
    triggerSource,
    triggeredByUserId,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOperatorArtistReconciliationService({
    createOperationRun,
    getActiveRunByOperatorArtist: async () => null,
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

  assert.deepEqual(createOperationRun.mock.calls[0].arguments[0], {
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
  });
});

test('queueOperatorArtistReconciliation coalesces onto an existing active run', async (t) => {
  const createOperationRun = t.mock.fn(async () => {
    throw new Error('should not create run');
  });
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createOperatorArtistReconciliationService({
    createOperationRun,
    getActiveRunByOperatorArtist: async () => ({
      id: 'run-9',
      metadataArtistId: 'artist-1',
      snapshotRevision: 2,
      status: 'running',
    }),
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
    recordAuditEventFn,
  });

  const result = await service.queueOperatorArtistReconciliation({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.equal(createOperationRun.mock.callCount(), 0);
  assert.equal(recordAuditEventFn.mock.callCount(), 0);
  assert.deepEqual(result, {
    accepted: true,
    coalesced: true,
    run: {
      id: 'run-9',
      metadataArtistId: 'artist-1',
      snapshotRevision: 2,
      status: 'running',
    },
  });
});

test('queueOperatorArtistReconciliation rejects requests without a saved snapshot', async () => {
  const service = createOperatorArtistReconciliationService({
    createOperationRun: async () => {
      throw new Error('should not create run');
    },
    getActiveRunByOperatorArtist: async () => null,
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
    createOperationRun: async () => {
      throw new Error('should not create run');
    },
    getActiveRunByOperatorArtist: async () => null,
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
