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

// Pure trust-threshold policy "what-if" simulator.
//
// Operators can preview how a proposed change to the review thresholds would
// reclassify the current peer population *before* committing to it. The
// classification logic mirrors the live buildReview() rules in
// source-user-trust-service.js, but with the thresholds lifted into parameters
// so a candidate policy can be evaluated side-by-side with the current one.
//
// Manual operator decisions stay sticky: a blocked peer is always 'excluded' and
// a trusted peer is always 'preferred', regardless of thresholds. The simulator
// performs no IO and never mutates state.

export const DEFAULT_TRUST_THRESHOLDS = Object.freeze({
  watchFailureCount: 3,
  watchMaxSuccessRate: 0.5,
  watchEvidenceCount: 3,
  healthyEvidenceCount: 5,
  healthyMinSuccessRate: 0.8,
});

const REVIEW_STATES = Object.freeze(['excluded', 'preferred', 'watch', 'healthy', 'normal', 'unknown']);

function clampCount(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function clampRate(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function resolveThresholds(input) {
  const provided = input && typeof input === 'object' ? input : {};
  return {
    watchFailureCount: clampCount(provided.watchFailureCount, DEFAULT_TRUST_THRESHOLDS.watchFailureCount),
    watchMaxSuccessRate: clampRate(provided.watchMaxSuccessRate, DEFAULT_TRUST_THRESHOLDS.watchMaxSuccessRate),
    watchEvidenceCount: clampCount(provided.watchEvidenceCount, DEFAULT_TRUST_THRESHOLDS.watchEvidenceCount),
    healthyEvidenceCount: clampCount(provided.healthyEvidenceCount, DEFAULT_TRUST_THRESHOLDS.healthyEvidenceCount),
    healthyMinSuccessRate: clampRate(provided.healthyMinSuccessRate, DEFAULT_TRUST_THRESHOLDS.healthyMinSuccessRate),
  };
}

/**
 * Classifies a single peer's review state under the supplied thresholds. Mirrors
 * the precedence of buildReview(): blocked/trusted overrides, then unknown, then
 * the failure-driven watch rule, the healthy rule, the imbalance watch rule, and
 * finally normal.
 */
export function classifyReviewState({ successCount, failureCount, trustState }, thresholds = DEFAULT_TRUST_THRESHOLDS) {
  if (trustState === 'blocked') {
    return 'excluded';
  }
  if (trustState === 'trusted') {
    return 'preferred';
  }

  const successes = normalizeNonNegativeInteger(successCount);
  const failures = normalizeNonNegativeInteger(failureCount);
  const evidenceCount = successes + failures;
  if (evidenceCount === 0) {
    return 'unknown';
  }

  const successRate = successes / evidenceCount;

  if (failures >= thresholds.watchFailureCount && successRate < thresholds.watchMaxSuccessRate) {
    return 'watch';
  }
  if (evidenceCount >= thresholds.healthyEvidenceCount && successRate >= thresholds.healthyMinSuccessRate) {
    return 'healthy';
  }
  if (evidenceCount >= thresholds.watchEvidenceCount && failures > successes) {
    return 'watch';
  }
  return 'normal';
}

function emptyStateCounts() {
  const counts = {};
  for (const state of REVIEW_STATES) {
    counts[state] = 0;
  }
  return counts;
}

/**
 * @param {object} input
 * @param {Array<{ username?: string|null, usernameKey?: string|null, successCount?: number, failureCount?: number, trustState?: string }>} input.peers
 * @param {object} [input.thresholds] - Proposed thresholds (partial; missing keys fall back to defaults).
 * @returns {{
 *   thresholds: object,
 *   defaultThresholds: object,
 *   evaluatedPeerCount: number,
 *   changedPeerCount: number,
 *   summary: { current: object, projected: object },
 *   transitions: Array<{ from: string, to: string, count: number }>,
 *   projection: Array<object>
 * }}
 */
export function simulateTrustThresholdPolicy({ peers = [], thresholds = {} } = {}) {
  const proposed = resolveThresholds(thresholds);
  const peerList = Array.isArray(peers) ? peers : [];

  const currentCounts = emptyStateCounts();
  const projectedCounts = emptyStateCounts();
  const transitionMap = new Map();
  const projection = [];
  let changedPeerCount = 0;

  for (const peer of peerList) {
    const stats = {
      successCount: normalizeNonNegativeInteger(peer?.successCount),
      failureCount: normalizeNonNegativeInteger(peer?.failureCount),
      trustState: typeof peer?.trustState === 'string' ? peer.trustState : 'neutral',
    };

    const currentState = classifyReviewState(stats, DEFAULT_TRUST_THRESHOLDS);
    const projectedState = classifyReviewState(stats, proposed);
    const changed = currentState !== projectedState;

    currentCounts[currentState] += 1;
    projectedCounts[projectedState] += 1;

    if (changed) {
      changedPeerCount += 1;
      const transitionKey = `${currentState}->${projectedState}`;
      transitionMap.set(transitionKey, (transitionMap.get(transitionKey) ?? 0) + 1);
    }

    projection.push({
      username: typeof peer?.username === 'string' ? peer.username : null,
      usernameKey: typeof peer?.usernameKey === 'string' ? peer.usernameKey : null,
      successCount: stats.successCount,
      failureCount: stats.failureCount,
      evidenceCount: stats.successCount + stats.failureCount,
      trustState: stats.trustState,
      currentState,
      projectedState,
      changed,
    });
  }

  const transitions = [...transitionMap.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split('->');
      return { from, to, count };
    })
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.from.localeCompare(b.from)));

  return {
    thresholds: proposed,
    defaultThresholds: { ...DEFAULT_TRUST_THRESHOLDS },
    evaluatedPeerCount: peerList.length,
    changedPeerCount,
    summary: { current: currentCounts, projected: projectedCounts },
    transitions,
    projection,
  };
}
