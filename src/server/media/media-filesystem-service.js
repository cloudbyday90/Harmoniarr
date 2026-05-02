/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { constants } from 'node:fs';
import { copyFile, link, mkdir, rm, stat } from 'node:fs/promises';
import { posix, win32 } from 'node:path';

function selectPathModule(...pathValues) {
  return pathValues.some((value) => typeof value === 'string' && /^[A-Za-z]:[\\/]/.test(value))
    ? win32
    : posix;
}

function normalizePath(pathValue, pathModule) {
  if (typeof pathValue !== 'string') {
    return '';
  }

  return pathModule === win32
    ? pathValue.replaceAll('/', '\\')
    : pathValue.replaceAll('\\', '/');
}

function buildMutationError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function buildVerificationError(message) {
  return buildMutationError('media_filesystem_verification_failed', message);
}

async function inspectPath(pathValue, statFn) {
  try {
    return await statFn(pathValue);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

function isPathInsideRoot(pathValue, rootPath) {
  const pathModule = selectPathModule(pathValue, rootPath);
  const resolvedPath = pathModule.resolve(normalizePath(pathValue, pathModule));
  const resolvedRoot = pathModule.resolve(normalizePath(rootPath, pathModule));
  const relative = pathModule.relative(resolvedRoot, resolvedPath);

  return relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
}

function assertPathInsideRoot({ label, pathValue, rootPath }) {
  if (!rootPath || !isPathInsideRoot(pathValue, rootPath)) {
    throw buildMutationError(
      'media_filesystem_boundary_violation',
      `${label} must remain inside the configured root boundary.`,
    );
  }
}

function shouldFallbackFromHardlink(error) {
  return ['EMLINK', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP', 'EPERM', 'EXDEV', 'EINVAL'].includes(error?.code);
}

function buildTransport({
  appliedMode,
  fallbackFromMode = null,
  removeSourceAfterSuccess,
} = {}) {
  if (fallbackFromMode === 'hardlink') {
    return removeSourceAfterSuccess
      ? 'copy_then_remove_after_hardlink_fallback'
      : 'copy_only_after_hardlink_fallback';
  }

  if (appliedMode === 'hardlink') {
    return removeSourceAfterSuccess
      ? 'hardlink_then_remove'
      : 'hardlink_only';
  }

  if (appliedMode === 'copy') {
    return removeSourceAfterSuccess
      ? 'copy_then_remove'
      : 'copy_only';
  }

  return removeSourceAfterSuccess ? 'copy_then_remove' : 'copy_only';
}

function buildVerification({
  destinationStats,
  destinationWasHardlink = false,
  sourceExistsAfterSuccess,
  sourceRemoved,
  sourceStats,
} = {}) {
  return {
    destinationExists: Boolean(destinationStats),
    destinationSizeBytes: Number(destinationStats?.size ?? 0),
    hardlinkSharedInode: destinationWasHardlink
      ? destinationStats?.dev === sourceStats?.dev && destinationStats?.ino === sourceStats?.ino
      : null,
    sourceExistsAfterSuccess,
    sourceRemoved,
    sourceSizeBytes: Number(sourceStats?.size ?? 0),
  };
}

function normalizeRequestedMode(value) {
  return ['copy', 'move', 'hardlink'].includes(value) ? value : null;
}

export function createMediaFilesystemService({
  copyFileFn = copyFile,
  linkFn = link,
  mkdirFn = mkdir,
  removeFileFn = rm,
  statFn = stat,
} = {}) {
  function createExclusiveFileMutationPlan({
    destinationPath,
    destinationRoot,
    fallbackMode = null,
    removeSourceAfterSuccess = false,
    requestedMode,
    sourcePath,
    sourceRoot,
  }) {
    const normalizedRequestedMode = normalizeRequestedMode(requestedMode);
    if (!normalizedRequestedMode) {
      throw new Error('requestedMode must be one of copy, move, or hardlink');
    }

    const normalizedFallbackMode = fallbackMode == null
      ? null
      : normalizeRequestedMode(fallbackMode);
    if (fallbackMode != null && !normalizedFallbackMode) {
      throw new Error('fallbackMode must be one of copy, move, or hardlink when provided');
    }

    return {
      destinationPath,
      destinationRoot,
      fallbackMode: normalizedFallbackMode,
      removeSourceAfterSuccess: Boolean(removeSourceAfterSuccess),
      requestedMode: normalizedRequestedMode,
      sourcePath,
      sourceRoot,
    };
  }

  async function applyExclusiveFileMutationPlan(plan) {
    const {
      destinationPath,
      destinationRoot,
      fallbackMode = null,
      removeSourceAfterSuccess,
      requestedMode,
      sourcePath,
      sourceRoot,
    } = plan ?? {};

    if (!sourcePath || !destinationPath) {
      throw new Error('sourcePath and destinationPath are required');
    }

    assertPathInsideRoot({
      label: 'Mutation source path',
      pathValue: sourcePath,
      rootPath: sourceRoot,
    });
    assertPathInsideRoot({
      label: 'Mutation destination path',
      pathValue: destinationPath,
      rootPath: destinationRoot,
    });

    const pathModule = selectPathModule(sourcePath, destinationPath, sourceRoot, destinationRoot);
    const normalizedSourcePath = normalizePath(sourcePath, pathModule);
    const normalizedDestinationPath = normalizePath(destinationPath, pathModule);
    const destinationDirectoryPath = pathModule.dirname(normalizedDestinationPath);

    const sourceStats = await inspectPath(normalizedSourcePath, statFn);
    if (!sourceStats) {
      throw buildMutationError(
        'media_filesystem_source_missing',
        'The planned source file is no longer available for the requested filesystem mutation.',
      );
    }

    await mkdirFn(destinationDirectoryPath, { recursive: true });

    const existingDestinationStats = await inspectPath(normalizedDestinationPath, statFn);
    if (existingDestinationStats) {
      throw buildMutationError(
        'media_filesystem_destination_exists',
        'The planned destination file already exists and cannot be overwritten by this mutation.',
      );
    }

    const destinationDirectoryStats = await statFn(destinationDirectoryPath);
    let appliedMode = requestedMode;
    let fallbackFromMode = null;
    let fallbackReason = null;

    if (requestedMode === 'hardlink' && sourceStats.dev !== destinationDirectoryStats.dev) {
      if (!fallbackMode) {
        throw buildMutationError(
          'media_filesystem_cross_device_hardlink',
          'The planned hardlink destination is on a different filesystem device and cannot be linked directly.',
        );
      }

      appliedMode = fallbackMode;
      fallbackFromMode = 'hardlink';
      fallbackReason = 'cross_device';
    }

    try {
      if (appliedMode === 'hardlink') {
        await linkFn(normalizedSourcePath, normalizedDestinationPath);

        const destinationStats = await inspectPath(normalizedDestinationPath, statFn);
        const verification = buildVerification({
          destinationStats,
          destinationWasHardlink: true,
          sourceExistsAfterSuccess: true,
          sourceRemoved: false,
          sourceStats,
        });
        if (!verification.destinationExists || verification.hardlinkSharedInode !== true) {
          throw buildVerificationError(
            'Hardlink verification failed because the destination file does not reference the source inode.',
          );
        }

        if (removeSourceAfterSuccess) {
          await removeFileFn(normalizedSourcePath);
          const sourceExistsAfterSuccess = await inspectPath(normalizedSourcePath, statFn);
          verification.sourceExistsAfterSuccess = Boolean(sourceExistsAfterSuccess);
          verification.sourceRemoved = !sourceExistsAfterSuccess;
          if (verification.sourceExistsAfterSuccess) {
            throw buildVerificationError(
              'Source cleanup failed after the hardlink mutation completed.',
            );
          }
        }

        return {
          appliedMode,
          fallbackFromMode,
          fallbackReason,
          removeSourceAfterSuccess,
          requestedMode,
          sourceRemoved: verification.sourceRemoved,
          transport: buildTransport({
            appliedMode,
            fallbackFromMode,
            removeSourceAfterSuccess,
          }),
          verification,
        };
      }

      await copyFileFn(normalizedSourcePath, normalizedDestinationPath, constants.COPYFILE_EXCL);

      const destinationStats = await inspectPath(normalizedDestinationPath, statFn);
      const verification = buildVerification({
        destinationStats,
        sourceExistsAfterSuccess: true,
        sourceRemoved: false,
        sourceStats,
      });
      if (!verification.destinationExists || verification.destinationSizeBytes !== verification.sourceSizeBytes) {
        throw buildVerificationError(
          'Copy verification failed because the destination file was not created with the expected size.',
        );
      }

      if (removeSourceAfterSuccess) {
        await removeFileFn(normalizedSourcePath);
        const sourceExistsAfterSuccess = await inspectPath(normalizedSourcePath, statFn);
        verification.sourceExistsAfterSuccess = Boolean(sourceExistsAfterSuccess);
        verification.sourceRemoved = !sourceExistsAfterSuccess;
        if (verification.sourceExistsAfterSuccess) {
          throw buildVerificationError(
            'Source cleanup failed after the copy-based mutation completed.',
          );
        }
      }

      return {
        appliedMode,
        fallbackFromMode,
        fallbackReason,
        removeSourceAfterSuccess,
        requestedMode,
        sourceRemoved: verification.sourceRemoved,
        transport: buildTransport({
          appliedMode,
          fallbackFromMode,
          removeSourceAfterSuccess,
        }),
        verification,
      };
    } catch (error) {
      if (requestedMode === 'hardlink' && appliedMode === 'hardlink' && fallbackMode && shouldFallbackFromHardlink(error)) {
        return applyExclusiveFileMutationPlan({
          ...plan,
          fallbackMode: null,
          requestedMode: fallbackMode,
        }).then((result) => ({
          ...result,
          fallbackFromMode: 'hardlink',
          fallbackReason: error.code ?? 'hardlink_failed',
          requestedMode,
          transport: buildTransport({
            appliedMode: result.appliedMode,
            fallbackFromMode: 'hardlink',
            removeSourceAfterSuccess,
          }),
        }));
      }

      throw error;
    }
  }

  return {
    applyExclusiveFileMutationPlan,
    assertPathInsideRoot,
    createExclusiveFileMutationPlan,
    isPathInsideRoot,
  };
}
