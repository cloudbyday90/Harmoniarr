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

// Pure adapters between the persisted `fidelity` settings namespace and the
// in-memory threshold shapes consumed by the live classifiers and the what-if
// simulators. Promoting the spectral/trust constants to persisted admin
// settings means the loaders that feed the live path (sidecar classifier and
// trust review) and the simulators all derive from a single namespace; these
// mappers keep that translation in one tested place instead of scattering
// settings-key knowledge across the wiring layer.

import { DEFAULT_SPECTRAL_THRESHOLDS } from './media/media-spectral-analysis.js';
import { DEFAULT_TRUST_THRESHOLDS } from './activity/source-user-trust-threshold-simulator.js';

function pickNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Projects the persisted `fidelity` settings into the spectral cutoff-band
 * threshold shape. Missing keys fall back to the shipping defaults.
 *
 * @param {object} [fidelitySettings]
 * @returns {{ authenticMinCutoffHz: number, suspiciousMinCutoffHz: number, transcodeMidCutoffHz: number, minTrustworthySampleRate: number }}
 */
export function mapFidelitySettingsToSpectralThresholds(fidelitySettings) {
  const settings = fidelitySettings && typeof fidelitySettings === 'object' ? fidelitySettings : {};
  return {
    authenticMinCutoffHz: pickNumber(settings.spectralAuthenticMinCutoffHz, DEFAULT_SPECTRAL_THRESHOLDS.authenticMinCutoffHz),
    suspiciousMinCutoffHz: pickNumber(settings.spectralSuspiciousMinCutoffHz, DEFAULT_SPECTRAL_THRESHOLDS.suspiciousMinCutoffHz),
    transcodeMidCutoffHz: pickNumber(settings.spectralTranscodeMidCutoffHz, DEFAULT_SPECTRAL_THRESHOLDS.transcodeMidCutoffHz),
    minTrustworthySampleRate: pickNumber(settings.spectralMinSampleRateHz, DEFAULT_SPECTRAL_THRESHOLDS.minTrustworthySampleRate),
  };
}

/**
 * Projects the persisted `fidelity` settings into the trust review threshold
 * shape. Missing keys fall back to the shipping defaults.
 *
 * @param {object} [fidelitySettings]
 * @returns {{ watchFailureCount: number, watchMaxSuccessRate: number, watchEvidenceCount: number, healthyEvidenceCount: number, healthyMinSuccessRate: number }}
 */
export function mapFidelitySettingsToTrustThresholds(fidelitySettings) {
  const settings = fidelitySettings && typeof fidelitySettings === 'object' ? fidelitySettings : {};
  return {
    watchFailureCount: pickNumber(settings.trustWatchFailureCount, DEFAULT_TRUST_THRESHOLDS.watchFailureCount),
    watchMaxSuccessRate: pickNumber(settings.trustWatchMaxSuccessRate, DEFAULT_TRUST_THRESHOLDS.watchMaxSuccessRate),
    watchEvidenceCount: pickNumber(settings.trustWatchEvidenceCount, DEFAULT_TRUST_THRESHOLDS.watchEvidenceCount),
    healthyEvidenceCount: pickNumber(settings.trustHealthyEvidenceCount, DEFAULT_TRUST_THRESHOLDS.healthyEvidenceCount),
    healthyMinSuccessRate: pickNumber(settings.trustHealthyMinSuccessRate, DEFAULT_TRUST_THRESHOLDS.healthyMinSuccessRate),
  };
}

/**
 * Builds best-effort async loaders that read the persisted `fidelity` namespace
 * and project it into the spectral and trust threshold shapes. A load failure
 * resolves to the shipping defaults so the live path never wedges.
 *
 * @param {object} deps
 * @param {() => Promise<object>} deps.loadSettingsFn
 * @returns {{ loadSpectralThresholdsFn: () => Promise<object>, loadTrustReviewThresholdsFn: () => Promise<object> }}
 */
export function createFidelityThresholdLoaders({ loadSettingsFn }) {
  async function loadFidelity() {
    if (typeof loadSettingsFn !== 'function') {
      return {};
    }
    try {
      const settings = await loadSettingsFn();
      return settings && typeof settings.fidelity === 'object' ? settings.fidelity : {};
    } catch {
      return {};
    }
  }

  return {
    async loadSpectralThresholdsFn() {
      return mapFidelitySettingsToSpectralThresholds(await loadFidelity());
    },
    async loadTrustReviewThresholdsFn() {
      return mapFidelitySettingsToTrustThresholds(await loadFidelity());
    },
  };
}
