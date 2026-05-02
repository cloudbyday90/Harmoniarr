import assert from 'node:assert/strict';
import test from 'node:test';
import { createOperationsModule } from '../../src/server/operations-module.js';

test('createOperationsModule exposes shared operations history route dependencies', () => {
  const buildOperationHistory = () => {};
  const buildOperationRunDetail = () => {};
  const requestOperationRunCancellation = () => {};
  const requestOperationRunRetry = () => {};
  const operationHistoryService = {
    buildOperationHistory,
    buildOperationRunDetail,
  };
  const operationRunControlService = {
    requestOperationRunCancellation,
    requestOperationRunRetry,
  };

  const operationsModule = createOperationsModule({ operationHistoryService, operationRunControlService });

  assert.equal(operationsModule.operationHistoryService, operationHistoryService);
  assert.equal(operationsModule.operationRunControlService, operationRunControlService);
  assert.deepEqual(operationsModule.routeDependencies, {
    buildOperationHistory,
    buildOperationRunDetail,
    requestOperationRunCancellation,
    requestOperationRunRetry,
  });
});