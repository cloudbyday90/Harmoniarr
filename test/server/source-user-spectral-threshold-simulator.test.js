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
import { simulateSpectralThresholdPolicy } from '../../src/server/activity/source-user-spectral-threshold-simulator.js';

const MEASUREMENTS = [
  // 19500 Hz lossless FLAC: suspicious by default, authentic if edge lowered.
  { contentHash: 'a', username: 'alice', cutoffHz: 19500, sampleRate: 44100, declaredCodec: 'flac' },
  // 21000 Hz lossless: always authentic.
  { contentHash: 'b', username: 'bob', cutoffHz: 21000, sampleRate: 44100, declaredCodec: 'flac' },
  // 15800 Hz lossless: always transcoded.
  { contentHash: 'c', username: 'carol', cutoffHz: 15800, sampleRate: 44100, declaredExtension: '.flac' },
];

test('simulateSpectralThresholdPolicy re-grades the population under a lower authentic edge', () => {
  const result = simulateSpectralThresholdPolicy({
    measurements: MEASUREMENTS,
    thresholds: { authenticMinCutoffHz: 19000, suspiciousMinCutoffHz: 18000 },
  });

  assert.equal(result.evaluatedMeasurementCount, 3);
  // The 19500 Hz file flips suspicious -> authentic.
  assert.equal(result.changedMeasurementCount, 1);
  assert.equal(result.summary.current.suspicious, 1);
  assert.equal(result.summary.projected.suspicious, 0);
  assert.equal(result.summary.projected.authentic, 2);
  assert.deepEqual(result.transitions, [{ from: 'suspicious', to: 'authentic', count: 1 }]);
});

test('simulateSpectralThresholdPolicy reports no change when thresholds match the baseline', () => {
  const result = simulateSpectralThresholdPolicy({ measurements: MEASUREMENTS, thresholds: {} });
  assert.equal(result.changedMeasurementCount, 0);
  assert.equal(result.transitions.length, 0);
});

test('simulateSpectralThresholdPolicy classifies the current state under the supplied baseline', () => {
  // Baseline already lowered: 19500 is authentic in the current state, so a
  // proposed default (authentic 20000) would flip it back to suspicious.
  const result = simulateSpectralThresholdPolicy({
    measurements: [MEASUREMENTS[0]],
    currentThresholds: { authenticMinCutoffHz: 19000, suspiciousMinCutoffHz: 18000 },
    thresholds: { authenticMinCutoffHz: 20000, suspiciousMinCutoffHz: 19000 },
  });
  assert.equal(result.summary.current.authentic, 1);
  assert.equal(result.summary.projected.suspicious, 1);
  assert.equal(result.changedMeasurementCount, 1);
});

test('simulateSpectralThresholdPolicy skips measurements without a usable cutoff', () => {
  const result = simulateSpectralThresholdPolicy({
    measurements: [{ contentHash: 'x', cutoffHz: 0 }, { cutoffHz: null }, 'nope'],
    thresholds: {},
  });
  assert.equal(result.evaluatedMeasurementCount, 0);
});

test('simulateSpectralThresholdPolicy tolerates a non-array measurement input', () => {
  const result = simulateSpectralThresholdPolicy({ measurements: undefined, thresholds: {} });
  assert.equal(result.evaluatedMeasurementCount, 0);
  assert.ok(result.thresholds);
  assert.ok(result.defaultThresholds);
});
