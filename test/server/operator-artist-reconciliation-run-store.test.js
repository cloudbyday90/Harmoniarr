import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';

test('createOperationRun stores reconciliation run summary', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      error_message: null,
      finished_at: null,
      id: 'run-1',
      operation_type: 'operator_artist_reconciliation',
      started_at: new Date('2026-05-25T13:00:00.000Z'),
      status: 'pending',
      summary: {
        appUserId: 'user-1',
        artistName: 'Autechre',
        metadataArtistId: 'artist-1',
        snapshotId: 'snapshot-1',
        snapshotRevision: 2,
        triggerSource: 'save',
      },
    }],
  }));
  const store = createOperatorArtistReconciliationRunStore({ getPoolFn: () => ({ query }) });

  const result = await store.createOperationRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-1',
    snapshotRevision: 2,
  });

  assert.equal(result.snapshotRevision, 2);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'operator_artist_reconciliation',
    'pending',
    null,
    '{"appUserId":"user-1","artistName":"Autechre","metadataArtistId":"artist-1","snapshotId":"snapshot-1","snapshotRevision":2,"triggerSource":"save"}',
    null,
    1,
  ]);
});

test('getActiveRunByOperatorArtist reads the active pending or running run', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      error_message: null,
      finished_at: null,
      id: 'run-1',
      started_at: new Date('2026-05-25T13:00:00.000Z'),
      status: 'running',
      summary: {
        appUserId: 'user-1',
        artistName: 'Autechre',
        metadataArtistId: 'artist-1',
        snapshotId: 'snapshot-2',
        snapshotRevision: 3,
        triggerSource: 'save',
      },
    }],
  }));
  const store = createOperatorArtistReconciliationRunStore({ getPoolFn: () => ({ query }) });

  const result = await store.getActiveRunByOperatorArtist({
    appUserId: 'user-1',
    metadataArtistId: 'artist-1',
  });

  assert.match(query.mock.calls[0].arguments[0], /summary->>'appUserId' = \$2/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'operator_artist_reconciliation',
    'user-1',
    'artist-1',
  ]);
  assert.equal(result.status, 'running');
  assert.equal(result.snapshotRevision, 3);
});
