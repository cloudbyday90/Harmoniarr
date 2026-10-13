/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { finished } from 'node:stream/promises';
import { resolveOperatorTrackReadBuffer } from './operator-track-fingerprint-policy.js';

export function createOperatorTrackFingerprintStreamService({ createReadStreamFn = createReadStream } = {}) {
  async function hashFile({ filePath, readBufferBytes, onBytesRead = null }) {
    const highWaterMark = resolveOperatorTrackReadBuffer(readBufferBytes);
    const hash = createHash('sha256');
    const stream = createReadStreamFn(filePath, { highWaterMark, autoClose: true, emitClose: true });
    const closed = stream.closed ? Promise.resolve() : new Promise(resolve => { stream.once('close', resolve); });
    const completion = finished(stream, { cleanup: true }); completion.catch(() => {});
    let failed = false; let failure; let sha256;
    const remember = error => { if (!failed) { failed = true; failure = error; } };
    try {
      for await (const chunk of stream) {
        hash.update(chunk);
        if (typeof onBytesRead === 'function') {
          try {
            const result = onBytesRead(chunk.length);
            if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
          } catch { /* Optional byte telemetry only. */ }
        }
      }
      sha256 = hash.digest('hex');
    } catch (error) { remember(error); }
    try { stream.destroy(); } catch (error) { remember(error); }
    try { await completion; } catch (error) { remember(error); }
    await closed;
    if (failed) throw failure;
    return sha256;
  }
  return { hashFile };
}
