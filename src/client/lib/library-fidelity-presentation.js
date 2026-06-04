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

// Pure presentation helpers for the spectral-threshold simulator and the
// library-wide fidelity health dashboard. Free of Vue and DOM so the field
// definitions, projection formatting, and KPI labelling can be unit-tested.

// Editable spectral cutoff threshold fields mirrored from the server defaults
// (DEFAULT_SPECTRAL_THRESHOLDS) and the `fidelity` settings namespace bounds.
export const SPECTRAL_THRESHOLD_FIELDS = [
  { key: 'authenticMinCutoffHz', label: 'Authentic: minimum cutoff (Hz)', min: 10000, max: 24000 },
  { key: 'suspiciousMinCutoffHz', label: 'Suspicious: minimum cutoff (Hz)', min: 8000, max: 24000 },
  { key: 'transcodeMidCutoffHz', label: 'Transcode mid boundary (Hz)', min: 4000, max: 24000 },
  { key: 'minTrustworthySampleRate', label: 'Minimum sample rate (Hz)', min: 8000, max: 192000 },
];

// Maps the in-memory spectral threshold shape to the persisted `fidelity`
// settings keys so the panel can apply a simulated change via the settings PUT.
export const SPECTRAL_THRESHOLD_SETTING_KEYS = {
  authenticMinCutoffHz: 'spectralAuthenticMinCutoffHz',
  suspiciousMinCutoffHz: 'spectralSuspiciousMinCutoffHz',
  transcodeMidCutoffHz: 'spectralTranscodeMidCutoffHz',
  minTrustworthySampleRate: 'spectralMinSampleRateHz',
};

const VERDICT_TONES = {
  authentic: 'success',
  suspicious: 'warning',
  transcoded: 'danger',
  inconclusive: 'neutral',
};

/**
 * Returns a semantic tone token for a spectral verdict, defaulting to neutral.
 *
 * @param {string} verdict
 * @returns {string}
 */
export function formatVerdictTone(verdict) {
  return VERDICT_TONES[verdict] ?? 'neutral';
}

/**
 * Builds an ordered list of verdict-count rows (current vs projected).
 *
 * @param {object} summary
 * @returns {Array<{ verdict: string, current: number, projected: number }>}
 */
export function buildVerdictComparisonRows(summary) {
  const current = summary?.current ?? {};
  const projected = summary?.projected ?? {};
  const verdicts = new Set([...Object.keys(current), ...Object.keys(projected)]);
  return [...verdicts]
    .sort((a, b) => a.localeCompare(b))
    .map((verdict) => ({
      verdict,
      current: Number(current[verdict]) || 0,
      projected: Number(projected[verdict]) || 0,
    }));
}

/**
 * Builds a single-line headline summarizing a spectral simulation outcome.
 *
 * @param {{ changedMeasurementCount?: number, evaluatedMeasurementCount?: number }} simulation
 * @returns {string}
 */
export function formatSpectralSimulationHeadline(simulation) {
  const changed = Number(simulation?.changedMeasurementCount) || 0;
  const evaluated = Number(simulation?.evaluatedMeasurementCount) || 0;
  if (evaluated === 0) {
    return 'No measurements to evaluate. Run a spectral rescan first.';
  }
  if (changed === 0) {
    return `No re-grades across ${evaluated} measurements.`;
  }
  const changedLabel = changed === 1 ? '1 measurement' : `${changed} measurements`;
  return `${changedLabel} of ${evaluated} would be re-graded.`;
}

/**
 * Formats a 0-100 health score for display, with a tone band.
 *
 * @param {number|null} score
 * @returns {{ label: string, tone: string }}
 */
export function formatHealthScore(score) {
  if (score === null || score === undefined || !Number.isFinite(Number(score))) {
    return { label: '—', tone: 'neutral' };
  }
  const value = Number(score);
  let tone = 'danger';
  if (value >= 90) {
    tone = 'success';
  } else if (value >= 70) {
    tone = 'warning';
  }
  return { label: `${value}`, tone };
}

/**
 * Projects the raw dashboard payload into a stable view model. Defensive against
 * missing arrays so a fresh (empty) catalog renders cleanly.
 *
 * @param {object} dashboard
 * @returns {object}
 */
export function buildFidelityDashboardViewModel(dashboard) {
  const verdictCounts = dashboard?.verdictCounts ?? {};
  return {
    totalMeasurements: Number(dashboard?.totalMeasurements) || 0,
    conclusiveMeasurements: Number(dashboard?.conclusiveMeasurements) || 0,
    healthScore: formatHealthScore(dashboard?.healthScore),
    transcodeRatePercent: Number.isFinite(Number(dashboard?.transcodeRatePercent))
      ? Number(dashboard.transcodeRatePercent)
      : null,
    verdictRows: ['authentic', 'suspicious', 'transcoded', 'inconclusive'].map((verdict) => ({
      verdict,
      count: Number(verdictCounts[verdict]) || 0,
    })),
    codecBreakdown: Array.isArray(dashboard?.codecBreakdown) ? dashboard.codecBreakdown : [],
    worstOffenders: Array.isArray(dashboard?.worstOffenders) ? dashboard.worstOffenders : [],
    dailyTrend: Array.isArray(dashboard?.dailyTrend) ? dashboard.dailyTrend : [],
  };
}

/**
 * Translates the in-memory spectral threshold object into the `fidelity`
 * settings patch shape consumed by PUT /api/v1/settings.
 *
 * @param {object} thresholds
 * @returns {object} fidelity-namespace patch
 */
export function buildSpectralThresholdSettingsPatch(thresholds) {
  const patch = {};
  for (const [shapeKey, settingKey] of Object.entries(SPECTRAL_THRESHOLD_SETTING_KEYS)) {
    const value = Number(thresholds?.[shapeKey]);
    if (Number.isFinite(value)) {
      patch[settingKey] = Math.round(value);
    }
  }
  return patch;
}
