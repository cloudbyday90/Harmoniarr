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

// Operator-triggered retroactive library scan. Pulls a bounded batch of
// lossless-claimed catalog files and enqueues them as retroactive spectral jobs.
// The actual analysis is performed off-path by the shared spectral consumer, and
// the content-addressed cache means files already measured (e.g. via the apply
// path) are re-graded without a second ffmpeg decode.

const DEFAULT_SCAN_LIMIT = 250;
const MAX_SCAN_LIMIT = 2000;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * @param {object} deps
 * @param {(input: { limit: number }) => Promise<Array<object>>} deps.listLosslessLibraryFilesFn
 * @param {(input: { files: Array<object> }) => Promise<{ enqueued: number, skipped: number }>} deps.enqueueRetroactiveLibraryJobsFn
 * @param {number} [deps.defaultLimit]
 * @param {(message: string, error?: Error) => void} [deps.onWarning]
 */
export function createSourceUserSpectralRetroactiveScanService({
  listLosslessLibraryFilesFn,
  enqueueRetroactiveLibraryJobsFn,
  defaultLimit = DEFAULT_SCAN_LIMIT,
  onWarning = () => {},
} = {}) {
  if (typeof listLosslessLibraryFilesFn !== 'function') {
    throw new Error('createSourceUserSpectralRetroactiveScanService requires listLosslessLibraryFilesFn');
  }
  if (typeof enqueueRetroactiveLibraryJobsFn !== 'function') {
    throw new Error('createSourceUserSpectralRetroactiveScanService requires enqueueRetroactiveLibraryJobsFn');
  }

  const baseLimit = Math.min(normalizePositiveInteger(defaultLimit, DEFAULT_SCAN_LIMIT), MAX_SCAN_LIMIT);

  /**
   * @returns {Promise<{ candidates: number, enqueued: number, skipped: number }>}
   */
  async function scanLibrary({ limit = baseLimit } = {}) {
    const scanLimit = Math.min(normalizePositiveInteger(limit, baseLimit), MAX_SCAN_LIMIT);

    let files;
    try {
      files = await listLosslessLibraryFilesFn({ limit: scanLimit });
    } catch (error) {
      onWarning('Failed to list library files for retroactive spectral scan', error);
      return { candidates: 0, enqueued: 0, skipped: 0 };
    }

    if (!Array.isArray(files) || files.length === 0) {
      return { candidates: 0, enqueued: 0, skipped: 0 };
    }

    try {
      const result = await enqueueRetroactiveLibraryJobsFn({ files });
      return {
        candidates: files.length,
        enqueued: result?.enqueued ?? 0,
        skipped: result?.skipped ?? 0,
      };
    } catch (error) {
      onWarning('Failed to enqueue retroactive spectral jobs', error);
      return { candidates: files.length, enqueued: 0, skipped: files.length };
    }
  }

  return { scanLibrary };
}
