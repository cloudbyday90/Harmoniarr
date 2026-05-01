import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';

function createReadyApplyPreview(overrides = {}) {
  return {
    files: [{
      fileId: 'file-1',
      filename: '01 Foil.flac',
      libraryTarget: {
        exists: false,
        path: '/library/Autechre/Amber/01 Foil.flac',
      },
      sourceFile: {
        exists: true,
        path: '/downloads/Autechre/Amber/01 Foil.flac',
      },
      stagingTarget: {
        exists: false,
        path: '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
      },
      status: {
        code: 'ready',
        message: 'Ready for import apply.',
      },
    }],
    preview: {
      library: {
        root: '/library',
      },
      source: {
        resolvedFolderPath: '/downloads/Autechre/Amber',
      },
      staging: {
        root: '/staging',
      },
    },
    summary: {
      message: '1 file is ready for import apply.',
      status: 'ready',
    },
    ...overrides,
  };
}

test('applyImportCandidatePreview stages and finalizes ready files with exclusive move semantics', async (t) => {
  const copyFileFn = t.mock.fn(async () => {});
  const mkdirFn = t.mock.fn(async () => {});
  const recordImportOperationFn = t.mock.fn(async () => {});
  const removeFileFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    mkdirFn,
    recordImportOperationFn,
    removeFileFn,
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview(),
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
  });

  assert.equal(result.summary.appliedFileCount, 1);
  assert.equal(result.summary.failedFileCount, 0);
  assert.equal(result.summary.stagedFromSourceCount, 1);
  assert.equal(copyFileFn.mock.callCount(), 2);
  assert.deepEqual(copyFileFn.mock.calls[0].arguments, [
    '/downloads/Autechre/Amber/01 Foil.flac',
    '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    1,
  ]);
  assert.deepEqual(copyFileFn.mock.calls[1].arguments, [
    '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    '/library/Autechre/Amber/01 Foil.flac',
    1,
  ]);
  assert.equal(recordImportOperationFn.mock.callCount(), 2);
  assert.deepEqual(recordImportOperationFn.mock.calls[0].arguments[0], {
    destinationPath: '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    errorMessage: null,
    finishedAt: result.fileOperations[0].steps[0].status === 'applied' ? recordImportOperationFn.mock.calls[0].arguments[0].finishedAt : null,
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    operationType: 'move',
    position: 1,
    sourcePath: '/downloads/Autechre/Amber/01 Foil.flac',
    startedAt: recordImportOperationFn.mock.calls[0].arguments[0].startedAt,
    status: 'applied',
    stepType: 'stage',
    transport: 'copy_then_remove',
  });
  assert.deepEqual(recordImportOperationFn.mock.calls[1].arguments[0], {
    destinationPath: '/library/Autechre/Amber/01 Foil.flac',
    errorMessage: null,
    finishedAt: recordImportOperationFn.mock.calls[1].arguments[0].finishedAt,
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    operationType: 'move',
    position: 2,
    sourcePath: '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    startedAt: recordImportOperationFn.mock.calls[1].arguments[0].startedAt,
    status: 'applied',
    stepType: 'finalize',
    transport: 'copy_then_remove',
  });
  assert.equal(removeFileFn.mock.callCount(), 2);
  assert.equal(result.fileOperations[0].status, 'applied');
  assert.match(recordImportOperationFn.mock.calls[0].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[0].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('applyImportCandidatePreview stops after a file failure and records remaining files as not attempted', async (t) => {
  const recordImportOperationFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn: t.mock.fn(async (sourcePath, destinationPath) => {
      if (destinationPath.includes('/library/')) {
        throw new Error('Permission denied');
      }
    }),
    mkdirFn: async () => {},
    recordImportOperationFn,
    removeFileFn: async () => {},
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview({
      files: [
        createReadyApplyPreview().files[0],
        {
          ...createReadyApplyPreview().files[0],
          fileId: 'file-2',
          filename: '02 Montreal.flac',
          libraryTarget: {
            exists: false,
            path: '/library/Autechre/Amber/02 Montreal.flac',
          },
          sourceFile: {
            exists: true,
            path: '/downloads/Autechre/Amber/02 Montreal.flac',
          },
          stagingTarget: {
            exists: false,
            path: '/staging/import-candidates/candidate-1/Autechre/Amber/02 Montreal.flac',
          },
        },
      ],
    }),
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
  });

  assert.equal(result.summary.failedFileCount, 1);
  assert.equal(result.summary.notAttemptedCount, 1);
  assert.equal(result.fileOperations[0].status, 'failed');
  assert.equal(result.fileOperations[1].status, 'not_attempted');
  assert.equal(recordImportOperationFn.mock.callCount(), 3);
  assert.deepEqual(recordImportOperationFn.mock.calls[0].arguments[0], {
    destinationPath: '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    errorMessage: null,
    finishedAt: recordImportOperationFn.mock.calls[0].arguments[0].finishedAt,
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    operationType: 'move',
    position: 1,
    sourcePath: '/downloads/Autechre/Amber/01 Foil.flac',
    startedAt: recordImportOperationFn.mock.calls[0].arguments[0].startedAt,
    status: 'applied',
    stepType: 'stage',
    transport: 'copy_then_remove',
  });
  assert.deepEqual(recordImportOperationFn.mock.calls[1].arguments[0], {
    destinationPath: '/library/Autechre/Amber/01 Foil.flac',
    errorMessage: 'Permission denied',
    finishedAt: recordImportOperationFn.mock.calls[1].arguments[0].finishedAt,
    importCandidateFileId: 'file-1',
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    operationType: 'move',
    position: 2,
    sourcePath: '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    startedAt: recordImportOperationFn.mock.calls[1].arguments[0].startedAt,
    status: 'failed',
    stepType: 'finalize',
    transport: null,
  });
  assert.deepEqual(recordImportOperationFn.mock.calls[2].arguments[0], {
    destinationPath: '/staging/import-candidates/candidate-1/Autechre/Amber/02 Montreal.flac',
    errorMessage: 'The candidate apply run stopped after an earlier file failure.',
    finishedAt: recordImportOperationFn.mock.calls[2].arguments[0].finishedAt,
    importCandidateFileId: 'file-2',
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
    operationType: 'move',
    position: 3,
    sourcePath: '/downloads/Autechre/Amber/02 Montreal.flac',
    startedAt: recordImportOperationFn.mock.calls[2].arguments[0].startedAt,
    status: 'not_attempted',
    stepType: 'stage',
    transport: null,
  });
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[2].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[2].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('applyImportCandidatePreview rejects blocked previews before mutating files', async () => {
  const service = createImportCandidateApplyOperationService();

  await assert.rejects(
    () => service.applyImportCandidatePreview({
      applyPreview: createReadyApplyPreview({
        summary: {
          message: 'Collision review is required.',
          status: 'blocked',
        },
      }),
    }),
    (error) => error.code === 'import_candidate_apply_not_ready',
  );
});

test('applyImportCandidatePreview records skipped files and continues with ready files', async (t) => {
  const recordImportOperationFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn: t.mock.fn(async () => {}),
    mkdirFn: t.mock.fn(async () => {}),
    recordImportOperationFn,
    removeFileFn: t.mock.fn(async () => {}),
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview({
      files: [{
        ...createReadyApplyPreview().files[0],
        fileId: 'file-skip',
        filename: '00 Existing.flac',
        libraryTarget: {
          exists: true,
          path: '/library/Autechre/Amber/00 Existing.flac',
        },
        status: {
          code: 'skipped',
          message: 'The target library path already exists, and this file will be skipped during import apply by operator decision.',
        },
      }, createReadyApplyPreview().files[0]],
    }),
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
  });

  assert.equal(result.summary.appliedFileCount, 1);
  assert.equal(result.summary.skippedFileCount, 1);
  assert.equal(result.fileOperations[0].status, 'skipped');
  assert.equal(result.fileOperations[1].status, 'applied');
  assert.equal(recordImportOperationFn.mock.calls[0].arguments[0].status, 'skipped');
  assert.equal(recordImportOperationFn.mock.calls[0].arguments[0].stepType, 'stage');
});