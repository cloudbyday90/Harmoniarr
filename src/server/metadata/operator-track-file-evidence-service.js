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
import { createOperatorTrackFingerprintReadService } from './operator-track-fingerprint-read-service.js';
import { resolveOperatorTrackReadBuffer, resolveOperatorTrackReadMethod, captureOperatorTrackFileStat, assertOperatorTrackFileStatCurrent } from './operator-track-fingerprint-policy.js';

export function createOperatorTrackFileEvidenceService({ streamService = createOperatorTrackFingerprintStreamService(),
  readService = createOperatorTrackFingerprintReadService(), statFn = stat } = {}) {

  async function fingerprintOperatorTrackFile(filePath, { libraryRoot = null, onBytesRead = null, readBufferBytes, readMethod } = {}) {
    const method = resolveOperatorTrackReadMethod(readMethod);
    const acceptedBuffer = resolveOperatorTrackReadBuffer(readBufferBytes, method);
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
    const before = await statFn(filePath);
    if (!before.isFile()) throw new Error('Track evidence requires a regular file');
    const expected = captureOperatorTrackFileStat(before);
    const service = method === 'reusable' ? readService : streamService;
    const sha256 = await service.hashFile({ filePath, readBufferBytes: acceptedBuffer, expectedStat: expected, onBytesRead });
    const after = await statFn(filePath);
    await assertPrivate();
    if (!after.isFile()) throw new Error('Track changed while collecting evidence');
    assertOperatorTrackFileStatCurrent(expected, captureOperatorTrackFileStat(after));
    return { sizeBytes: after.size, sha256 };
  }
  return { fingerprintOperatorTrackFile };
}

export const fingerprintOperatorTrackFile = createOperatorTrackFileEvidenceService().fingerprintOperatorTrackFile;
