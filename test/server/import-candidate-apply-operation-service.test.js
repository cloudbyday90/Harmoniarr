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
      transcodePlan: {
        mode: 'planning_only',
        recommendedAction: 'keep_original',
      },
    }],
    preview: {
      library: {
        root: '/library',
        reusePolicy: {
          sameVolumeLinkMode: 'prefer_hardlink',
        },
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

function createMissingPathError(pathValue) {
  const error = new Error(`ENOENT: no such file or directory, stat '${pathValue}'`);
  error.code = 'ENOENT';
  return error;
}

function createSimulatedFilesystemDeps(t, {
  additionalPaths = [],
  failLibraryCopy = false,
  failLibraryLink = false,
  libraryDevice = 7,
  sourceDevice = 7,
  stagingDevice = 7,
} = {}) {
  const paths = new Map([
    ['/downloads', { dev: sourceDevice, ino: 1, size: 0 }],
    ['/downloads/Autechre', { dev: sourceDevice, ino: 2, size: 0 }],
    ['/downloads/Autechre/Amber', { dev: sourceDevice, ino: 3, size: 0 }],
    ['/downloads/Autechre/Amber/01 Foil.flac', { dev: sourceDevice, ino: 11, size: 42 }],
    ['/downloads/Autechre/Amber/02 Montreal.flac', { dev: sourceDevice, ino: 12, size: 84 }],
    ['/staging', { dev: stagingDevice, ino: 20, size: 0 }],
    ['/library', { dev: libraryDevice, ino: 30, size: 0 }],
    ...additionalPaths,
  ]);
  let nextInode = 100;

  function resolveParentDevice(pathValue) {
    const segments = pathValue.split('/').filter(Boolean);
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const candidate = `/${segments.slice(0, index).join('/')}`;
      if (paths.has(candidate)) {
        return paths.get(candidate).dev;
      }
    }

    return libraryDevice;
  }

  function ensureDirectory(pathValue) {
    const segments = pathValue.split('/').filter(Boolean);
    let currentPath = '';
    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`;
      if (!paths.has(currentPath)) {
        paths.set(currentPath, {
          dev: resolveParentDevice(currentPath),
          ino: nextInode += 1,
          size: 0,
        });
      }
    }
  }

  const mkdirFn = t.mock.fn(async (pathValue) => {
    ensureDirectory(pathValue);
  });
  const copyFileFn = t.mock.fn(async (sourcePath, destinationPath) => {
    if (failLibraryCopy && destinationPath.startsWith('/library/')) {
      throw new Error('Permission denied');
    }

    const sourceStats = paths.get(sourcePath);
    paths.set(destinationPath, {
      dev: resolveParentDevice(destinationPath),
      ino: nextInode += 1,
      size: sourceStats.size,
    });
  });
  const linkFn = t.mock.fn(async (sourcePath, destinationPath) => {
    if (failLibraryLink && destinationPath.startsWith('/library/')) {
      throw new Error('Permission denied');
    }

    const sourceStats = paths.get(sourcePath);
    const destinationDevice = resolveParentDevice(destinationPath);
    if (sourceStats.dev !== destinationDevice) {
      const error = new Error('cross-device link not permitted');
      error.code = 'EXDEV';
      throw error;
    }

    paths.set(destinationPath, {
      dev: sourceStats.dev,
      ino: sourceStats.ino,
      size: sourceStats.size,
    });
  });
  const removeFileFn = t.mock.fn(async (pathValue) => {
    paths.delete(pathValue);
  });
  const statFn = t.mock.fn(async (pathValue) => {
    const stats = paths.get(pathValue);
    if (!stats) {
      throw createMissingPathError(pathValue);
    }

    return stats;
  });

  return {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  };
}

test('applyImportCandidatePreview stages and finalizes ready files with exclusive move semantics', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t);
  const recordImportOperationFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mkdirFn,
    recordImportOperationFn,
    removeFileFn,
    statFn,
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview(),
    importCandidateId: 'candidate-1',
    operationRunId: 'run-1',
  });

  assert.equal(result.summary.appliedFileCount, 1);
  assert.equal(result.summary.failedFileCount, 0);
  assert.equal(result.summary.stagedFromSourceCount, 1);
  assert.equal(copyFileFn.mock.callCount(), 1);
  assert.deepEqual(copyFileFn.mock.calls[0].arguments, [
    '/downloads/Autechre/Amber/01 Foil.flac',
    '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    1,
  ]);
  assert.deepEqual(linkFn.mock.calls[0].arguments, [
    '/staging/import-candidates/candidate-1/Autechre/Amber/01 Foil.flac',
    '/library/Autechre/Amber/01 Foil.flac',
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
    transport: 'hardlink_then_remove',
  });
  assert.equal(removeFileFn.mock.callCount(), 2);
  assert.equal(result.fileOperations[0].status, 'applied');
  assert.match(recordImportOperationFn.mock.calls[0].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[0].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].startedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(recordImportOperationFn.mock.calls[1].arguments[0].finishedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(statFn.mock.callCount() >= 4);
});

test('applyImportCandidatePreview falls back to copy when hardlink finalize is rejected by the filesystem', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t, {
    libraryDevice: 9,
    sourceDevice: 7,
    stagingDevice: 7,
  });
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mkdirFn,
    recordImportOperationFn: t.mock.fn(async () => {}),
    removeFileFn,
    statFn,
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview(),
  });

  assert.equal(result.fileOperations[0].transport, 'copy_then_remove_after_hardlink_fallback');
  assert.equal(copyFileFn.mock.callCount(), 2);
  assert.equal(linkFn.mock.callCount(), 0);
});

test('applyImportCandidatePreview reuses an existing same-volume lossless file across user roots before finalizing', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t, {
    additionalPaths: [
      ['/library/users', { dev: 7, ino: 40, size: 0 }],
      ['/library/users/owned', { dev: 7, ino: 41, size: 0 }],
      ['/library/users/owned/alice', { dev: 7, ino: 42, size: 0 }],
      ['/library/users/owned/alice/Autechre', { dev: 7, ino: 43, size: 0 }],
      ['/library/users/owned/alice/Autechre/Amber', { dev: 7, ino: 44, size: 0 }],
      ['/library/users/owned/bob', { dev: 7, ino: 45, size: 0 }],
      ['/library/users/owned/bob/Autechre', { dev: 7, ino: 46, size: 0 }],
      ['/library/users/owned/bob/Autechre/Amber', { dev: 7, ino: 47, size: 0 }],
      ['/library/users/owned/bob/Autechre/Amber/01 Foil.flac', { dev: 7, ino: 81, size: 42 }],
    ],
  });
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mkdirFn,
    recordImportOperationFn: t.mock.fn(async () => {}),
    removeFileFn,
    statFn,
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview({
      files: [{
        ...createReadyApplyPreview().files[0],
        libraryTarget: {
          exists: false,
          path: '/library/users/owned/alice/Autechre/Amber/01 Foil.flac',
        },
      }],
      preview: {
        ...createReadyApplyPreview().preview,
        library: {
          ...createReadyApplyPreview().preview.library,
          configuredUserRootPaths: [
            '/library/users/owned/alice',
            '/library/users/owned/bob',
          ],
          reusePolicy: {
            duplicateLosslessPolicy: 'reuse_existing_lossless_by_default',
            sameVolumeLinkMode: 'prefer_hardlink',
          },
          targetUser: {
            configured: true,
            userRootPath: '/library/users/owned/alice',
          },
        },
      },
    }),
  });

  assert.equal(result.summary.appliedFileCount, 1);
  assert.equal(result.summary.reusedExistingLosslessCount, 1);
  assert.equal(result.summary.stagedFromSourceCount, 0);
  assert.equal(copyFileFn.mock.callCount(), 0);
  assert.equal(linkFn.mock.callCount(), 1);
  assert.deepEqual(linkFn.mock.calls[0].arguments, [
    '/library/users/owned/bob/Autechre/Amber/01 Foil.flac',
    '/library/users/owned/alice/Autechre/Amber/01 Foil.flac',
  ]);
  assert.equal(removeFileFn.mock.callCount(), 0);
  assert.equal(result.fileOperations[0].steps[0].transport, 'reuse_existing_lossless');
  assert.equal(result.fileOperations[0].steps[1].transport, 'hardlink_only');
});

test('applyImportCandidatePreview stops after a file failure and records remaining files as not attempted', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t, {
    failLibraryLink: true,
  });
  const recordImportOperationFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mkdirFn,
    recordImportOperationFn,
    removeFileFn,
    statFn,
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
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t);
  const recordImportOperationFn = t.mock.fn(async () => {});
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mkdirFn,
    recordImportOperationFn,
    removeFileFn,
    statFn,
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

test('applyImportCandidatePreview records transcode preflight outcomes for transcode candidates', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedFilesystemDeps(t);
  const mediaTranscodeExecutionService = {
    executeCandidate: t.mock.fn(async () => ({
      mode: 'preflight_only',
      status: 'preflight_passed',
      warnings: [],
    })),
  };
  const service = createImportCandidateApplyOperationService({
    copyFileFn,
    linkFn,
    mediaTranscodeExecutionService,
    mkdirFn,
    recordImportOperationFn: t.mock.fn(async () => {}),
    removeFileFn,
    statFn,
  });

  const result = await service.applyImportCandidatePreview({
    applyPreview: createReadyApplyPreview({
      files: [{
        ...createReadyApplyPreview().files[0],
        transcodePlan: {
          mode: 'planning_only',
          recommendedAction: 'transcode_candidate',
          target: {
            audioCodec: 'opus',
          },
          warnings: [{
            code: 'media_transcode_lossy_source_detected',
            message: 'Detected lossy source codec.',
          }],
        },
      }],
    }),
  });

  assert.equal(mediaTranscodeExecutionService.executeCandidate.mock.callCount(), 1);
  assert.equal(result.summary.transcodePreflightPassedCount, 1);
  assert.equal(result.summary.transcodePreflightFailedCount, 0);
  assert.equal(result.summary.transcodePreflightUnavailableCount, 0);
  assert.equal(result.fileOperations[0].transcodeExecution.status, 'preflight_passed');
});
