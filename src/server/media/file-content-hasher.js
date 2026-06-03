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

// Filesystem adapter that turns a file into a content fingerprint by reading
// only the byte windows chosen by the pure planner. This is the cache-key
// derivation used by the spectral sidecar to skip a redundant ffmpeg decode
// when an identical file has already been measured.
//
// Security/robustness: reads are positional (pread-style) so the file is never
// streamed in full for large masters; the handle is always closed in a finally
// block; and every read is bounded by the planner's window length.

import { open } from 'node:fs/promises';

import {
  DEFAULT_SAMPLE_SIZE,
  DEFAULT_SAMPLE_THRESHOLD,
  buildContentFingerprint,
  resolveFingerprintPlan,
} from './media-content-fingerprint.js';

function normalizeNonNegativeInteger(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

/**
 * @param {object} [deps]
 * @param {number} [deps.sampleSize]
 * @param {number} [deps.sampleThreshold]
 * @param {(path: string, flags: string) => Promise<import('node:fs/promises').FileHandle>} [deps.openFileFn]
 */
export function createFileContentHasher({
  sampleSize = DEFAULT_SAMPLE_SIZE,
  sampleThreshold = DEFAULT_SAMPLE_THRESHOLD,
  openFileFn = open,
} = {}) {
  /**
   * Reads the sampled windows for `filePath` and returns the content fingerprint.
   *
   * @param {object} input
   * @param {string} input.filePath
   * @param {number} [input.sizeBytes] - Known size (e.g. from the catalog row); avoids a stat.
   * @returns {Promise<string>} hex digest
   */
  async function hashFile({ filePath, sizeBytes = null } = {}) {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      throw new Error('hashFile requires filePath');
    }

    const handle = await openFileFn(filePath, 'r');
    try {
      let size = normalizeNonNegativeInteger(sizeBytes);
      if (size === null) {
        const stats = await handle.stat();
        size = normalizeNonNegativeInteger(stats.size) ?? 0;
      }

      const plan = resolveFingerprintPlan({ sizeBytes: size, sampleSize, sampleThreshold });
      const chunks = [];

      for (const window of plan.windows) {
        const length = normalizeNonNegativeInteger(window.length) ?? 0;
        if (length <= 0) {
          continue;
        }
        const position = Math.max(0, normalizeNonNegativeInteger(window.position) ?? 0);
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, position);
        chunks.push(bytesRead === length ? buffer : buffer.subarray(0, bytesRead));
      }

      return buildContentFingerprint({ sizeBytes: size, chunks });
    } finally {
      await handle.close();
    }
  }

  return { hashFile };
}
