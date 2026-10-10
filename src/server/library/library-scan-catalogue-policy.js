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
const isText = (value, { empty = false, maximum = 8192 } = {}) => typeof value === 'string'
  && (empty || value.length > 0) && value.length <= maximum && !value.includes('\u0000');
const getPathModule = (root) => /^[A-Za-z]:[\\/]/u.test(root) || root.startsWith('\\\\') ? win32 : posix;

function captureObservedFile(file, root, pathModule) {
  if (!file || !isText(file.canonicalPath) || !isText(file.relativePath) || !isText(file.filename)
    || !pathModule.isAbsolute(file.canonicalPath)) return null;
  const relative = pathModule.relative(root, file.canonicalPath);
  if (!relative || relative === '..' || relative.startsWith(`..${pathModule.sep}`) || pathModule.isAbsolute(relative)
    || relative.split(pathModule.sep).join('/') !== file.relativePath
    || pathModule.basename(file.canonicalPath) !== file.filename) return null;

  const extension = file.extension ?? '';
  const fileState = file.fileState ?? 'observed';
  const sizeBytes = Number(file.sizeBytes ?? 0);
  if (!isText(extension, { empty: true, maximum: 255 }) || !['observed', 'ignored'].includes(fileState)
    || !Number.isSafeInteger(sizeBytes) || sizeBytes < 0) return null;
  const timestamp = file.modifiedAt == null ? null
    : file.modifiedAt instanceof Date ? file.modifiedAt.getTime()
      : typeof file.modifiedAt === 'string' ? Date.parse(file.modifiedAt) : NaN;
  if (timestamp !== null && !Number.isFinite(timestamp)) return null;
  return Object.freeze({
    canonicalPath: file.canonicalPath,
    relativePath: file.relativePath,
    filename: file.filename,
    extension,
    sizeBytes,
    fileState,
    modifiedAt: timestamp === null ? null : new Date(timestamp).toISOString(),
  });
}

export function captureScanCatalogue({ runId, expectedLease, requestedLibraryRoot, libraryRootPath, files }) {
  const lease = normalizeExpectedJobLease(expectedLease, { leaseKey: `library_scan:${runId}` });
  if (!isUuid(runId) || !lease || !isText(requestedLibraryRoot) || !isText(libraryRootPath)
    || !Array.isArray(files)) return null;
  const pathModule = getPathModule(libraryRootPath);
  if (!pathModule.isAbsolute(libraryRootPath)) return null;
  const observations = [];
  for (const file of files) {
    const captured = captureObservedFile(file, libraryRootPath, pathModule);
    if (!captured) return null;
    observations.push(captured);
  }
  return Object.freeze({
    runId,
    expectedLease: lease,
    requestedLibraryRoot,
    libraryRootPath,
    files: Object.freeze(observations),
  });
}

export function isCompleteScanCatalogueResult(result, prepared) {
  const expectedPaths = new Set(prepared.files.map((file) => file.canonicalPath));
  if (!result || !isUuid(result.libraryRootId) || !Array.isArray(result.files)
    || result.observedFileCount !== expectedPaths.size || result.files.length !== expectedPaths.size) return false;
  const seenIds = new Set();
  for (const file of result.files) {
    if (!isUuid(file?.id) || seenIds.has(file.id) || !expectedPaths.delete(file.canonicalPath)) return false;
    seenIds.add(file.id);
  }
  return expectedPaths.size === 0;
}
