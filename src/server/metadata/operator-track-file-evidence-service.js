/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { lstat, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import { refuseOperatorTrackFiles } from './operator-track-file-policy.js';
import { createOperatorTrackFingerprintStreamService } from './operator-track-fingerprint-stream-service.js';
import { resolveOperatorTrackReadBuffer } from './operator-track-fingerprint-policy.js';

const streamService = createOperatorTrackFingerprintStreamService();

export async function fingerprintOperatorTrackFile(filePath, { libraryRoot = null, onBytesRead = null, readBufferBytes } = {}) {
  const acceptedBuffer = resolveOperatorTrackReadBuffer(readBufferBytes);
  let canonical;
  const assertPrivate = async () => {
    if (!libraryRoot) return;
    const root = await realpath(libraryRoot); const file = await realpath(filePath);
    const delta = relative(root, file);
    if (!delta || delta === '..' || delta.startsWith(`..${sep}`) || isAbsolute(delta)
      || (await lstat(filePath)).isSymbolicLink() || (canonical && canonical !== file)) throw refuseOperatorTrackFiles();
    canonical = file;
  };
  await assertPrivate();
  const before = await stat(filePath);
  if (!before.isFile()) throw new Error('Track evidence requires a regular file');
  const sha256 = await streamService.hashFile({ filePath, readBufferBytes: acceptedBuffer, onBytesRead });
  const after = await stat(filePath);
  await assertPrivate();
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) throw new Error('Track changed while collecting evidence');
  return { sizeBytes: after.size, sha256 };
}
