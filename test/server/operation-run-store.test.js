import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';

test('operation run store delegates lease operations through the shared job lease store', async (t) => {
  const acquireLease = t.mock.fn(async () => ({}));
  const getLease = t.mock.fn(async () => ({ leaseKey: 'library_scan:run-5' }));
  const releaseLease = t.mock.fn(async () => ({}));
  const renewLease = t.mock.fn(async () => ({}));
  const createJobLeaseStoreFn = t.mock.fn(() => ({
    acquireLease,
    getLease,
    releaseLease,
    renewLease,
  }));
  const operationRunStore = createOperationRunStore({
    createJobLeaseStoreFn,
    operationType: 'library_scan',
  });

  await operationRunStore.acquireLease({ runId: 'run-5' });
  await operationRunStore.renewLease({ runId: 'run-5', status: 'running' });
  const lease = await operationRunStore.getLease({ runId: 'run-5' });
  await operationRunStore.releaseLease({ runId: 'run-5', status: 'completed' });

  assert.equal(createJobLeaseStoreFn.mock.callCount(), 1);
  assert.deepEqual(acquireLease.mock.calls[0].arguments, [{
    jobType: 'library_scan',
    leaseKey: 'library_scan:run-5',
  }]);
  assert.deepEqual(renewLease.mock.calls[0].arguments, [{
    leaseKey: 'library_scan:run-5',
    status: 'running',
  }]);
  assert.deepEqual(getLease.mock.calls[0].arguments, [{
    leaseKey: 'library_scan:run-5',
  }]);
  assert.deepEqual(releaseLease.mock.calls[0].arguments, [{
    leaseKey: 'library_scan:run-5',
    status: 'completed',
  }]);
  assert.equal(lease.leaseKey, 'library_scan:run-5');
});

test('operation run store can check and finalize shared cancellation state', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('SELECT cancel_requested_at')) {
      return {
        rows: [{ cancel_requested_at: '2026-05-01T00:02:00.000Z' }],
      };
    }

    return { rows: [] };
  });
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  const isCancellationRequested = await operationRunStore.isCancellationRequested({ runId: 'run-19' });
  await operationRunStore.markRunCancelled({
    runId: 'run-19',
    summary: {
      currentStep: 'Cancelled by operator',
    },
  });

  assert.equal(isCancellationRequested, true);
  assert.equal(query.mock.callCount(), 2);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['run-19', 'library_scan']);
  assert.deepEqual(query.mock.calls[1].arguments[1], ['run-19', JSON.stringify({ currentStep: 'Cancelled by operator' })]);
});

test('operation run store persists queue retry metadata when creating a run', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [{
      attempt_count: 0,
      cancel_requested_at: null,
      cancel_requested_by_user_id: null,
      cancelled_at: null,
      claimed_at: null,
      claimed_by_instance_id: null,
      error_message: null,
      finished_at: null,
      id: 'run-44',
      max_attempts: 3,
      next_attempt_at: '2026-05-01T04:00:00.000Z',
      started_at: '2026-05-01T03:59:00.000Z',
      status: 'pending',
      summary: { libraryRoot: 'D:/library' },
    }],
  }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  const run = await operationRunStore.createOperationRun({
    maxAttempts: 3,
    nextAttemptAt: '2026-05-01T04:00:00.000Z',
    summary: { libraryRoot: 'D:/library' },
  });

  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'library_scan',
    'pending',
    null,
    JSON.stringify({ libraryRoot: 'D:/library' }),
    '2026-05-01T04:00:00.000Z',
    3,
  ]);
  assert.equal(run.maxAttempts, 3);
  assert.equal(run.nextAttemptAt, '2026-05-01T04:00:00.000Z');
  assert.equal(run.attemptCount, 0);
});

test('operation run store reschedules failed attempts through the shared retry policy when retry budget remains', async (t) => {
  const query = t.mock.fn(async (sql) => {
    if (sql.includes('WHERE operation_type = $1') && sql.includes('AND id = $2')) {
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
          id: 'run-71',
          max_attempts: 3,
          next_attempt_at: '2026-05-01T00:00:00.000Z',
          started_at: '2026-05-01T00:00:00.000Z',
          status: 'running',
          summary: {},
        }],
      };
    }

    return { rows: [] };
  });
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
    retryPolicyService: {
      buildRetrySchedule: t.mock.fn(() => ({
        delayMs: 30000,
        nextAttemptAt: '2026-05-01T00:00:30.000Z',
        scheduledAt: '2026-05-01T00:00:00.000Z',
      })),
    },
  });

  await operationRunStore.markRunFailed({
    errorMessage: 'transient scan failure',
    runId: 'run-71',
    summary: {
      libraryRoot: 'D:/music',
    },
  });

  assert.equal(query.mock.callCount(), 2);
  assert.equal(query.mock.calls[1].arguments[1][0], 'run-71');
  assert.deepEqual(JSON.parse(query.mock.calls[1].arguments[1][1]), {
    currentStep: 'Automatic retry scheduled after failed attempt',
    lastFailureMessage: 'transient scan failure',
    libraryRoot: 'D:/music',
    retryScheduledAt: '2026-05-01T00:00:30.000Z',
  });
  assert.equal(query.mock.calls[1].arguments[1][2], '2026-05-01T00:00:30.000Z');
  assert.match(query.mock.calls[1].arguments[0], /SET status = 'pending'/);
  assert.match(query.mock.calls[1].arguments[0], /next_attempt_at = \$3::timestamptz/);
});

test('operation run store requeues a paused run without consuming retry budget', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.markRunPaused({
    nextAttemptAt: '2026-05-04T12:30:00.000Z',
    runId: 'run-81',
    summary: {
      currentStep: 'Library scan paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
    },
  });

  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments[1], [
    'run-81',
    JSON.stringify({
      currentStep: 'Library scan paused by maintenance lock',
      pauseCode: 'recovery_lock_conflict',
    }),
    '2026-05-04T12:30:00.000Z',
  ]);
  assert.match(query.mock.calls[0].arguments[0], /attempt_count = GREATEST\(attempt_count - 1, 0\)/);
  assert.match(query.mock.calls[0].arguments[0], /status IN \('pending', 'running'\)/);
});

test('operation run store pruneOldRuns deletes finished runs beyond the retain count', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 10 });

  assert.equal(query.mock.callCount(), 1);
  const [sql, params] = query.mock.calls[0].arguments;
  assert.match(sql, /DELETE FROM operation_runs/);
  assert.match(sql, /status IN \('completed', 'failed', 'cancelled'\)/);
  assert.match(sql, /LIMIT \$2/);
  assert.deepEqual(params, ['library_scan', 10]);
});

test('operation run store pruneOldRuns uses default retain count of 20 when none supplied', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns();

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 20]);
});

test('operation run store pruneOldRuns clamps retainCount to at least 1', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 0 });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 1]);
});

test('operation run store pruneOldRuns clamps retainCount to at most 1000', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const operationRunStore = createOperationRunStore({
    getPoolFn: () => ({ query }),
    operationType: 'library_scan',
  });

  await operationRunStore.pruneOldRuns({ retainCount: 9999 });

  assert.deepEqual(query.mock.calls[0].arguments[1], ['library_scan', 1000]);
});