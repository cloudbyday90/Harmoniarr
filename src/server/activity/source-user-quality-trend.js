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

// Pure projection that turns a source user's raw delivered-quality outcome
// events into a compact trend the operator UI can render as a sparkline plus a
// signal-mix breakdown. Its purpose is to answer one operational question that a
// single lifetime success rate cannot: is a peer "degraded recently" (used to be
// good, now delivering poor files) versus "always poor" (consistently low)?
//
// It does this by splitting the recency-ordered series into a recent window and
// the prior history, comparing their mean quality weights, and labelling the
// trend direction accordingly. It performs no IO and has no side effects.

const DEFAULT_RECENT_WINDOW_DAYS = 30;
const DEFAULT_MAX_SERIES_POINTS = 60;
// Minimum mean-quality drop between the prior and recent windows before a peer
// is flagged as degrading (avoids flapping on small samples / noise).
const DEGRADE_THRESHOLD = 0.1;
// At/above this mean quality weight a window is considered "good".
const GOOD_QUALITY_FLOOR = 0.75;
// At/below this mean quality weight a window is considered "poor".
const POOR_QUALITY_CEILING = 0.5;
// Minimum events required before a directional verdict is meaningful.
const MIN_SAMPLES_FOR_TREND = 4;

function toUnitWeight(value, outcome) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    if (parsed < 0) {
      return 0;
    }
    if (parsed > 1) {
      return 1;
    }
    return parsed;
  }
  // Legacy rows without an explicit weight: a success is full quality, a failure
  // is zero quality, preserving the original binary semantics.
  return outcome === 'failure' ? 0 : 1;
}

function toTimestamp(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, value) => total + value, 0);
  return sum / values.length;
}

function normalizeEvents(events) {
  if (!Array.isArray(events)) {
    return [];
  }

  return events
    .map((event) => {
      const occurredAtMs = toTimestamp(event?.occurredAt);
      if (occurredAtMs === null) {
        return null;
      }
      const outcome = event?.outcome === 'failure' ? 'failure' : 'success';
      return {
        occurredAt: new Date(occurredAtMs).toISOString(),
        occurredAtMs,
        outcome,
        qualityLabel: typeof event?.qualityLabel === 'string' && event.qualityLabel ? event.qualityLabel : null,
        qualityWeight: toUnitWeight(event?.qualityWeight, outcome),
      };
    })
    .filter((event) => event !== null)
    // Oldest -> newest so the sparkline reads left (past) to right (now).
    .sort((a, b) => a.occurredAtMs - b.occurredAtMs);
}

function resolveTrendDirection({ recentAverage, priorAverage, recentSampleCount, sampleCount }) {
  if (sampleCount < MIN_SAMPLES_FOR_TREND || recentSampleCount === 0 || priorAverage === null || recentAverage === null) {
    return 'insufficient';
  }
  if (recentAverage <= priorAverage - DEGRADE_THRESHOLD) {
    return 'degrading';
  }
  if (recentAverage >= priorAverage + DEGRADE_THRESHOLD) {
    return 'improving';
  }
  return 'stable';
}

/**
 * Builds a delivered-quality trend projection for one source user.
 *
 * @param {object} input
 * @param {Array<{ occurredAt?: string, outcome?: string, qualityWeight?: number, qualityLabel?: string }>} input.events
 * @param {Date|string|number} [input.now]
 * @param {number} [input.recentWindowDays]
 * @param {number} [input.maxSeriesPoints]
 * @returns {{
 *   series: Array<{ occurredAt: string, qualityWeight: number, outcome: string, qualityLabel: string|null }>,
 *   signalMix: Array<{ label: string, count: number }>,
 *   sampleCount: number,
 *   recentSampleCount: number,
 *   recentAverage: number|null,
 *   priorAverage: number|null,
 *   lifetimeAverage: number|null,
 *   trendDirection: 'improving'|'degrading'|'stable'|'insufficient',
 *   degradedRecently: boolean,
 *   alwaysPoor: boolean,
 *   recentWindowDays: number
 * }}
 */
export function buildQualityTrend({
  events,
  now = new Date(),
  recentWindowDays = DEFAULT_RECENT_WINDOW_DAYS,
  maxSeriesPoints = DEFAULT_MAX_SERIES_POINTS,
} = {}) {
  const normalized = normalizeEvents(events);
  const nowMs = toTimestamp(now) ?? Date.now();
  const windowDays = Number.isFinite(recentWindowDays) && recentWindowDays > 0
    ? recentWindowDays
    : DEFAULT_RECENT_WINDOW_DAYS;
  const seriesCap = Number.isFinite(maxSeriesPoints) && maxSeriesPoints > 0
    ? Math.floor(maxSeriesPoints)
    : DEFAULT_MAX_SERIES_POINTS;
  const recentCutoffMs = nowMs - windowDays * 24 * 60 * 60 * 1000;

  const recentWeights = [];
  const priorWeights = [];
  const allWeights = [];
  const signalCounts = new Map();

  for (const event of normalized) {
    allWeights.push(event.qualityWeight);
    if (event.occurredAtMs >= recentCutoffMs) {
      recentWeights.push(event.qualityWeight);
    } else {
      priorWeights.push(event.qualityWeight);
    }
    if (event.qualityLabel) {
      signalCounts.set(event.qualityLabel, (signalCounts.get(event.qualityLabel) ?? 0) + 1);
    }
  }

  const recentAverage = average(recentWeights);
  const priorAverage = average(priorWeights);
  const lifetimeAverage = average(allWeights);
  const sampleCount = normalized.length;
  const recentSampleCount = recentWeights.length;

  const trendDirection = resolveTrendDirection({
    recentAverage,
    priorAverage,
    recentSampleCount,
    sampleCount,
  });

  // "Degraded recently": prior history was good but the recent window dropped to
  // poor. "Always poor": lifetime mean is poor with enough samples to trust it.
  const degradedRecently = priorAverage !== null
    && recentAverage !== null
    && priorAverage >= GOOD_QUALITY_FLOOR
    && recentAverage <= POOR_QUALITY_CEILING;
  const alwaysPoor = lifetimeAverage !== null
    && sampleCount >= MIN_SAMPLES_FOR_TREND
    && lifetimeAverage <= POOR_QUALITY_CEILING
    && !degradedRecently;

  // Keep the sparkline bounded: retain the most recent points (the tail).
  const series = normalized
    .slice(-seriesCap)
    .map((event) => ({
      occurredAt: event.occurredAt,
      outcome: event.outcome,
      qualityLabel: event.qualityLabel,
      qualityWeight: event.qualityWeight,
    }));

  const signalMix = [...signalCounts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    alwaysPoor,
    degradedRecently,
    lifetimeAverage,
    priorAverage,
    recentAverage,
    recentSampleCount,
    recentWindowDays: windowDays,
    sampleCount,
    series,
    signalMix,
    trendDirection,
  };
}
