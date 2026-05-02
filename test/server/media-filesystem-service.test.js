import assert from 'node:assert/strict';
import test from 'node:test';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';

function createMissingPathError(pathValue) {
  const error = new Error(`ENOENT: no such file or directory, stat '${pathValue}'`);
  error.code = 'ENOENT';
  return error;
}

function createSimulatedMediaFilesystemDeps(t, {
  destinationDevice = 7,
  sourceDevice = 7,
  sourcePath = '/downloads/source.flac',
  sourceRoot = '/downloads',
} = {}) {
  const paths = new Map([
    [sourceRoot, { dev: sourceDevice, ino: 1, size: 0 }],
    [sourcePath, { dev: sourceDevice, ino: 11, size: 42 }],
    ['/library', { dev: destinationDevice, ino: 30, size: 0 }],
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

    return destinationDevice;
  }

  const mkdirFn = t.mock.fn(async (pathValue) => {
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
  });
  const copyFileFn = t.mock.fn(async (sourceFilePath, destinationPath) => {
    const sourceStats = paths.get(sourceFilePath);
    paths.set(destinationPath, {
      dev: resolveParentDevice(destinationPath),
      ino: nextInode += 1,
      size: sourceStats.size,
    });
  });
  const linkFn = t.mock.fn(async (sourceFilePath, destinationPath) => {
    const sourceStats = paths.get(sourceFilePath);
    const destinationDev = resolveParentDevice(destinationPath);
    if (sourceStats.dev !== destinationDev) {
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

test('applyExclusiveFileMutationPlan copies and removes the source for move plans', async (t) => {
  const {
    copyFileFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedMediaFilesystemDeps(t);
  const service = createMediaFilesystemService({
    copyFileFn,
    mkdirFn,
    removeFileFn,
    statFn,
  });

  const result = await service.applyExclusiveFileMutationPlan(
    service.createExclusiveFileMutationPlan({
      destinationPath: '/library/dest.flac',
      destinationRoot: '/library',
      removeSourceAfterSuccess: true,
      requestedMode: 'move',
      sourcePath: '/downloads/source.flac',
      sourceRoot: '/downloads',
    }),
  );

  assert.equal(result.requestedMode, 'move');
  assert.equal(result.appliedMode, 'move');
  assert.equal(result.transport, 'copy_then_remove');
  assert.equal(result.sourceRemoved, true);
  assert.equal(copyFileFn.mock.callCount(), 1);
  assert.deepEqual(copyFileFn.mock.calls[0].arguments, [
    '/downloads/source.flac',
    '/library/dest.flac',
    1,
  ]);
  assert.equal(removeFileFn.mock.callCount(), 1);
  assert.equal(result.verification.destinationExists, true);
  assert.equal(result.verification.sourceExistsAfterSuccess, false);
});

test('applyExclusiveFileMutationPlan verifies same-device hardlinks without removing the source by default', async (t) => {
  const {
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedMediaFilesystemDeps(t);
  const service = createMediaFilesystemService({
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  });

  const result = await service.applyExclusiveFileMutationPlan(
    service.createExclusiveFileMutationPlan({
      destinationPath: '/library/dest.flac',
      destinationRoot: '/library',
      requestedMode: 'hardlink',
      sourcePath: '/downloads/source.flac',
      sourceRoot: '/downloads',
    }),
  );

  assert.equal(result.requestedMode, 'hardlink');
  assert.equal(result.appliedMode, 'hardlink');
  assert.equal(result.transport, 'hardlink_only');
  assert.equal(result.verification.hardlinkSharedInode, true);
  assert.equal(linkFn.mock.callCount(), 1);
});

test('applyExclusiveFileMutationPlan falls back explicitly when a hardlink cannot cross devices', async (t) => {
  const {
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  } = createSimulatedMediaFilesystemDeps(t, {
    destinationDevice: 9,
    sourceDevice: 7,
    sourcePath: '/staging/source.flac',
    sourceRoot: '/staging',
  });
  const service = createMediaFilesystemService({
    copyFileFn,
    linkFn,
    mkdirFn,
    removeFileFn,
    statFn,
  });

  const result = await service.applyExclusiveFileMutationPlan(
    service.createExclusiveFileMutationPlan({
      destinationPath: '/library/dest.flac',
      destinationRoot: '/library',
      fallbackMode: 'move',
      removeSourceAfterSuccess: true,
      requestedMode: 'hardlink',
      sourcePath: '/staging/source.flac',
      sourceRoot: '/staging',
    }),
  );

  assert.equal(result.requestedMode, 'hardlink');
  assert.equal(result.appliedMode, 'move');
  assert.equal(result.fallbackFromMode, 'hardlink');
  assert.equal(result.fallbackReason, 'cross_device');
  assert.equal(result.transport, 'copy_then_remove_after_hardlink_fallback');
  assert.equal(copyFileFn.mock.callCount(), 1);
  assert.equal(linkFn.mock.callCount(), 0);
});

test('applyExclusiveFileMutationPlan rejects destination collisions before mutating files', async (t) => {
  const copyFileFn = t.mock.fn(async () => {});
  const service = createMediaFilesystemService({
    copyFileFn,
    mkdirFn: t.mock.fn(async () => {}),
    removeFileFn: t.mock.fn(async () => {}),
    statFn: async (pathValue) => {
      switch (pathValue) {
        case '/downloads/source.flac':
          return { dev: 7, ino: 11, size: 42 };
        case '/library':
          return { dev: 7, ino: 3, size: 0 };
        case '/library/dest.flac':
          return { dev: 7, ino: 33, size: 42 };
        default:
          throw createMissingPathError(pathValue);
      }
    },
  });

  await assert.rejects(
    () => service.applyExclusiveFileMutationPlan(
      service.createExclusiveFileMutationPlan({
        destinationPath: '/library/dest.flac',
        destinationRoot: '/library',
        removeSourceAfterSuccess: true,
        requestedMode: 'move',
        sourcePath: '/downloads/source.flac',
        sourceRoot: '/downloads',
      }),
    ),
    (error) => error.code === 'media_filesystem_destination_exists',
  );
  assert.equal(copyFileFn.mock.callCount(), 0);
});
