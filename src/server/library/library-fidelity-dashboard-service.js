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

// Read-only library-wide fidelity health dashboard service. Composes the
// per-aggregate reads from the spectral insights store into a single
// catalog-level quality KPI payload (verdict distribution + a derived health
// score, by-codec breakdown, per-source worst offenders, and a transcode
// trend). The pure summary builder is exported separately so it can be unit
// tested without a database.
//
// Fail-safe: if the aggregate read throws (e.g. the table is empty on a fresh
// install), the service returns a zeroed but well-formed payload rather than
// erroring the admin request.

const VERDICT_ORDER = Object.freeze(['authentic', 'suspicious', 'transcoded', 'inconclusive']);

function toCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/**
 * Pure aggregate -> KPI summary projection. Derives a 0-100 fidelity health
 * score that weights authentic measurements fully, suspicious at half, and
 * transcoded/inconclusive at zero, over the conclusive (non-inconclusive)
 * population.
 *
 * @param {object} input
 * @param {Array<{ verdict: string, count: number }>} [input.verdictDistribution]
 * @param {Array<object>} [input.codecBreakdown]
 * @param {Array<object>} [input.worstOffenders]
 * @param {Array<object>} [input.dailyTrend]
 * @returns {object}
 */
export function buildFidelityHealthSummary({
  verdictDistribution = [],
  codecBreakdown = [],
  worstOffenders = [],
  dailyTrend = [],
} = {}) {
  const verdictCounts = { authentic: 0, suspicious: 0, transcoded: 0, inconclusive: 0 };
  for (const entry of Array.isArray(verdictDistribution) ? verdictDistribution : []) {
    const verdict = typeof entry?.verdict === 'string' ? entry.verdict : 'inconclusive';
    if (verdict in verdictCounts) {
      verdictCounts[verdict] += toCount(entry?.count);
    } else {
      verdictCounts.inconclusive += toCount(entry?.count);
    }
  }

  const totalMeasurements = VERDICT_ORDER.reduce((sum, verdict) => sum + verdictCounts[verdict], 0);
  const conclusiveCount = verdictCounts.authentic + verdictCounts.suspicious + verdictCounts.transcoded;

  const healthScore = conclusiveCount === 0
    ? null
    : Math.round(((verdictCounts.authentic + verdictCounts.suspicious * 0.5) / conclusiveCount) * 1000) / 10;

  const transcodeRate = conclusiveCount === 0
    ? null
    : Math.round((verdictCounts.transcoded / conclusiveCount) * 1000) / 10;

  return {
    totalMeasurements,
    conclusiveMeasurements: conclusiveCount,
    verdictCounts,
    healthScore,
    transcodeRatePercent: transcodeRate,
    codecBreakdown: Array.isArray(codecBreakdown) ? codecBreakdown : [],
    worstOffenders: Array.isArray(worstOffenders) ? worstOffenders : [],
    dailyTrend: Array.isArray(dailyTrend) ? dailyTrend : [],
  };
}

const EMPTY_SUMMARY = Object.freeze(buildFidelityHealthSummary());

/**
 * @param {object} deps
 * @param {(input: object) => Promise<object>} deps.getFidelityHealthAggregatesFn
 * @param {(message: string, error?: Error) => void} [deps.onWarning]
 */
export function createLibraryFidelityDashboardService({
  getFidelityHealthAggregatesFn,
  onWarning = () => {},
} = {}) {
  if (typeof getFidelityHealthAggregatesFn !== 'function') {
    throw new Error('createLibraryFidelityDashboardService requires getFidelityHealthAggregatesFn');
  }

  async function getFidelityHealthDashboard({ trendDays, worstOffenderLimit } = {}) {
    let aggregates;
    try {
      aggregates = await getFidelityHealthAggregatesFn({ trendDays, worstOffenderLimit });
    } catch (error) {
      onWarning('Failed to load fidelity health aggregates', error);
      return {
        checkedAt: new Date().toISOString(),
        ...EMPTY_SUMMARY,
      };
    }

    return {
      checkedAt: new Date().toISOString(),
      ...buildFidelityHealthSummary(aggregates ?? {}),
    };
  }

  return { getFidelityHealthDashboard };
}
