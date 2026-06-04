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
import { createSourceUserSpectralPolicySimulationService } from '../../src/server/activity/source-user-spectral-policy-simulation-service.js';

test('simulateSpectralPolicy loads measurements + baseline and runs the simulator', async () => {
  const captured = {};
  const service = createSourceUserSpectralPolicySimulationService({
    listRecentSpectralMeasurementsFn: async ({ limit }) => {
      captured.limit = limit;
      return [{ contentHash: 'a', cutoffHz: 19500, sampleRate: 44100, declaredCodec: 'flac' }];
    },
    loadSpectralThresholdsFn: async () => ({ authenticMinCutoffHz: 19000 }),
    simulateSpectralThresholdPolicyFn: (input) => {
      captured.simInput = input;
      return { evaluatedMeasurementCount: 1, changedMeasurementCount: 0 };
    },
    measurementLimit: 250,
  });

  const result = await service.simulateSpectralPolicy({ thresholds: { authenticMinCutoffHz: 21000 } });
  assert.equal(captured.limit, 250);
  assert.deepEqual(captured.simInput.thresholds, { authenticMinCutoffHz: 21000 });
  assert.deepEqual(captured.simInput.currentThresholds, { authenticMinCutoffHz: 19000 });
  assert.equal(result.evaluatedMeasurementCount, 1);
  assert.ok(result.checkedAt);
});

test('simulateSpectralPolicy tolerates a baseline loader failure', async () => {
  const captured = {};
  const service = createSourceUserSpectralPolicySimulationService({
    listRecentSpectralMeasurementsFn: async () => [],
    loadSpectralThresholdsFn: async () => {
      throw new Error('settings unavailable');
    },
    simulateSpectralThresholdPolicyFn: (input) => {
      captured.simInput = input;
      return { evaluatedMeasurementCount: 0 };
    },
  });

  await service.simulateSpectralPolicy({ thresholds: {} });
  assert.equal(captured.simInput.currentThresholds, undefined);
});

test('createSourceUserSpectralPolicySimulationService requires a measurement loader', () => {
  assert.throws(() => createSourceUserSpectralPolicySimulationService({}), /listRecentSpectralMeasurementsFn/);
});
