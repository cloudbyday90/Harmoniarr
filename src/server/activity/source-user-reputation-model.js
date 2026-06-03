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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Recency-weighted reputation model defaults. Tuned to be conservative: a peer
// is only ever suggested for ignore once there is a meaningful, recent sample of
// failures whose Wilson lower bound (95% one-sided confidence) indicates a
// genuinely low success rate rather than statistical noise.
export const DEFAULT_REPUTATION_MODEL_OPTIONS = Object.freeze({
  // 95% confidence z-score for the Wilson score interval (Evan Miller,
  // "How Not To Sort By Average Rating").
  z: 1.96,
  // Exponential decay half-life: a 30-day-old outcome counts roughly half as
  // much as a fresh one, so reputation tracks current behaviour, not lifetime.
  halfLifeDays: 30,
  // Outcomes older than this contribute negligibly and are ignored entirely.
  maxAgeDays: 180,
});

export const DEFAULT_AUTO_IGNORE_THRESHOLDS = Object.freeze({
  // Minimum decayed sample size before any suggestion is considered.
  minSampleSize: 4,
  // Suggest ignore only when the upper bound of the success rate is still low,
  // i.e. we are confident the peer is unreliable rather than unlucky.
  maxSuccessUpperBound: 0.45,
  // Require failures to dominate the recent decayed evidence.
  minDecayedFailureRatio: 0.6,
});

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNonNegativeNumber(value) {
  const parsed = toFiniteNumber(value);
  return parsed > 0 ? parsed : 0;
}

function clampUnitInterval(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function resolveEventTimestamp(event) {
  const raw = event?.occurredAt ?? event?.occurred_at ?? null;
  if (typeof raw === 'string') {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (raw instanceof Date) {
    const time = raw.getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function resolveOutcome(event) {
  const outcome = event?.outcome;
  return outcome === 'success' || outcome === 'failure' ? outcome : null;
}

/**
 * Resolves the delivered-quality weight of an outcome event into the [0, 1]
 * unit interval. Absent/invalid quality defaults to 1.0 so legacy events
 * (recorded before quality weighting) and plain failures keep binary semantics.
 */
function resolveQualityWeight(event) {
  const raw = event?.qualityWeight ?? event?.quality_weight;
  if (raw === null || raw === undefined) {
    return 1;
  }
  return clampUnitInterval(toFiniteNumber(raw));
}

/**
 * Wilson score interval bounds for a binomial proportion. Handles fractional
 * (decay-weighted) pseudo-counts and the empty-sample case (returns a
 * zero-width interval at 0). Reference: Evan Miller, "How Not To Sort By
 * Average Rating".
 *
 * @param {number} successCount weighted successes (>= 0)
 * @param {number} totalCount weighted total observations (>= 0)
 * @param {object} [options]
 * @param {number} [options.z] confidence z-score
 * @returns {{ lowerBound: number, point: number, upperBound: number }}
 */
export function computeWilsonScoreInterval(successCount, totalCount, { z = DEFAULT_REPUTATION_MODEL_OPTIONS.z } = {}) {
  const successes = toNonNegativeNumber(successCount);
  const total = toNonNegativeNumber(totalCount);

  if (total <= 0 || successes > total) {
    return { lowerBound: 0, point: 0, upperBound: 0 };
  }

  const p = successes / total;
  const zSquared = z * z;
  const denominator = 1 + zSquared / total;
  const centre = (p + zSquared / (2 * total)) / denominator;
  const margin = (z * Math.sqrt((p * (1 - p) + zSquared / (4 * total)) / total)) / denominator;

  return {
    lowerBound: clampUnitInterval(centre - margin),
    point: clampUnitInterval(p),
    upperBound: clampUnitInterval(centre + margin),
  };
}

/**
 * Collapses a list of outcome events into exponential time-decayed weighted
 * counts. A weight of 0.5 ** (ageDays / halfLifeDays) means an outcome at the
 * half-life age counts for half a fresh outcome. Events older than maxAgeDays
 * are discarded.
 *
 * @param {Array<object>} events outcome events ({ outcome, occurredAt })
 * @param {object} [options]
 * @param {number|string|Date} [options.now] evaluation instant
 * @param {number} [options.halfLifeDays]
 * @param {number} [options.maxAgeDays]
 * @returns {{ decayedSuccess: number, decayedFailure: number, decayedTotal: number, sampleSize: number, lastOutcomeAt: string|null }}
 */
export function computeDecayedOutcomeCounts(events, {
  now = Date.now(),
  halfLifeDays = DEFAULT_REPUTATION_MODEL_OPTIONS.halfLifeDays,
  maxAgeDays = DEFAULT_REPUTATION_MODEL_OPTIONS.maxAgeDays,
} = {}) {
  const nowMs = now instanceof Date ? now.getTime() : Number(new Date(now).getTime());
  const safeNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const safeHalfLifeDays = toNonNegativeNumber(halfLifeDays) || DEFAULT_REPUTATION_MODEL_OPTIONS.halfLifeDays;
  const maxAgeMs = toNonNegativeNumber(maxAgeDays) * MS_PER_DAY;

  let decayedSuccess = 0;
  let decayedFailure = 0;
  let sampleSize = 0;
  let lastOutcomeMs = null;

  for (const event of Array.isArray(events) ? events : []) {
    const outcome = resolveOutcome(event);
    const timestamp = resolveEventTimestamp(event);
    if (!outcome || timestamp === null) {
      continue;
    }

    const ageMs = Math.max(0, safeNowMs - timestamp);
    if (maxAgeMs > 0 && ageMs > maxAgeMs) {
      continue;
    }

    const ageDays = ageMs / MS_PER_DAY;
    const weight = Math.pow(0.5, ageDays / safeHalfLifeDays);

    if (outcome === 'success') {
      // Quality-weighted success: a clean apply (quality 1.0) contributes its
      // full decay weight to success. A partially-delivered success (e.g. half
      // the files applied, or transcode/format degradation) splits its weight
      // between success and failure mass, so reputation reflects delivered
      // fidelity rather than mere completion.
      const quality = resolveQualityWeight(event);
      decayedSuccess += weight * quality;
      decayedFailure += weight * (1 - quality);
    } else {
      decayedFailure += weight;
    }

    sampleSize += 1;
    if (lastOutcomeMs === null || timestamp > lastOutcomeMs) {
      lastOutcomeMs = timestamp;
    }
  }

  return {
    decayedSuccess,
    decayedFailure,
    decayedTotal: decayedSuccess + decayedFailure,
    sampleSize,
    lastOutcomeAt: lastOutcomeMs === null ? null : new Date(lastOutcomeMs).toISOString(),
  };
}

/**
 * Builds a recency-weighted reputation projection from an outcome-event list.
 *
 * @param {object} [params]
 * @param {Array<object>} [params.events]
 * @param {number|string|Date} [params.now]
 * @param {object} [params.options] decay/confidence overrides
 * @returns {object} recency-weighted reputation summary
 */
export function buildRecencyWeightedReputation({
  events = [],
  now = Date.now(),
  options = DEFAULT_REPUTATION_MODEL_OPTIONS,
} = {}) {
  const resolvedOptions = { ...DEFAULT_REPUTATION_MODEL_OPTIONS, ...(options ?? {}) };
  const decayed = computeDecayedOutcomeCounts(events, {
    now,
    halfLifeDays: resolvedOptions.halfLifeDays,
    maxAgeDays: resolvedOptions.maxAgeDays,
  });
  const interval = computeWilsonScoreInterval(decayed.decayedSuccess, decayed.decayedTotal, {
    z: resolvedOptions.z,
  });
  const decayedFailureRatio = decayed.decayedTotal > 0
    ? decayed.decayedFailure / decayed.decayedTotal
    : 0;
  const recencyWeightedSuccessRate = decayed.decayedTotal > 0
    ? decayed.decayedSuccess / decayed.decayedTotal
    : 0;

  return {
    decayedSuccess: decayed.decayedSuccess,
    decayedFailure: decayed.decayedFailure,
    decayedTotal: decayed.decayedTotal,
    sampleSize: decayed.sampleSize,
    lastOutcomeAt: decayed.lastOutcomeAt,
    decayedFailureRatio,
    recencyWeightedSuccessRate,
    wilsonLowerBound: interval.lowerBound,
    wilsonUpperBound: interval.upperBound,
    successRatePoint: interval.point,
  };
}

/**
 * Produces an explainable auto-ignore suggestion from a recency-weighted
 * reputation summary. The suggestion is advisory: it never blocks a peer by
 * itself, it surfaces a confident, recent, failure-dominated signal that an
 * operator (or an opt-in source filter) can act on.
 *
 * @param {object} [params]
 * @param {object} [params.reputation] output of buildRecencyWeightedReputation
 * @param {object} [params.thresholds]
 * @returns {{ suggested: boolean, reason: string|null, signals: object }}
 */
export function evaluateAutoIgnoreSuggestion({
  reputation = null,
  thresholds = DEFAULT_AUTO_IGNORE_THRESHOLDS,
} = {}) {
  const resolvedThresholds = { ...DEFAULT_AUTO_IGNORE_THRESHOLDS, ...(thresholds ?? {}) };
  const summary = reputation ?? {};

  const sampleSize = toNonNegativeNumber(summary.sampleSize);
  const decayedFailureRatio = clampUnitInterval(toFiniteNumber(summary.decayedFailureRatio));
  const successUpperBound = clampUnitInterval(toFiniteNumber(summary.wilsonUpperBound));

  const hasSample = sampleSize >= resolvedThresholds.minSampleSize;
  const failureDominant = decayedFailureRatio >= resolvedThresholds.minDecayedFailureRatio;
  const confidentlyUnreliable = successUpperBound <= resolvedThresholds.maxSuccessUpperBound;

  const signals = {
    confidentlyUnreliable,
    failureDominant,
    hasSample,
    decayedFailureRatio,
    sampleSize,
    successUpperBound,
  };

  if (!hasSample || !failureDominant || !confidentlyUnreliable) {
    return { suggested: false, reason: null, signals };
  }

  const failurePercent = Math.round(decayedFailureRatio * 100);
  const upperPercent = Math.round(successUpperBound * 100);
  const reason = `Recent delivery evidence is failure-dominated (${failurePercent}% recency-weighted failures across ${sampleSize} outcomes) with a success rate that stays at or below ${upperPercent}% even at 95% confidence.`;

  return { suggested: true, reason, signals };
}
