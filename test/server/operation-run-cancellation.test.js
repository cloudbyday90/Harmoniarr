import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationRunInterruptionGate,
  createOperationRunCancellationError,
  createOperationRunPauseError,
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../../src/server/operation-run-cancellation.js';

test('throwIfOperationRunCancellationRequested throws the shared cancellation error when requested', async () => {
  await assert.rejects(
    () => throwIfOperationRunCancellationRequested({
      isCancellationRequested: async () => true,
      runId: 'run-41',
    }),
    (error) => {
      assert.equal(isOperationRunCancellationError(error), true);
      assert.equal(error.runId, 'run-41');
      return true;
    },
  );
});

test('createOperationRunCancellationError produces the shared cancellable error shape', () => {
  const error = createOperationRunCancellationError({ runId: 'run-42' });

  assert.equal(error.code, 'operation_run_cancelled');
  assert.equal(error.runId, 'run-42');
});

test('throwIfOperationRunCancellationRequested throws the shared pause error when a maintenance pause is requested', async () => {
  await assert.rejects(
    () => throwIfOperationRunCancellationRequested({
      isCancellationRequested: async () => ({
        kind: 'paused',
        nextRetryAt: '2026-05-04T12:30:00.000Z',
        pauseCode: 'recovery_lock_conflict',
        pauseMessage: 'Library discovery is paused while the restore maintenance lock is active.',
        pauseProvider: 'restore',
      }),
      runId: 'run-52',
    }),
    (error) => {
      assert.equal(isOperationRunPauseError(error), true);
      assert.equal(error.runId, 'run-52');
      assert.equal(error.pauseCode, 'recovery_lock_conflict');
      assert.equal(error.pauseProvider, 'restore');
      assert.equal(error.nextRetryAt, '2026-05-04T12:30:00.000Z');
      return true;
    },
  );
});

test('createOperationRunInterruptionGate prefers operator cancellation over maintenance pause', async () => {
  const gate = createOperationRunInterruptionGate({
    isCancellationRequested: async () => true,
    operationLabel: 'Library discovery',
    operationPauseService: {
      resolveOperationReadiness: async () => ({
        allowed: false,
      }),
    },
  });

  assert.equal(await gate({ runId: 'run-53' }), true);
});

test('createOperationRunPauseError produces the shared pause error shape', () => {
  const error = createOperationRunPauseError({
    nextRetryAt: '2026-05-04T12:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseProvider: 'restore',
    runId: 'run-54',
  });

  assert.equal(error.code, 'operation_run_paused');
  assert.equal(error.nextRetryAt, '2026-05-04T12:30:00.000Z');
  assert.equal(error.pauseCode, 'recovery_lock_conflict');
  assert.equal(error.pauseProvider, 'restore');
  assert.equal(error.runId, 'run-54');
});