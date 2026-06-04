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

// Pure spectral-threshold "what-if" simulator. Operators can preview how a
// proposed change to the cutoff-band boundaries would re-grade the existing
// measured population (already-analysed lossless-claimed files) BEFORE applying
// the new thresholds. The verdict logic is delegated to the same pure
// classifier used on the live path (classifySpectralCutoff), so a simulated
// re-grade is byte-for-byte identical to what the sidecar would later record.
//
// The simulator performs no IO and never mutates state: it takes a snapshot of
// measurements (cutoffHz + declared codec/extension + sample rate) and runs each
// one through the classifier under both the current and proposed thresholds.

import {
  DEFAULT_SPECTRAL_THRESHOLDS,
  classifySpectralCutoff,
  isDeclaredLossless,
  resolveSpectralThresholds,
} from '../media/media-spectral-analysis.js';

const VERDICTS = Object.freeze(['authentic', 'suspicious', 'transcoded', 'inconclusive']);

function emptyVerdictCounts() {
  const counts = {};
  for (const verdict of VERDICTS) {
    counts[verdict] = 0;
  }
  return counts;
}

function normalizeMeasurement(measurement) {
  if (!measurement || typeof measurement !== 'object') {
    return null;
  }
  const cutoffHz = Number(measurement.cutoffHz);
  if (!Number.isFinite(cutoffHz) || cutoffHz <= 0) {
    return null;
  }
  return {
    cutoffHz,
    sampleRate: Number.isFinite(Number(measurement.sampleRate)) ? Number(measurement.sampleRate) : null,
    declaredCodec: typeof measurement.declaredCodec === 'string' ? measurement.declaredCodec : null,
    declaredExtension: typeof measurement.declaredExtension === 'string' ? measurement.declaredExtension : null,
    username: typeof measurement.username === 'string' ? measurement.username : null,
    contentHash: typeof measurement.contentHash === 'string' ? measurement.contentHash : null,
  };
}

/**
 * @param {object} input
 * @param {Array<object>} input.measurements - Recent done spectral measurements.
 * @param {object} [input.thresholds] - Proposed cutoff thresholds (partial).
 * @param {object} [input.currentThresholds] - Baseline thresholds (defaults to the
 *   shipping defaults; callers pass the persisted live thresholds).
 * @returns {{
 *   thresholds: object,
 *   currentThresholds: object,
 *   defaultThresholds: object,
 *   evaluatedMeasurementCount: number,
 *   changedMeasurementCount: number,
 *   summary: { current: object, projected: object },
 *   transitions: Array<{ from: string, to: string, count: number }>,
 *   projection: Array<object>
 * }}
 */
export function simulateSpectralThresholdPolicy({ measurements = [], thresholds = {}, currentThresholds } = {}) {
  const proposed = resolveSpectralThresholds(thresholds);
  const baseline = resolveSpectralThresholds(currentThresholds);
  const list = Array.isArray(measurements) ? measurements : [];

  const currentCounts = emptyVerdictCounts();
  const projectedCounts = emptyVerdictCounts();
  const transitionMap = new Map();
  const projection = [];
  let evaluated = 0;
  let changedMeasurementCount = 0;

  for (const raw of list) {
    const measurement = normalizeMeasurement(raw);
    if (!measurement) {
      continue;
    }

    const declaredLossless = isDeclaredLossless({
      codec: measurement.declaredCodec,
      extension: measurement.declaredExtension,
    });

    const currentResult = classifySpectralCutoff({
      cutoffHz: measurement.cutoffHz,
      sampleRate: measurement.sampleRate,
      declaredLossless,
      thresholds: baseline,
    });
    const projectedResult = classifySpectralCutoff({
      cutoffHz: measurement.cutoffHz,
      sampleRate: measurement.sampleRate,
      declaredLossless,
      thresholds: proposed,
    });

    evaluated += 1;
    currentCounts[currentResult.verdict] += 1;
    projectedCounts[projectedResult.verdict] += 1;

    const changed = currentResult.verdict !== projectedResult.verdict;
    if (changed) {
      changedMeasurementCount += 1;
      const transitionKey = `${currentResult.verdict}->${projectedResult.verdict}`;
      transitionMap.set(transitionKey, (transitionMap.get(transitionKey) ?? 0) + 1);
    }

    projection.push({
      contentHash: measurement.contentHash,
      username: measurement.username,
      cutoffHz: measurement.cutoffHz,
      sampleRate: measurement.sampleRate,
      declaredCodec: measurement.declaredCodec,
      currentVerdict: currentResult.verdict,
      projectedVerdict: projectedResult.verdict,
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
    currentThresholds: baseline,
    defaultThresholds: { ...DEFAULT_SPECTRAL_THRESHOLDS },
    evaluatedMeasurementCount: evaluated,
    changedMeasurementCount,
    summary: { current: currentCounts, projected: projectedCounts },
    transitions,
    projection,
  };
}
