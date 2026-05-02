import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationStrandedRunRecoveryService } from '../../src/server/operation-stranded-run-recovery-service.js';

test('operation stranded run recovery retries running work whose lease has expired', async (t) => {
  const releaseLease = t.mock.fn(async () => ({}));
  const recoverRunForRetry = t.mock.fn(async () => ({
    id: 'run-81',
    status: 'pending',
  }));
  const service = createOperationStrandedRunRecoveryService({
    jobLeaseStore: {
      listLeases: t.mock.fn(async () => [{
        leaseKey: 'library_scan:run-81',
        state: 'expired',
      }]),
      releaseLease,
    },
    nowFn: () => new Date('2026-05-01T04:00:00.000Z'),
    operationQueueStore: {
      listRecoverableRuns: t.mock.fn(async () => [{
        attemptCount: 1,
        id: 'run-81',
        maxAttempts: 3,
        operationType: 'library_scan',
      }]),
      markStrandedRunFailed: t.mock.fn(async () => null),
      recoverRunForRetry,
    },
    retryPolicyService: {
      buildRetrySchedule: t.mock.fn(() => ({
        delayMs: 30000,
        nextAttemptAt: '2026-05-01T04:00:30.000Z',
        scheduledAt: '2026-05-01T04:00:00.000Z',
      })),
    },
  });

  const result = await service.recoverStrandedRuns({
    operationTypes: ['library_scan'],
  });

  assert.deepEqual(releaseLease.mock.calls[0].arguments[0], {
    leaseKey: 'library_scan:run-81',
    status: 'expired',
  });
  assert.deepEqual(recoverRunForRetry.mock.calls[0].arguments[0], {
    maxAttempts: 3,
    nextAttemptAt: '2026-05-01T04:00:30.000Z',
    runId: 'run-81',
    summary: {
      currentStep: 'Automatic retry scheduled after stranded run recovery',
      lastFailureMessage: 'Worker lease expired during stranded run recovery',
      recoveryDetectedAt: '2026-05-01T04:00:00.000Z',
      recoveryReason: 'lease_expired',
      retryScheduledAt: '2026-05-01T04:00:30.000Z',
    },
  });
  assert.deepEqual(result, {
    activeLeaseCount: 0,
    failedCount: 0,
    retriedCount: 1,
    scannedCount: 1,
    skipped: false,
  });
});

test('operation stranded run recovery fails exhausted running work with a missing lease', async (t) => {
  const markStrandedRunFailed = t.mock.fn(async () => ({
    id: 'run-82',
    status: 'failed',
  }));
  const service = createOperationStrandedRunRecoveryService({
    jobLeaseStore: {
      listLeases: t.mock.fn(async () => []),
      releaseLease: t.mock.fn(async () => ({})),
    },
    nowFn: () => new Date('2026-05-01T04:05:00.000Z'),
    operationQueueStore: {
      listRecoverableRuns: t.mock.fn(async () => [{
        attemptCount: 3,
        id: 'run-82',
        maxAttempts: 3,
        operationType: 'artwork_cleanup',
      }]),
      markStrandedRunFailed,
      recoverRunForRetry: t.mock.fn(async () => null),
    },
    retryPolicyService: {
      buildRetrySchedule: t.mock.fn(() => null),
    },
  });

  const result = await service.recoverStrandedRuns();

  assert.deepEqual(markStrandedRunFailed.mock.calls[0].arguments[0], {
    errorMessage: 'Worker lease was missing during stranded run recovery',
    runId: 'run-82',
    summary: {
      currentStep: 'Stranded run recovery marked the run as failed',
      recoveryDetectedAt: '2026-05-01T04:05:00.000Z',
      recoveryReason: 'lease_missing',
    },
  });
  assert.deepEqual(result, {
    activeLeaseCount: 0,
    failedCount: 1,
    retriedCount: 0,
    scannedCount: 1,
    skipped: false,
  });
});