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

// Catalog source for the library-wide retroactive spectral scan. Selects the
// observed, lossless-claimed library files that are worth re-grading and are not
// already queued, so the retroactive scan can re-run the historical library
// through the exact same spectral pipeline used on the apply path.

import { getPool } from '../database.js';
import { LOSSLESS_CODECS } from '../media/media-spectral-analysis.js';

const DEFAULT_LIMIT = 250;
const MAX_LIMIT = 2000;
const MIN_TRUSTWORTHY_SAMPLE_RATE = 44100;

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createLibrarySpectralScanSource({ getPoolFn = getPool } = {}) {
  /**
   * Lists lossless-claimed catalog files eligible for a retroactive spectral
   * re-grade. Excludes deleted/ignored rows, sub-44.1 kHz material (where a
   * cutoff is not diagnostic) and files that already have an open job.
   *
   * @returns {Promise<Array<{ libraryFileId: string, filePath: string, declaredCodec: string|null, declaredExtension: string|null, sampleRate: number|null }>>}
   */
  async function listLosslessLibraryFiles({ limit = DEFAULT_LIMIT } = {}) {
    const rowLimit = Math.min(normalizePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);
    const losslessTokens = LOSSLESS_CODECS.map((entry) => entry.toLowerCase());

    const result = await getPoolFn().query(
      `SELECT lf.id,
              lf.canonical_path,
              lf.extension,
              lf.audio_codec,
              lf.sample_rate_hz
       FROM library_files lf
       WHERE lf.deleted_at IS NULL
         AND lf.file_state = 'observed'
         AND (lf.sample_rate_hz IS NULL OR lf.sample_rate_hz >= $2)
         AND (
           lower(regexp_replace(COALESCE(lf.extension, ''), '^\\.', '')) = ANY($1)
           OR lower(COALESCE(lf.audio_codec, '')) = ANY($1)
         )
         AND NOT EXISTS (
           SELECT 1 FROM source_user_spectral_jobs j
           WHERE j.library_file_id = lf.id
             AND j.state IN ('pending', 'active')
         )
       ORDER BY lf.updated_at DESC
       LIMIT $3`,
      [losslessTokens, MIN_TRUSTWORTHY_SAMPLE_RATE, rowLimit],
    );

    return result.rows.map((row) => ({
      libraryFileId: row.id,
      filePath: row.canonical_path,
      declaredCodec: row.audio_codec ?? null,
      declaredExtension: row.extension ?? null,
      sampleRate: row.sample_rate_hz === null || row.sample_rate_hz === undefined
        ? null
        : Number(row.sample_rate_hz),
    }));
  }

  return { listLosslessLibraryFiles };
}
