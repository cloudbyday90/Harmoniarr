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
  SPECTRAL_THRESHOLD_FIELDS,
  buildFidelityDashboardViewModel,
  buildSpectralThresholdSettingsPatch,
  buildVerdictComparisonRows,
  formatHealthScore,
  formatSpectralSimulationHeadline,
  formatVerdictTone,
} from '../../src/client/lib/library-fidelity-presentation.js';

test('SPECTRAL_THRESHOLD_FIELDS exposes the cutoff and sample-rate controls', () => {
  const keys = SPECTRAL_THRESHOLD_FIELDS.map((field) => field.key);
  assert.deepEqual(keys, ['authenticMinCutoffHz', 'suspiciousMinCutoffHz', 'transcodeMidCutoffHz', 'minTrustworthySampleRate']);
});

test('formatVerdictTone maps verdicts to semantic tones', () => {
  assert.equal(formatVerdictTone('authentic'), 'success');
  assert.equal(formatVerdictTone('suspicious'), 'warning');
  assert.equal(formatVerdictTone('transcoded'), 'danger');
  assert.equal(formatVerdictTone('mystery'), 'neutral');
});

test('buildVerdictComparisonRows aligns current and projected counts', () => {
  const rows = buildVerdictComparisonRows({
    current: { authentic: 2, suspicious: 1 },
    projected: { authentic: 3, transcoded: 1 },
  });
  const byVerdict = Object.fromEntries(rows.map((row) => [row.verdict, row]));
  assert.equal(byVerdict.authentic.current, 2);
  assert.equal(byVerdict.authentic.projected, 3);
  assert.equal(byVerdict.transcoded.current, 0);
  assert.equal(byVerdict.transcoded.projected, 1);
});

test('formatSpectralSimulationHeadline summarizes the re-grade outcome', () => {
  assert.match(formatSpectralSimulationHeadline({ evaluatedMeasurementCount: 0 }), /No measurements/);
  assert.match(formatSpectralSimulationHeadline({ evaluatedMeasurementCount: 5, changedMeasurementCount: 0 }), /No re-grades across 5/);
  assert.match(formatSpectralSimulationHeadline({ evaluatedMeasurementCount: 5, changedMeasurementCount: 1 }), /1 measurement of 5/);
});

test('formatHealthScore bands the score into tones', () => {
  assert.deepEqual(formatHealthScore(95), { label: '95', tone: 'success' });
  assert.deepEqual(formatHealthScore(75), { label: '75', tone: 'warning' });
  assert.deepEqual(formatHealthScore(40), { label: '40', tone: 'danger' });
  assert.deepEqual(formatHealthScore(null), { label: '—', tone: 'neutral' });
});

test('buildFidelityDashboardViewModel defends against missing arrays', () => {
  const vm = buildFidelityDashboardViewModel(undefined);
  assert.equal(vm.totalMeasurements, 0);
  assert.deepEqual(vm.codecBreakdown, []);
  assert.equal(vm.verdictRows.length, 4);
  assert.equal(vm.healthScore.tone, 'neutral');
});

test('buildSpectralThresholdSettingsPatch maps the in-memory shape to settings keys', () => {
  const patch = buildSpectralThresholdSettingsPatch({
    authenticMinCutoffHz: 21000.4,
    suspiciousMinCutoffHz: 20000,
    transcodeMidCutoffHz: 17000,
    minTrustworthySampleRate: 48000,
  });
  assert.deepEqual(patch, {
    spectralAuthenticMinCutoffHz: 21000,
    spectralSuspiciousMinCutoffHz: 20000,
    spectralTranscodeMidCutoffHz: 17000,
    spectralMinSampleRateHz: 48000,
  });
});

test('buildSpectralThresholdSettingsPatch omits non-finite values', () => {
  const patch = buildSpectralThresholdSettingsPatch({ authenticMinCutoffHz: 'nope' });
  assert.deepEqual(patch, {});
});
