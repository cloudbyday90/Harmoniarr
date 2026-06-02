import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';

test('operation queue store claims the next runnable run for the configured instance', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: '2026-05-01T02:05:00.000Z',
      claimed_by_instance_id: 'instance-a',
      error_message: null,
      finished_at: null,
      id: 'run-11',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T02:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T01:55:00.000Z',
      status: 'pending',
      summary: { libraryRoot: 'D:/music' },
      triggered_by_user_id: 'admin-1',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    claimOwnerInstanceId: 'instance-a',
    getPoolFn: () => ({ query }),
  });

  const run = await operationQueueStore.claimNextRunnableRun({
    operationTypes: ['library_scan', 'artwork_cleanup'],
  });

  assert.equal(query.mock.callCount(), 1);
  assert.match(query.mock.calls[0].arguments[0], /UPDATE operation_runs AS runs/);
  assert.match(query.mock.calls[0].arguments[0], /RETURNING\s+runs\.\*/);
  assert.match(query.mock.calls[0].arguments[0], /NOT EXISTS/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.operation_type = operation_runs\.operation_type/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.status = 'running'/);
  assert.match(query.mock.calls[0].arguments[0], /active_runs\.claimed_at > NOW\(\) - \(\$3 \* INTERVAL '1 millisecond'\)/);
  assert.deepEqual(query.mock.calls[0].arguments[1], [['library_scan', 'artwork_cleanup'], 'instance-a', 60000]);
  assert.deepEqual(run, {
    attemptCount: 1,
    cancelRequestedAt: null,
    cancelRequestedByUserId: null,
    cancelledAt: null,
    claimedAt: '2026-05-01T02:05:00.000Z',
    claimedByInstanceId: 'instance-a',
    errorMessage: null,
    finishedAt: null,
    id: 'run-11',
    maxAttempts: 2,
    nextAttemptAt: '2026-05-01T02:00:00.000Z',
    operationType: 'library_scan',
    startedAt: '2026-05-01T01:55:00.000Z',
    status: 'pending',
    summary: { libraryRoot: 'D:/music' },
    triggeredByUserId: 'admin-1',
  });
});

test('operation queue store can reschedule a run for retry and clear stale terminal state', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-12',
      max_attempts: 2,
      next_attempt_at: '2026-05-01T02:30:00.000Z',
      operation_type: 'artwork_cleanup',
      started_at: '2026-05-01T02:00:00.000Z',
      status: 'pending',
      summary: { requestedAssetCount: 9 },
      triggered_by_user_id: 'admin-3',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const run = await operationQueueStore.scheduleRetry({
    maxAttempts: 2,
    nextAttemptAt: '2026-05-01T02:30:00.000Z',
    runId: 'run-12',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['run-12', '2026-05-01T02:30:00.000Z', 2]);
  assert.equal(run.status, 'pending');
  assert.equal(run.maxAttempts, 2);
  assert.equal(run.nextAttemptAt, '2026-05-01T02:30:00.000Z');
});

test('operation queue store lists running runs for stranded-run recovery', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 2,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-31',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T03:00:00.000Z',
      operation_type: 'library_scan',
      started_at: '2026-05-01T02:00:00.000Z',
      status: 'running',
      summary: { libraryRoot: 'D:/music' },
      triggered_by_user_id: 'admin-1',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const runs = await operationQueueStore.listRecoverableRuns({
    limit: 50,
    operationTypes: ['library_scan'],
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [['library_scan'], 50]);
  assert.equal(runs[0].status, 'running');
  assert.equal(runs[0].attemptCount, 2);
});

test('operation queue store can reset a stranded running run back to pending', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 2,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-32',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T03:30:00.000Z',
      operation_type: 'artwork_cleanup',
      started_at: '2026-05-01T02:00:00.000Z',
      status: 'pending',
      summary: { recoveryReason: 'lease_expired' },
      triggered_by_user_id: 'admin-2',
    }],
  }));
  const operationQueueStore = createOperationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const run = await operationQueueStore.recoverRunForRetry({
    maxAttempts: 3,
    nextAttemptAt: '2026-05-01T03:30:00.000Z',
    runId: 'run-32',
    summary: {
      recoveryReason: 'lease_expired',
    },
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'run-32',
    JSON.stringify({ recoveryReason: 'lease_expired' }),
    '2026-05-01T03:30:00.000Z',
    3,
  ]);
  assert.equal(run.status, 'pending');
});
