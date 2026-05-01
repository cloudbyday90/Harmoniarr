import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateExecutionService } from '../../src/server/import-candidates/import-candidate-execution-service.js';

test('startImportCandidateExecutionRun queues a planning run for selected candidates', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'run-1',
    status: 'pending',
  }));
  const listImportCandidates = t.mock.fn(async () => ({
    pagination: {
      total: 2,
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const startWorkerRun = t.mock.fn(async () => {});
  const service = createImportCandidateExecutionService({
    createOperationRun,
    listImportCandidates,
    recordAuditEventFn,
    startWorkerRun,
  });

  const result = await service.startImportCandidateExecutionRun({
    requestMetadata: {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(listImportCandidates.mock.calls[0].arguments, [{
    limit: 1,
    offset: 0,
    status: 'selected',
  }]);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    executionMode: 'download_enqueue',
    requestedCandidateCount: 2,
    status: 'pending',
    triggeredByUserId: 'user-1',
  }]);
  assert.deepEqual(startWorkerRun.mock.calls[0].arguments, [{
    requestedCandidateCount: 2,
    runId: 'run-1',
  }]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('startImportCandidateExecutionRun rejects empty selected state', async () => {
  const service = createImportCandidateExecutionService({
    listImportCandidates: async () => ({
      pagination: { total: 0 },
    }),
  });

  await assert.rejects(
    () => service.startImportCandidateExecutionRun(),
    (error) => error.code === 'import_candidate_execution_not_ready',
  );
});