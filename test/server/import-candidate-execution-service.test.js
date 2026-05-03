import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
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
  const service = createImportCandidateExecutionService({
    createOperationRun,
    listImportCandidates,
    recordAuditEventFn,
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

test('startImportCandidateExecutionRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createImportCandidateExecutionService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents import candidate execution planning');
    },
  });

  await assert.rejects(
    () => service.startImportCandidateExecutionRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});