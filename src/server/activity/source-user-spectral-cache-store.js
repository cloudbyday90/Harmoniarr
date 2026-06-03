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

// Content-addressed cache of raw spectral measurements, keyed by the file's
// content fingerprint. We cache the *intrinsic* measurement (rolloff cutoff,
// frame count, duration) - never the verdict - because the verdict is recomputed
// cheaply by the pure classifier and may change as thresholds are tuned. A cache
// hit lets the sidecar skip the expensive ffmpeg decode entirely.
//
// All SQL is fully parameterized.

import { getPool } from '../database.js';

function normalizeContentHash(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNonNegativeInteger(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed);
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value ?? null;
}

function mapCacheRow(row) {
  return {
    contentHash: row.content_hash,
    cutoffHz: row.cutoff_hz === null || row.cutoff_hz === undefined ? null : Number(row.cutoff_hz),
    frameCount: Number(row.frame_count ?? 0),
    durationMs: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    analyzedAt: toIso(row.analyzed_at),
  };
}

export function createSourceUserSpectralCacheStore({ getPoolFn = getPool } = {}) {
  /**
   * @returns {Promise<{ contentHash: string, cutoffHz: number | null, frameCount: number, durationMs: number | null, analyzedAt: string | null } | null>}
   */
  async function getCachedMeasurement({ contentHash } = {}) {
    const normalized = normalizeContentHash(contentHash);
    if (!normalized) {
      return null;
    }

    const result = await getPoolFn().query(
      `SELECT content_hash, cutoff_hz, frame_count, duration_ms, analyzed_at
       FROM source_user_spectral_cache
       WHERE content_hash = $1`,
      [normalized],
    );

    return result.rows.length === 0 ? null : mapCacheRow(result.rows[0]);
  }

  /**
   * Upserts a measurement. The latest decode always wins so a re-measured file
   * (e.g. an analyzer upgrade) refreshes the cache.
   */
  async function putCachedMeasurement({
    contentHash,
    cutoffHz = null,
    frameCount = 0,
    durationMs = null,
  } = {}) {
    const normalized = normalizeContentHash(contentHash);
    if (!normalized) {
      return null;
    }

    const result = await getPoolFn().query(
      `INSERT INTO source_user_spectral_cache (content_hash, cutoff_hz, frame_count, duration_ms)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (content_hash) DO UPDATE
         SET cutoff_hz = EXCLUDED.cutoff_hz,
             frame_count = EXCLUDED.frame_count,
             duration_ms = EXCLUDED.duration_ms,
             analyzed_at = NOW()
       RETURNING content_hash, cutoff_hz, frame_count, duration_ms, analyzed_at`,
      [
        normalized,
        normalizeNonNegativeInteger(cutoffHz),
        normalizeNonNegativeInteger(frameCount) ?? 0,
        normalizeNonNegativeInteger(durationMs),
      ],
    );

    return result.rows.length === 0 ? null : mapCacheRow(result.rows[0]);
  }

  async function pruneCache({ olderThanMs = 90 * 24 * 60 * 60 * 1000 } = {}) {
    const threshold = normalizePositiveInteger(olderThanMs, 90 * 24 * 60 * 60 * 1000);
    const result = await getPoolFn().query(
      `DELETE FROM source_user_spectral_cache
       WHERE analyzed_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')`,
      [threshold],
    );
    return result.rowCount ?? 0;
  }

  return {
    getCachedMeasurement,
    pruneCache,
    putCachedMeasurement,
  };
}
