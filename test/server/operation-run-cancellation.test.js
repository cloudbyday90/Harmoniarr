import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createOperationRunCancellationError,
  isOperationRunCancellationError,
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