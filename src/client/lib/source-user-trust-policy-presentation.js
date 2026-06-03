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

// Pure presentation helpers for the read-only trust-threshold policy simulator.
// Free of Vue and DOM so the field definitions and projection formatting can be
// unit-tested in isolation.

// Editable threshold fields mirrored from the server simulator defaults. `kind`
// distinguishes integer evidence counts from [0, 1] success-rate fractions so
// the form can render the right control and validate input ranges.
export const TRUST_THRESHOLD_FIELDS = [
  { key: 'watchFailureCount', label: 'Watch: minimum failures', kind: 'count', min: 1, max: 50 },
  { key: 'watchMaxSuccessRate', label: 'Watch: maximum success rate', kind: 'rate', min: 0, max: 1 },
  { key: 'watchEvidenceCount', label: 'Watch: minimum evidence', kind: 'count', min: 1, max: 50 },
  { key: 'healthyEvidenceCount', label: 'Healthy: minimum evidence', kind: 'count', min: 1, max: 50 },
  { key: 'healthyMinSuccessRate', label: 'Healthy: minimum success rate', kind: 'rate', min: 0, max: 1 },
];

const STATE_TONES = {
  excluded: 'danger',
  watch: 'warning',
  preferred: 'success',
  healthy: 'success',
  normal: 'neutral',
  unknown: 'neutral',
};

/**
 * Returns a semantic tone token for a review state, defaulting to neutral.
 *
 * @param {string} state
 * @returns {string}
 */
export function formatReviewStateTone(state) {
  return STATE_TONES[state] ?? 'neutral';
}

/**
 * Formats a [0, 1] success-rate fraction as a whole-number percentage string.
 *
 * @param {number} rate
 * @returns {string}
 */
export function formatRatePercent(rate) {
  const parsed = Number(rate);
  if (!Number.isFinite(parsed)) {
    return '—';
  }
  const clamped = Math.min(1, Math.max(0, parsed));
  return `${Math.round(clamped * 100)}%`;
}

/**
 * Builds a stable, ordered list of state-count rows from a summary map so the
 * template can render current vs. projected counts side by side.
 *
 * @param {object} summary
 * @returns {Array<{ state: string, current: number, projected: number }>}
 */
export function buildStateComparisonRows(summary) {
  const current = summary?.current ?? {};
  const projected = summary?.projected ?? {};
  const states = new Set([...Object.keys(current), ...Object.keys(projected)]);
  return [...states]
    .sort((a, b) => a.localeCompare(b))
    .map((state) => ({
      state,
      current: Number(current[state]) || 0,
      projected: Number(projected[state]) || 0,
    }));
}

/**
 * Returns true when at least one peer would be reclassified under the simulated
 * thresholds.
 *
 * @param {{ changedPeerCount?: number }} simulation
 * @returns {boolean}
 */
export function hasProjectedChanges(simulation) {
  return (Number(simulation?.changedPeerCount) || 0) > 0;
}

/**
 * Builds a single-line headline summarizing the simulation outcome.
 *
 * @param {{ changedPeerCount?: number, evaluatedPeerCount?: number }} simulation
 * @returns {string}
 */
export function formatSimulationHeadline(simulation) {
  const changed = Number(simulation?.changedPeerCount) || 0;
  const evaluated = Number(simulation?.evaluatedPeerCount) || 0;
  if (evaluated === 0) {
    return 'No peers to evaluate.';
  }
  if (changed === 0) {
    return `No reclassifications across ${evaluated} peers.`;
  }
  const changedLabel = changed === 1 ? '1 peer' : `${changed} peers`;
  return `${changedLabel} of ${evaluated} would be reclassified.`;
}
