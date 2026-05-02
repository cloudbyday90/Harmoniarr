import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';

test('operation run control service records a durable cancellation request for a running run', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('WHERE id = $1') && sql.includes('LIMIT 1')) {
      return {
        rows: [{
          attempt_count: 1,
          cancel_requested_at: null,
          cancel_requested_by_user_id: null,
          cancelled_at: null,
          claimed_at: null,
          claimed_by_instance_id: null,
          error_message: null,
          finished_at: null,
          id: 'run-8',
          max_attempts: 1,
          next_attempt_at: '2026-05-01T00:00:00.000Z',
          operation_type: 'library_scan',
          started_at: '2026-05-01T00:00:00.000Z',
          status: 'running',
          summary: {},
          triggered_by_user_id: 'user-1',
        }],
      };
    }

    return {
      rows: [{
        attempt_count: 1,
        cancel_requested_at: '2026-05-01T00:03:00.000Z',
        cancel_requested_by_user_id: 'admin-2',
        cancelled_at: null,
        claimed_at: null,
        claimed_by_instance_id: null,
        error_message: null,
        finished_at: null,
        id: 'run-8',
        max_attempts: 1,
        next_attempt_at: '2026-05-01T00:00:00.000Z',
        operation_type: 'library_scan',
        started_at: '2026-05-01T00:00:00.000Z',
        status: 'running',
        summary: {},
        triggered_by_user_id: 'user-1',
      }],
    };
  });
  const service = createOperationRunControlService({
    getPoolFn: () => ({ query }),
  });

  const run = await service.requestOperationRunCancellation({
    requestedByUserId: 'admin-2',
    runId: 'run-8',
  });

  assert.equal(query.mock.callCount(), 2);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['run-8', 'admin-2']);
  assert.equal(run.cancelRequestedByUserId, 'admin-2');
  assert.equal(run.cancelledAt, null);
});

test('operation run control service reschedules a failed run for retry through the shared queue store', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 1,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: 'boom',
      finished_at: '2026-05-01T02:00:00.000Z',
      id: 'run-44',
      max_attempts: 1,
      next_attempt_at: '2026-05-01T01:00:00.000Z',
      operation_type: 'artwork_cleanup',
      started_at: '2026-05-01T01:55:00.000Z',
      status: 'failed',
      summary: { requestedAssetCount: 5 },
      triggered_by_user_id: 'user-1',
    }],
  }));
  const scheduleRetry = t.mock.fn(async ({ maxAttempts, runId }) => ({
    attemptCount: 1,
    cancelRequestedAt: null,
    cancelRequestedByUserId: null,
    cancelledAt: null,
    claimedAt: null,
    claimedByInstanceId: null,
    errorMessage: null,
    finishedAt: null,
    id: runId,
    maxAttempts,
    nextAttemptAt: '2026-05-01T03:00:00.000Z',
    operationType: 'artwork_cleanup',
    startedAt: '2026-05-01T01:55:00.000Z',
    status: 'pending',
    summary: { requestedAssetCount: 5 },
    triggeredByUserId: 'user-1',
  }));
  const service = createOperationRunControlService({
    getPoolFn: () => ({ query }),
    operationQueueStore: {
      scheduleRetry,
    },
  });

  const run = await service.requestOperationRunRetry({
    requestedByUserId: 'admin-2',
    runId: 'run-44',
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(scheduleRetry.mock.calls[0].arguments, [{
    maxAttempts: 2,
    runId: 'run-44',
  }]);
  assert.equal(run.status, 'pending');
  assert.equal(run.maxAttempts, 2);
});

test('operation run control service rejects cancellation when a run already has a pending cancellation request', async () => {
  const service = createOperationRunControlService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          attempt_count: 1,
          cancel_requested_at: '2026-05-01T00:02:00.000Z',
          cancel_requested_by_user_id: 'admin-1',
          cancelled_at: null,
          claimed_at: null,
          claimed_by_instance_id: null,
          error_message: null,
          finished_at: null,
          id: 'run-90',
          max_attempts: 2,
          next_attempt_at: '2026-05-01T00:00:00.000Z',
          operation_type: 'library_scan',
          started_at: '2026-05-01T00:00:00.000Z',
          status: 'running',
          summary: {},
          triggered_by_user_id: 'user-1',
        }],
      }),
    }),
  });

  await assert.rejects(
    () => service.requestOperationRunCancellation({
      requestedByUserId: 'admin-2',
      runId: 'run-90',
    }),
    (error) => error?.code === 'operation_run_not_cancellable',
  );
});

test('operation run control service rejects retry when a run is queued again already', async () => {
  const scheduleRetry = async () => {
    throw new Error('scheduleRetry should not be called');
  };
  const service = createOperationRunControlService({
    getPoolFn: () => ({
      query: async () => ({
        rows: [{
          attempt_count: 2,
          cancel_requested_at: null,
          cancel_requested_by_user_id: null,
          cancelled_at: null,
          claimed_at: null,
          claimed_by_instance_id: null,
          error_message: null,
          finished_at: null,
          id: 'run-91',
          max_attempts: 3,
          next_attempt_at: '2026-05-01T01:00:00.000Z',
          operation_type: 'artwork_cleanup',
          started_at: '2026-05-01T00:55:00.000Z',
          status: 'pending',
          summary: { requestedAssetCount: 2 },
          triggered_by_user_id: 'user-1',
        }],
      }),
    }),
    operationQueueStore: {
      scheduleRetry,
    },
  });

  await assert.rejects(
    () => service.requestOperationRunRetry({
      requestedByUserId: 'admin-2',
      runId: 'run-91',
    }),
    (error) => error?.code === 'operation_run_not_retryable',
  );
});