import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createImportCandidateTranscodeService } from '../../src/server/import-candidates/import-candidate-transcode-service.js';

test('startImportCandidateTranscodeRun queues pending transcode orchestration for selected candidates', async (t) => {
  const createOperationRun = t.mock.fn(async () => ({
    id: 'transcode-run-1',
    requestedCandidateCount: 2,
    status: 'pending',
    transcodeCandidateFileCount: 2,
  }));
  const buildSelectedImportCandidateSummary = t.mock.fn(async () => ({
    selectedCandidates: [{
      executionStatus: {
        code: 'ready',
      },
      id: 'candidate-1',
    }, {
      executionStatus: {
        code: 'ready_with_warnings',
      },
      id: 'candidate-2',
    }],
  }));
  const previewImportCandidateApply = t.mock.fn(async ({ importCandidateId }) => ({
    files: importCandidateId === 'candidate-1'
      ? [{
        transcodePlan: {
          recommendedAction: 'transcode_candidate',
        },
      }]
      : [{
        transcodePlan: {
          recommendedAction: 'keep_original',
        },
      }, {
        transcodePlan: {
          recommendedAction: 'transcode_candidate',
        },
      }],
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createImportCandidateTranscodeService({
    buildSelectedImportCandidateSummary,
    createOperationRun,
    getActiveRun: async () => null,
    previewImportCandidateApply,
    recordAuditEventFn,
  });

  const result = await service.startImportCandidateTranscodeRun({
    requestMetadata: {
      ipAddress: '198.51.100.77',
      userAgent: 'HarmoniarrTranscodeServiceTest/1.0',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.deepEqual(buildSelectedImportCandidateSummary.mock.calls[0].arguments, [{
    limit: 250,
  }]);
  assert.equal(previewImportCandidateApply.mock.callCount(), 2);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments, [{
    requestedCandidateCount: 2,
    status: 'pending',
    transcodeCandidateFileCount: 2,
    triggeredByUserId: 'user-1',
  }]);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('startImportCandidateTranscodeRun rejects when no selected candidates exist', async () => {
  const service = createImportCandidateTranscodeService({
    buildSelectedImportCandidateSummary: async () => ({
      selectedCandidates: [],
    }),
  });

  await assert.rejects(
    () => service.startImportCandidateTranscodeRun(),
    (error) => error.code === 'import_candidate_transcode_not_ready',
  );
});

test('startImportCandidateTranscodeRun rejects when selected candidates have no transcode candidates', async () => {
  const service = createImportCandidateTranscodeService({
    buildSelectedImportCandidateSummary: async () => ({
      selectedCandidates: [{
        executionStatus: {
          code: 'ready',
        },
        id: 'candidate-1',
      }],
    }),
    previewImportCandidateApply: async () => ({
      files: [{
        transcodePlan: {
          recommendedAction: 'keep_original',
        },
      }],
    }),
  });

  await assert.rejects(
    () => service.startImportCandidateTranscodeRun(),
    (error) => error.code === 'import_candidate_transcode_no_candidates',
  );
});

test('startImportCandidateTranscodeRun rejects when maintenance lock blocks unsafe writes', async () => {
  const service = createImportCandidateTranscodeService({
    assertMaintenanceWriteAllowed: async () => {
      throw createApiError(409, 'recovery_lock_conflict', 'A conflicting maintenance lock prevents import candidate transcode orchestration');
    },
  });

  await assert.rejects(
    () => service.startImportCandidateTranscodeRun(),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
