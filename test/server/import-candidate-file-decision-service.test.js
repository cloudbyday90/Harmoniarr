import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateFileDecisionService } from '../../src/server/import-candidates/import-candidate-file-decision-service.js';

function createMockPool() {
  return {
    connect: async () => ({
      query: async () => {},
      release: () => {},
    }),
  };
}

test('setImportCandidateFileSkipDecision persists a skip decision for colliding files', async (t) => {
  const upsertImportCandidateFileDecisionFn = t.mock.fn(async () => ({
    decisionType: 'skip',
    id: 'decision-1',
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    reason: 'Keep the library copy.',
  }));
  const insertImportCandidateEventFn = t.mock.fn(async () => ({
    eventType: 'import_candidate_file_skip_set',
  }));
  const recordAuditEventFn = t.mock.fn(async () => ({}));
  const service = createImportCandidateFileDecisionService({
    getImportCandidateByIdFn: async () => ({
      folderPath: 'Autechre/Amber',
      id: 'candidate-1',
      sourceProvider: 'slskd',
      sourceSearchId: 'search-1',
      status: 'import_pending',
    }),
    insertImportCandidateEventFn,
    listImportCandidateFilesFn: async () => ([{
      filename: '01 Foil.flac',
      id: 'file-1',
    }]),
    pool: createMockPool(),
    previewImportCandidateApply: async () => ({
      files: [{
        fileId: 'file-1',
        status: {
          code: 'collision',
        },
      }],
    }),
    recordAuditEventFn,
    upsertImportCandidateFileDecisionFn,
  });

  const result = await service.setImportCandidateFileSkipDecision({
    actorUserId: 'user-1',
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    reason: 'Keep the library copy.',
    requestMetadata: {
      ipAddress: '198.51.100.20',
      userAgent: 'DecisionServiceTest/1.0',
    },
  });

  assert.equal(result.decision.id, 'decision-1');
  assert.equal(upsertImportCandidateFileDecisionFn.mock.callCount(), 1);
  assert.equal(insertImportCandidateEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
});

test('setImportCandidateFileSkipDecision rejects non-collision files', async () => {
  const service = createImportCandidateFileDecisionService({
    pool: createMockPool(),
    previewImportCandidateApply: async () => ({
      files: [{
        fileId: 'file-1',
        status: {
          code: 'ready',
        },
      }],
    }),
  });

  await assert.rejects(
    () => service.setImportCandidateFileSkipDecision({
      importCandidateFileId: 'file-1',
      importCandidateId: 'candidate-1',
    }),
    (error) => error.code === 'import_candidate_file_skip_not_available',
  );
});