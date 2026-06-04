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

// Read-only insights store over the completed spectral-job ledger. Two concerns:
//
//   1. listRecentSpectralMeasurements — supplies the spectral-threshold simulator
//      with the most recently measured lossless-claimed files (cutoff + declared
//      codec/extension + sample rate) so a proposed threshold change can be
//      previewed against the real population.
//
//   2. getFidelityHealthAggregates — powers the library-wide fidelity health
//      dashboard: verdict distribution, by-codec breakdown, per-source worst
//      offenders, and a daily transcode trend.
//
// All queries read only `state = 'done'` rows and are fully parameterized. The
// store performs no mutation. Retroactive-scan rows (the sentinel identity) are
// included in catalog-level health but excluded from per-source attribution,
// since they are not tied to a real peer.

import { getPool } from '../database.js';
import { RETROACTIVE_SCAN_USERNAME } from './source-user-spectral-job-store.js';

const DEFAULT_MEASUREMENT_LIMIT = 500;
const MAX_MEASUREMENT_LIMIT = 5000;
const DEFAULT_TREND_DAYS = 30;
const MAX_TREND_DAYS = 365;
const DEFAULT_WORST_OFFENDER_LIMIT = 20;
const MAX_WORST_OFFENDER_LIMIT = 100;

function clampInteger(value, fallback, { min, max }) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return Math.min(parsed, max);
}

function toNumberOrNull(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @param {object} [deps]
 * @param {() => { query: Function }} [deps.getPoolFn]
 */
export function createSourceUserSpectralInsightsStore({ getPoolFn = getPool } = {}) {
  /**
   * Returns the most recently measured lossless-claimed files, newest first.
   * Only rows carrying a usable cutoff measurement are returned, so the
   * simulator never has to filter inconclusive noise.
   *
   * @param {object} [input]
   * @param {number} [input.limit]
   * @returns {Promise<Array<{ contentHash: string|null, username: string|null, cutoffHz: number, sampleRate: number|null, declaredCodec: string|null, declaredExtension: string|null }>>}
   */
  async function listRecentSpectralMeasurements({ limit } = {}) {
    const rowLimit = clampInteger(limit, DEFAULT_MEASUREMENT_LIMIT, { min: 1, max: MAX_MEASUREMENT_LIMIT });
    const result = await getPoolFn().query(
      `SELECT content_hash,
              username,
              cutoff_hz,
              sample_rate,
              declared_codec,
              declared_extension
       FROM source_user_spectral_jobs
       WHERE state = 'done'
         AND cutoff_hz IS NOT NULL
       ORDER BY updated_at DESC
       LIMIT $1`,
      [rowLimit],
    );

    return result.rows.map((row) => ({
      contentHash: row.content_hash ?? null,
      username: row.username === RETROACTIVE_SCAN_USERNAME ? null : (row.username ?? null),
      cutoffHz: toNumberOrNull(row.cutoff_hz),
      sampleRate: toNumberOrNull(row.sample_rate),
      declaredCodec: row.declared_codec ?? null,
      declaredExtension: row.declared_extension ?? null,
    }));
  }

  async function loadVerdictDistribution() {
    const result = await getPoolFn().query(
      `SELECT verdict, COUNT(*)::int AS measurement_count
       FROM source_user_spectral_jobs
       WHERE state = 'done'
       GROUP BY verdict
       ORDER BY verdict ASC`,
    );
    return result.rows.map((row) => ({
      verdict: row.verdict ?? 'unknown',
      count: Number(row.measurement_count ?? 0),
    }));
  }

  async function loadCodecBreakdown() {
    const result = await getPoolFn().query(
      `SELECT COALESCE(declared_codec, declared_extension, 'unknown') AS codec,
              COUNT(*)::int AS measurement_count,
              COUNT(*) FILTER (WHERE verdict = 'transcoded')::int AS transcoded_count,
              COUNT(*) FILTER (WHERE verdict = 'suspicious')::int AS suspicious_count,
              COUNT(*) FILTER (WHERE verdict = 'authentic')::int AS authentic_count
       FROM source_user_spectral_jobs
       WHERE state = 'done'
       GROUP BY COALESCE(declared_codec, declared_extension, 'unknown')
       ORDER BY COUNT(*) FILTER (WHERE verdict = 'transcoded') DESC,
                COUNT(*) DESC`,
    );
    return result.rows.map((row) => ({
      codec: row.codec ?? 'unknown',
      count: Number(row.measurement_count ?? 0),
      transcoded: Number(row.transcoded_count ?? 0),
      suspicious: Number(row.suspicious_count ?? 0),
      authentic: Number(row.authentic_count ?? 0),
    }));
  }

  async function loadWorstOffenders(limit) {
    const rowLimit = clampInteger(limit, DEFAULT_WORST_OFFENDER_LIMIT, { min: 1, max: MAX_WORST_OFFENDER_LIMIT });
    const result = await getPoolFn().query(
      `SELECT username,
              COUNT(*)::int AS measurement_count,
              COUNT(*) FILTER (WHERE verdict = 'transcoded')::int AS transcoded_count
       FROM source_user_spectral_jobs
       WHERE state = 'done'
         AND username <> $1
       GROUP BY username
       HAVING COUNT(*) FILTER (WHERE verdict = 'transcoded') > 0
       ORDER BY COUNT(*) FILTER (WHERE verdict = 'transcoded') DESC,
                COUNT(*) DESC
       LIMIT $2`,
      [RETROACTIVE_SCAN_USERNAME, rowLimit],
    );
    return result.rows.map((row) => {
      const count = Number(row.measurement_count ?? 0);
      const transcoded = Number(row.transcoded_count ?? 0);
      return {
        username: row.username ?? null,
        count,
        transcoded,
        transcodeRate: count > 0 ? Number((transcoded / count).toFixed(4)) : 0,
      };
    });
  }

  async function loadDailyTrend(trendDays) {
    const days = clampInteger(trendDays, DEFAULT_TREND_DAYS, { min: 1, max: MAX_TREND_DAYS });
    const result = await getPoolFn().query(
      `SELECT TO_CHAR(DATE_TRUNC('day', updated_at), 'YYYY-MM-DD') AS day,
              COUNT(*)::int AS measurement_count,
              COUNT(*) FILTER (WHERE verdict = 'transcoded')::int AS transcoded_count,
              COUNT(*) FILTER (WHERE verdict = 'suspicious')::int AS suspicious_count
       FROM source_user_spectral_jobs
       WHERE state = 'done'
         AND updated_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY DATE_TRUNC('day', updated_at)
       ORDER BY DATE_TRUNC('day', updated_at) ASC`,
      [days],
    );
    return result.rows.map((row) => ({
      day: row.day,
      count: Number(row.measurement_count ?? 0),
      transcoded: Number(row.transcoded_count ?? 0),
      suspicious: Number(row.suspicious_count ?? 0),
    }));
  }

  /**
   * Composite read for the fidelity health dashboard.
   *
   * @param {object} [input]
   * @param {number} [input.trendDays]
   * @param {number} [input.worstOffenderLimit]
   * @returns {Promise<{ verdictDistribution, codecBreakdown, worstOffenders, dailyTrend }>}
   */
  async function getFidelityHealthAggregates({ trendDays, worstOffenderLimit } = {}) {
    const [verdictDistribution, codecBreakdown, worstOffenders, dailyTrend] = await Promise.all([
      loadVerdictDistribution(),
      loadCodecBreakdown(),
      loadWorstOffenders(worstOffenderLimit),
      loadDailyTrend(trendDays),
    ]);

    return {
      verdictDistribution,
      codecBreakdown,
      worstOffenders,
      dailyTrend,
    };
  }

  return {
    listRecentSpectralMeasurements,
    getFidelityHealthAggregates,
  };
}
