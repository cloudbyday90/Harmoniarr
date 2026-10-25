/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const operationMessages = new Map([
  ['backup_payload_read', 'The backup payload could not be read'],
  ['import_file_stage', 'Library add could not prepare a file'],
  ['import_file_finalize', 'Library add could not finalize a file'],
  ['import_file_check', 'Library add could not check a file'],
]);
const codeGuidance = new Map([
  ['EACCES', 'Check folder permissions.'], ['EPERM', 'Check folder permissions.'],
  ['ENOENT', 'Check that the required file and folders are available.'],
  ['ENOSPC', 'Check available disk space.'], ['EDQUOT', 'Check the storage quota.'],
  ['EROFS', 'Check that the destination storage is writable.'],
  ['ENOTDIR', 'Check that the configured folders are directories.'],
  ['EISDIR', 'Check that the selected file is a regular file.'],
  ['EEXIST', 'Inspect the existing destination before trying again.'],
  ['EXDEV', 'Check the source and destination filesystem configuration.'],
  ['EIO', 'Check storage health and availability.'], ['EBUSY', 'Check whether another process is using the file.'],
  ['EMFILE', 'Check the application file-handle limit.'], ['ENFILE', 'Check the system file-handle limit.'],
  ['ELOOP', 'Check the folder link configuration.'], ['ENAMETOOLONG', 'Check the planned filename length.'],
  ['ENOMEM', 'Check available memory before trying again.'], ['EFBIG', 'Check the storage file-size limit.'],
  ['ENOTEMPTY', 'Inspect the destination folder before trying again.'], ['ETXTBSY', 'Check whether another process is using the file.'],
  ['ENXIO', 'Check storage availability.'], ['ENODEV', 'Check storage availability.'],
  ['ENOSYS', 'Check filesystem support for the requested operation.'], ['EINVAL', 'Check the file and storage configuration.'],
]);

export function isFilesystemFailure(error) {
  return codeGuidance.has(error?.code);
}

export function buildFilesystemFailure(error, { operation, sourcePath = null, destinationPath = null }) {
  if (!operationMessages.has(operation)) throw new TypeError('Unsupported filesystem failure operation');
  const nativeCode = error?.code;
  const code = codeGuidance.has(nativeCode) ? nativeCode : 'filesystem_operation_failed';
  const guidance = codeGuidance.get(code) ?? 'Inspect the file and storage configuration before trying again.';
  return {
    kind: 'filesystem', operation, code,
    message: `${operationMessages.get(operation)} (${code}). ${guidance}`,
    sourcePath: typeof sourcePath === 'string' ? sourcePath : null,
    destinationPath: typeof destinationPath === 'string' ? destinationPath : null,
  };
}
