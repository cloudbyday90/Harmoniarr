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

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFidelityThresholdLoaders,
  mapFidelitySettingsToSpectralThresholds,
  mapFidelitySettingsToTrustThresholds,
} from '../../src/server/fidelity-threshold-settings.js';

test('mapFidelitySettingsToSpectralThresholds reads the namespace and falls back to defaults', () => {
  const mapped = mapFidelitySettingsToSpectralThresholds({
    spectralAuthenticMinCutoffHz: 21000,
    spectralMinSampleRateHz: 48000,
  });
  assert.equal(mapped.authenticMinCutoffHz, 21000);
  assert.equal(mapped.minTrustworthySampleRate, 48000);
  // Unspecified keys default.
  assert.equal(mapped.suspiciousMinCutoffHz, 19000);
  assert.equal(mapped.transcodeMidCutoffHz, 16000);
});

test('mapFidelitySettingsToSpectralThresholds defaults on a non-object input', () => {
  const mapped = mapFidelitySettingsToSpectralThresholds(undefined);
  assert.equal(mapped.authenticMinCutoffHz, 20000);
});

test('mapFidelitySettingsToTrustThresholds reads the namespace and falls back to defaults', () => {
  const mapped = mapFidelitySettingsToTrustThresholds({
    trustWatchFailureCount: 5,
    trustHealthyMinSuccessRate: 0.9,
  });
  assert.equal(mapped.watchFailureCount, 5);
  assert.equal(mapped.healthyMinSuccessRate, 0.9);
  assert.equal(mapped.watchEvidenceCount, 3);
});

test('createFidelityThresholdLoaders project the fidelity namespace', async () => {
  const loaders = createFidelityThresholdLoaders({
    loadSettingsFn: async () => ({ fidelity: { spectralAuthenticMinCutoffHz: 22000, trustWatchFailureCount: 7 } }),
  });
  const spectral = await loaders.loadSpectralThresholdsFn();
  const trust = await loaders.loadTrustReviewThresholdsFn();
  assert.equal(spectral.authenticMinCutoffHz, 22000);
  assert.equal(trust.watchFailureCount, 7);
});

test('createFidelityThresholdLoaders fall back to defaults when settings load throws', async () => {
  const loaders = createFidelityThresholdLoaders({
    loadSettingsFn: async () => {
      throw new Error('unavailable');
    },
  });
  const spectral = await loaders.loadSpectralThresholdsFn();
  assert.equal(spectral.authenticMinCutoffHz, 20000);
});
