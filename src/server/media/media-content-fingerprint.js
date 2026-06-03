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

// Pure content-fingerprinting primitives for the spectral result cache.
//
// The fingerprint follows the sampled-hash strategy popularised by imohash
// (kalafut/imohash): for large files we hash only fixed-size windows from the
// head, middle and tail plus the file size, instead of streaming the whole
// file. A lossless master can be hundreds of MB, so sampling turns the cache
// key derivation from an O(file) read into an O(48 KiB) read while keeping a
// vanishingly small collision probability for the cache's purpose (reusing a
// prior spectral *measurement*, never integrity verification).
//
// Differences from imohash: we use SHA-256 (Node's built-in crypto, no extra
// dependency and a far wider digest than murmur3-128) and we inject the size as
// a fixed 8-byte big-endian prefix rather than a varint. Files differing in size
// can never collide; like-sized files are disambiguated by the three windows.
//
// This module is intentionally pure: it never touches the filesystem. The IO
// adapter (file-content-hasher.js) resolves the plan, reads the windows and
// feeds the bytes back here.

import { createHash } from 'node:crypto';

export const DEFAULT_SAMPLE_SIZE = 16 * 1024;
export const DEFAULT_SAMPLE_THRESHOLD = 128 * 1024;

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

/**
 * Decides whether a file should be sampled or fully hashed and, when sampled,
 * which byte windows to read.
 *
 * Sampled mode is only used when the file is comfortably larger than the sample
 * windows (size >= threshold and size >= 4 * sampleSize); otherwise the windows
 * would overlap or cover most of the file anyway, so we hash it in full.
 *
 * @returns {{ mode: 'full' | 'sampled', sampleSize: number, windows: Array<{ position: number, length: number }> }}
 */
export function resolveFingerprintPlan({
  sizeBytes,
  sampleSize = DEFAULT_SAMPLE_SIZE,
  sampleThreshold = DEFAULT_SAMPLE_THRESHOLD,
} = {}) {
  const size = normalizeNonNegativeInteger(sizeBytes) ?? 0;
  const windowSize = normalizePositiveInteger(sampleSize, DEFAULT_SAMPLE_SIZE);
  const threshold = normalizePositiveInteger(sampleThreshold, DEFAULT_SAMPLE_THRESHOLD);

  if (size < threshold || size < 4 * windowSize) {
    return {
      mode: 'full',
      sampleSize: windowSize,
      windows: [{ position: 0, length: size }],
    };
  }

  const middle = Math.floor(size / 2);
  return {
    mode: 'sampled',
    sampleSize: windowSize,
    windows: [
      { position: 0, length: windowSize },
      { position: middle, length: windowSize },
      { position: size - windowSize, length: windowSize },
    ],
  };
}

function encodeSizePrefix(size) {
  const prefix = Buffer.alloc(8);
  prefix.writeBigUInt64BE(BigInt(size), 0);
  return prefix;
}

/**
 * Combines the file size and the sampled byte windows into a stable hex digest.
 *
 * @param {object} input
 * @param {number} input.sizeBytes
 * @param {Array<Buffer | Uint8Array>} input.chunks - Bytes read for each window, in order.
 * @returns {string} 64-character lowercase hex SHA-256 digest.
 */
export function buildContentFingerprint({ sizeBytes, chunks = [] } = {}) {
  const size = normalizeNonNegativeInteger(sizeBytes) ?? 0;
  const hash = createHash('sha256');
  hash.update(encodeSizePrefix(size));
  for (const chunk of chunks) {
    if (chunk && chunk.length > 0) {
      hash.update(chunk);
    }
  }
  return hash.digest('hex');
}
