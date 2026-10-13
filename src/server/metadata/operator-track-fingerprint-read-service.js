/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolveOperatorTrackReadBuffer, captureOperatorTrackFileStat, assertOperatorTrackFileStatCurrent } from './operator-track-fingerprint-policy.js';
import { observeOperatorTrackBytes } from './operator-track-byte-observer.js';

export function createOperatorTrackFingerprintReadService({ openFn = open } = {}) {
  async function hashFile({ filePath, readBufferBytes, expectedStat, onBytesRead = null }) {
    const capacity = resolveOperatorTrackReadBuffer(readBufferBytes, 'reusable');
    const expected = captureOperatorTrackFileStat(expectedStat); const hash = createHash('sha256');
    const handle = await openFn(filePath, 'r');
    let failed = false; let failure; let sha256;
    try {
      const current = await handle.stat();
      if (!current.isFile()) throw new Error('Track evidence requires a regular file');
      const opened = captureOperatorTrackFileStat(current); assertOperatorTrackFileStatCurrent(expected, opened);
      const buffer = Buffer.alloc(Math.min(capacity, opened.size)); let position = 0;
      while (position < opened.size) {
        const length = Math.min(buffer.length, opened.size - position);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        if (!Number.isSafeInteger(bytesRead) || bytesRead <= 0 || bytesRead > length) throw new Error('Track changed while collecting evidence');
        hash.update(buffer.subarray(0, bytesRead)); position += bytesRead;
        observeOperatorTrackBytes(onBytesRead, bytesRead);
      }
      const finished = await handle.stat();
      if (!finished.isFile()) throw new Error('Track changed while collecting evidence');
      const after = captureOperatorTrackFileStat(finished); assertOperatorTrackFileStatCurrent(opened, after);
      sha256 = hash.digest('hex');
    } catch (error) { failed = true; failure = error; }
    try { await handle.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
    return sha256;
  }
  return { hashFile };
}
