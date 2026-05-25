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

test('queueLatestSnapshotRun creates a queued follow-up when a running run already exists', async (t) => {
  const query = t.mock.fn(async (sql, params = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rows: [] };
    }

    if (sql.includes('FROM operation_runs') && params[1] === 'running') {
      return {
        rows: [{
          error_message: null,
          finished_at: null,
          id: 'run-running',
          operation_type: 'operator_artist_reconciliation',
          started_at: new Date('2026-05-25T13:00:00.000Z'),
          status: 'running',
          summary: {
            appUserId: 'user-1',
            artistName: 'Autechre',
            metadataArtistId: 'artist-1',
            snapshotId: 'snapshot-2',
            snapshotRevision: 2,
            triggerSource: 'save',
          },
        }],
      };
    }

    if (sql.includes('FROM operation_runs') && params[1] === 'pending') {
      return { rows: [] };
    }

    if (sql.includes('INSERT INTO operation_runs')) {
      return {
        rows: [{
          error_message: null,
          finished_at: null,
          id: 'run-pending',
          operation_type: 'operator_artist_reconciliation',
          started_at: new Date('2026-05-25T13:01:00.000Z'),
          status: 'pending',
          summary: {
            appUserId: 'user-1',
            artistName: 'Autechre',
            metadataArtistId: 'artist-1',
            snapshotId: 'snapshot-4',
            snapshotRevision: 4,
            triggerSource: 'save',
          },
        }],
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const store = createOperatorArtistReconciliationRunStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release() {},
      }),
      query,
    }),
  });

  const result = await store.queueLatestSnapshotRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
  });

  assert.equal(result.action, 'queued_follow_up');
  assert.equal(result.runningRun?.id, 'run-running');
  assert.equal(result.run?.id, 'run-pending');
});

test('queueLatestSnapshotRun replaces an existing pending follow-up with the latest snapshot', async (t) => {
  const query = t.mock.fn(async (sql, params = []) => {
    if (sql === 'BEGIN' || sql === 'COMMIT') {
      return { rows: [] };
    }

    if (sql.includes('FROM operation_runs') && params[1] === 'running') {
      return {
        rows: [{
          error_message: null,
          finished_at: null,
          id: 'run-running',
          operation_type: 'operator_artist_reconciliation',
          started_at: new Date('2026-05-25T13:00:00.000Z'),
          status: 'running',
          summary: {
            appUserId: 'user-1',
            artistName: 'Autechre',
            metadataArtistId: 'artist-1',
            snapshotId: 'snapshot-2',
            snapshotRevision: 2,
            triggerSource: 'save',
          },
        }],
      };
    }

    if (sql.includes('FROM operation_runs') && params[1] === 'pending') {
      return {
        rows: [{
          error_message: null,
          finished_at: null,
          id: 'run-pending',
          operation_type: 'operator_artist_reconciliation',
          started_at: new Date('2026-05-25T13:00:30.000Z'),
          status: 'pending',
          summary: {
            appUserId: 'user-1',
            artistName: 'Autechre',
            metadataArtistId: 'artist-1',
            snapshotId: 'snapshot-3',
            snapshotRevision: 3,
            triggerSource: 'save',
          },
        }],
      };
    }

    if (sql.includes('UPDATE operation_runs')) {
      return {
        rows: [{
          error_message: null,
          finished_at: null,
          id: 'run-pending',
          operation_type: 'operator_artist_reconciliation',
          started_at: new Date('2026-05-25T13:02:00.000Z'),
          status: 'pending',
          summary: {
            appUserId: 'user-1',
            artistName: 'Autechre',
            metadataArtistId: 'artist-1',
            snapshotId: 'snapshot-4',
            snapshotRevision: 4,
            triggerSource: 'save',
          },
        }],
      };
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  });
  const store = createOperatorArtistReconciliationRunStore({
    getPoolFn: () => ({
      connect: async () => ({
        query,
        release() {},
      }),
      query,
    }),
  });

  const result = await store.queueLatestSnapshotRun({
    appUserId: 'user-1',
    artistName: 'Autechre',
    metadataArtistId: 'artist-1',
    snapshotId: 'snapshot-4',
    snapshotRevision: 4,
  });

  assert.equal(result.action, 'replaced_pending_follow_up');
  assert.equal(result.run?.snapshotRevision, 4);
  assert.equal(result.runningRun?.id, 'run-running');
});
