import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createImportCandidateApplyService } from '../../src/server/import-candidates/import-candidate-apply-service.js';

test('startImportCandidateApplyRun queues a run for ready import-pending candidates', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'run-apply-1',
    status: 'pending',
  }));
  const buildImportPendingCandidateSummary = t.mock.fn(async () => ({
    counts: {
      blocked: 1,
      ready: 1,
      readyWithWarnings: 1,
      totalImportPending: 3,
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyService({
    buildImportPendingCandidateSummary,
    createOperationRun,
    recordAuditEventFn,
  });

  const result = await service.startImportCandidateApplyRun({
    requestMetadata: {
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(buildImportPendingCandidateSummary.mock.calls[0].arguments, [{ limit: 1000 }]);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    executableCandidateCount: 2,
    executionMode: 'move',
    requestedCandidateCount: 3,
    status: 'pending',
    triggeredByUserId: 'user-1',
  }]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('startImportCandidateApplyRun rejects when nothing import-pending is executable', async () => {
  const service = createImportCandidateApplyService({
    buildImportPendingCandidateSummary: async () => ({
      counts: {
        blocked: 2,
        ready: 0,
        readyWithWarnings: 0,
        totalImportPending: 2,
      },
    }),
  });

  await assert.rejects(
    () => service.startImportCandidateApplyRun(),
    (error) => error.code === 'import_candidate_apply_not_ready',
  );
});

test('startImportCandidateApplyRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createImportCandidateApplyService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents import candidate apply');
    },
  });

  await assert.rejects(
    () => service.startImportCandidateApplyRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});