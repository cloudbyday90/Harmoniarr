import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createImportCandidateMediaInspectionService } from '../../src/server/import-candidates/import-candidate-media-inspection-service.js';

test('startImportCandidateMediaInspectionRun queues a pending media-inspection run for selected candidates', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'inspection-run-1',
    requestedCandidateCount: 3,
    status: 'pending',
  }));
  const listImportCandidates = t.mock.fn(async () => ({
    pagination: {
      total: 3,
    },
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createImportCandidateMediaInspectionService({
    createOperationRun,
    getActiveRun: async () => null,
    listImportCandidates,
    recordAuditEventFn,
  });

  const result = await service.startImportCandidateMediaInspectionRun({
    requestMetadata: {
      ipAddress: '198.51.100.77',
      userAgent: 'HarmoniarrMediaInspectionServiceTest/1.0',
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
    requestedCandidateCount: 3,
    status: 'pending',
    triggeredByUserId: 'user-1',
  }]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('startImportCandidateMediaInspectionRun rejects when no selected candidates exist', async () => {
  const service = createImportCandidateMediaInspectionService({
    listImportCandidates: async () => ({
      pagination: {
        total: 0,
      },
    }),
  });

  await assert.rejects(
    () => service.startImportCandidateMediaInspectionRun(),
    (error) => error.code === 'import_candidate_media_inspection_not_ready',
  );
});

test('startImportCandidateMediaInspectionRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createImportCandidateMediaInspectionService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents import candidate media inspection');
    },
  });

  await assert.rejects(
    () => service.startImportCandidateMediaInspectionRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
