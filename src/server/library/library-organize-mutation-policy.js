/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { posix, win32 } from 'node:path';
import { normalizeExpectedJobLease } from '../job-lease-policy.js';

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const isPathText = (value) => typeof value === 'string'
  && value.length > 0 && value.length <= 8192 && !value.includes('\u0000');
const getPathModule = (...values) => values.some((value) => /^[A-Za-z]:[\\/]/u.test(value ?? '')) ? win32 : posix;
const resolvePathKey = (value, pathModule) => pathModule === win32
  ? pathModule.resolve(value).toLowerCase() : pathModule.resolve(value);
const isInsideRoot = (root, path, pathModule) => {
  const delta = pathModule.relative(resolvePathKey(root, pathModule), resolvePathKey(path, pathModule));
  return delta !== '' && !delta.startsWith('..') && !pathModule.isAbsolute(delta);
};

export function captureOrganizeMutation({ runId, expectedLease, file, plan }) {
  const lease = normalizeExpectedJobLease(expectedLease, { leaseKey: `library_organize_apply:${runId}` });
  if (!isUuid(runId) || !lease || !isUuid(file?.fileId) || !isUuid(file?.libraryRootId)
    || ![file.libraryRootPath, file.currentPath, file.proposedPath, file.proposedRelativePath].every(isPathText)
    || plan?.requestedMode !== 'move' || plan.removeSourceAfterSuccess !== true || plan.fallbackMode != null) {
    return null;
  }
  const pathModule = getPathModule(file.libraryRootPath, file.currentPath, file.proposedPath);
  if (![file.libraryRootPath, file.currentPath, file.proposedPath].every((path) => pathModule.isAbsolute(path))
    || !isInsideRoot(file.libraryRootPath, file.currentPath, pathModule)
    || !isInsideRoot(file.libraryRootPath, file.proposedPath, pathModule)
    || resolvePathKey(file.currentPath, pathModule) === resolvePathKey(file.proposedPath, pathModule)
    || pathModule.relative(file.libraryRootPath, file.proposedPath).replaceAll('\\', '/') !== file.proposedRelativePath
    || ![plan.sourcePath, plan.sourceRoot, plan.destinationPath, plan.destinationRoot].every(isPathText)
    || resolvePathKey(plan.sourcePath, pathModule) !== resolvePathKey(file.currentPath, pathModule)
    || resolvePathKey(plan.destinationPath, pathModule) !== resolvePathKey(file.proposedPath, pathModule)
    || [plan.sourceRoot, plan.destinationRoot].some((root) => resolvePathKey(root, pathModule) !== resolvePathKey(file.libraryRootPath, pathModule))) {
    return null;
  }
  return Object.freeze({
    runId,
    expectedLease: lease,
    file: Object.freeze({
      fileId: file.fileId,
      libraryRootId: file.libraryRootId,
      libraryRootPath: file.libraryRootPath,
      currentPath: file.currentPath,
      proposedPath: file.proposedPath,
      proposedRelativePath: file.proposedRelativePath,
      filename: pathModule.basename(file.proposedPath),
    }),
    plan: Object.freeze({
      sourcePath: plan.sourcePath,
      sourceRoot: plan.sourceRoot,
      destinationPath: plan.destinationPath,
      destinationRoot: plan.destinationRoot,
      requestedMode: 'move',
      fallbackMode: null,
      removeSourceAfterSuccess: true,
    }),
  });
}

export function isCurrentOrganizeFile(current, prepared) {
  const file = prepared.file;
  const pathModule = getPathModule(file.libraryRootPath, file.currentPath);
  return current?.id === file.fileId && current.libraryRootId === file.libraryRootId && current.deletedAt == null
    && current.fileState === 'observed' && isPathText(current.canonicalPath) && isPathText(current.rootPath)
    && resolvePathKey(current.canonicalPath, pathModule) === resolvePathKey(file.currentPath, pathModule)
    && resolvePathKey(current.rootPath, pathModule) === resolvePathKey(file.libraryRootPath, pathModule);
}

export function isVerifiedOrganizeMove(result) {
  const verification = result?.verification;
  return result?.sourceRemoved === true && verification?.sourceRemoved === true && verification.destinationExists === true
    && verification.sourceExistsAfterSuccess === false && Number.isSafeInteger(verification.sourceSizeBytes)
    && verification.sourceSizeBytes >= 0 && verification.destinationSizeBytes === verification.sourceSizeBytes;
}
