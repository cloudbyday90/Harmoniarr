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

// Read-only spectral-threshold policy simulation service. Loads the recently
// measured population from the insights store and runs the pure spectral
// threshold simulator so an operator can preview a proposed cutoff-band change
// before persisting it to the `fidelity` settings namespace. No mutation.

import { simulateSpectralThresholdPolicy } from './source-user-spectral-threshold-simulator.js';

/**
 * @param {object} deps
 * @param {(input: { limit?: number }) => Promise<Array<object>>} deps.listRecentSpectralMeasurementsFn
 * @param {() => Promise<object>} [deps.loadSpectralThresholdsFn] - Persisted live thresholds (baseline).
 * @param {Function} [deps.simulateSpectralThresholdPolicyFn]
 * @param {number} [deps.measurementLimit]
 */
export function createSourceUserSpectralPolicySimulationService({
  listRecentSpectralMeasurementsFn,
  loadSpectralThresholdsFn = null,
  simulateSpectralThresholdPolicyFn = simulateSpectralThresholdPolicy,
  measurementLimit = 1000,
} = {}) {
  if (typeof listRecentSpectralMeasurementsFn !== 'function') {
    throw new Error('createSourceUserSpectralPolicySimulationService requires listRecentSpectralMeasurementsFn');
  }

  async function resolveBaselineThresholds() {
    if (typeof loadSpectralThresholdsFn !== 'function') {
      return undefined;
    }
    try {
      const loaded = await loadSpectralThresholdsFn();
      return loaded && typeof loaded === 'object' ? loaded : undefined;
    } catch {
      return undefined;
    }
  }

  async function simulateSpectralPolicy({ thresholds = {} } = {}) {
    const [measurements, currentThresholds] = await Promise.all([
      listRecentSpectralMeasurementsFn({ limit: measurementLimit }),
      resolveBaselineThresholds(),
    ]);

    const simulation = simulateSpectralThresholdPolicyFn({
      measurements: Array.isArray(measurements) ? measurements : [],
      thresholds,
      currentThresholds,
    });

    return {
      checkedAt: new Date().toISOString(),
      ...simulation,
    };
  }

  return { simulateSpectralPolicy };
}
