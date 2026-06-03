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
import { buildQualityTrend } from '../../src/server/activity/source-user-quality-trend.js';

const NOW = new Date('2026-06-03T00:00:00.000Z');

function daysAgo(days) {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

test('buildQualityTrend returns an empty, insufficient projection for no events', () => {
  const trend = buildQualityTrend({ events: [], now: NOW });
  assert.equal(trend.sampleCount, 0);
  assert.equal(trend.series.length, 0);
  assert.equal(trend.trendDirection, 'insufficient');
  assert.equal(trend.degradedRecently, false);
  assert.equal(trend.alwaysPoor, false);
});

test('buildQualityTrend flags a peer that degraded recently after a clean history', () => {
  const events = [
    { occurredAt: daysAgo(120), outcome: 'success', qualityWeight: 1 },
    { occurredAt: daysAgo(110), outcome: 'success', qualityWeight: 0.95 },
    { occurredAt: daysAgo(100), outcome: 'success', qualityWeight: 1 },
    { occurredAt: daysAgo(90), outcome: 'success', qualityWeight: 0.9 },
    { occurredAt: daysAgo(10), outcome: 'failure', qualityWeight: 0.1, qualityLabel: 'spectral_transcode_confirmed' },
    { occurredAt: daysAgo(5), outcome: 'success', qualityWeight: 0.15, qualityLabel: 'lossless_low_bitrate' },
    { occurredAt: daysAgo(1), outcome: 'success', qualityWeight: 0.2 },
  ];

  const trend = buildQualityTrend({ events, now: NOW });

  assert.equal(trend.degradedRecently, true);
  assert.equal(trend.alwaysPoor, false);
  assert.equal(trend.trendDirection, 'degrading');
  assert.ok(trend.priorAverage > 0.75);
  assert.ok(trend.recentAverage < 0.5);
});

test('buildQualityTrend flags a consistently poor peer as alwaysPoor, not degraded', () => {
  const events = [
    { occurredAt: daysAgo(60), outcome: 'success', qualityWeight: 0.2 },
    { occurredAt: daysAgo(45), outcome: 'failure', qualityWeight: 0.1 },
    { occurredAt: daysAgo(20), outcome: 'success', qualityWeight: 0.25 },
    { occurredAt: daysAgo(5), outcome: 'success', qualityWeight: 0.2 },
  ];

  const trend = buildQualityTrend({ events, now: NOW });

  assert.equal(trend.alwaysPoor, true);
  assert.equal(trend.degradedRecently, false);
});

test('buildQualityTrend orders the series oldest to newest and aggregates the signal mix', () => {
  const events = [
    { occurredAt: daysAgo(2), outcome: 'success', qualityWeight: 0.3, qualityLabel: 'low_bitrate' },
    { occurredAt: daysAgo(10), outcome: 'success', qualityWeight: 0.4, qualityLabel: 'low_bitrate' },
    { occurredAt: daysAgo(1), outcome: 'success', qualityWeight: 0.2, qualityLabel: 'incomplete_tags' },
  ];

  const trend = buildQualityTrend({ events, now: NOW });

  assert.equal(trend.series.length, 3);
  assert.ok(Date.parse(trend.series[0].occurredAt) < Date.parse(trend.series[2].occurredAt));
  assert.deepEqual(trend.signalMix[0], { count: 2, label: 'low_bitrate' });
});

test('buildQualityTrend treats legacy weightless events with binary semantics', () => {
  const events = [
    { occurredAt: daysAgo(3), outcome: 'failure' },
    { occurredAt: daysAgo(2), outcome: 'success' },
  ];

  const trend = buildQualityTrend({ events, now: NOW });

  assert.ok(Math.abs(trend.lifetimeAverage - 0.5) < 1e-9);
});
