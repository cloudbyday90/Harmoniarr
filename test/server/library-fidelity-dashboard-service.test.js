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
  buildFidelityHealthSummary,
  createLibraryFidelityDashboardService,
} from '../../src/server/library/library-fidelity-dashboard-service.js';

test('buildFidelityHealthSummary derives a weighted health score over the conclusive population', () => {
  const summary = buildFidelityHealthSummary({
    verdictDistribution: [
      { verdict: 'authentic', count: 6 },
      { verdict: 'suspicious', count: 2 },
      { verdict: 'transcoded', count: 2 },
      { verdict: 'inconclusive', count: 5 },
    ],
  });
  assert.equal(summary.totalMeasurements, 15);
  assert.equal(summary.conclusiveMeasurements, 10);
  // (6 + 2*0.5) / 10 = 0.7 -> 70.
  assert.equal(summary.healthScore, 70);
  // 2 / 10 = 0.2 -> 20.
  assert.equal(summary.transcodeRatePercent, 20);
});

test('buildFidelityHealthSummary returns a null score for a fresh (empty) catalog', () => {
  const summary = buildFidelityHealthSummary();
  assert.equal(summary.totalMeasurements, 0);
  assert.equal(summary.healthScore, null);
  assert.equal(summary.transcodeRatePercent, null);
  assert.deepEqual(summary.verdictCounts, { authentic: 0, suspicious: 0, transcoded: 0, inconclusive: 0 });
});

test('buildFidelityHealthSummary folds unknown verdicts into inconclusive', () => {
  const summary = buildFidelityHealthSummary({
    verdictDistribution: [{ verdict: 'mystery', count: 3 }],
  });
  assert.equal(summary.verdictCounts.inconclusive, 3);
});

test('getFidelityHealthDashboard composes aggregates and stamps checkedAt', async () => {
  const service = createLibraryFidelityDashboardService({
    getFidelityHealthAggregatesFn: async () => ({
      verdictDistribution: [{ verdict: 'authentic', count: 4 }],
      codecBreakdown: [{ codec: 'flac', count: 4 }],
      worstOffenders: [],
      dailyTrend: [],
    }),
  });
  const dashboard = await service.getFidelityHealthDashboard({});
  assert.equal(dashboard.totalMeasurements, 4);
  assert.equal(dashboard.codecBreakdown[0].codec, 'flac');
  assert.ok(dashboard.checkedAt);
});

test('getFidelityHealthDashboard fails safe to an empty summary on aggregate error', async () => {
  const warnings = [];
  const service = createLibraryFidelityDashboardService({
    getFidelityHealthAggregatesFn: async () => {
      throw new Error('table missing');
    },
    onWarning: (message) => warnings.push(message),
  });
  const dashboard = await service.getFidelityHealthDashboard({});
  assert.equal(dashboard.totalMeasurements, 0);
  assert.equal(dashboard.healthScore, null);
  assert.ok(dashboard.checkedAt);
  assert.equal(warnings.length, 1);
});

test('createLibraryFidelityDashboardService requires the aggregate loader', () => {
  assert.throws(() => createLibraryFidelityDashboardService({}), /getFidelityHealthAggregatesFn/);
});
