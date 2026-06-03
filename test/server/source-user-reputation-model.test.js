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
  buildRecencyWeightedReputation,
  computeDecayedOutcomeCounts,
  computeWilsonScoreInterval,
  evaluateAutoIgnoreSuggestion,
} from '../../src/server/activity/source-user-reputation-model.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

test('computeWilsonScoreInterval returns a zero interval for an empty sample', () => {
  assert.deepEqual(computeWilsonScoreInterval(0, 0), { lowerBound: 0, point: 0, upperBound: 0 });
});

test('computeWilsonScoreInterval keeps the lower bound below the point estimate for small samples', () => {
  const interval = computeWilsonScoreInterval(1, 1);
  assert.equal(interval.point, 1);
  assert.ok(interval.lowerBound > 0 && interval.lowerBound < 1);
  assert.ok(interval.lowerBound < interval.point);
});

test('computeWilsonScoreInterval tightens as the sample grows', () => {
  const small = computeWilsonScoreInterval(9, 10);
  const large = computeWilsonScoreInterval(90, 100);
  assert.ok(large.lowerBound > small.lowerBound);
  assert.ok(large.upperBound < small.upperBound);
});

test('computeWilsonScoreInterval guards against invalid counts', () => {
  assert.deepEqual(computeWilsonScoreInterval(5, 2), { lowerBound: 0, point: 0, upperBound: 0 });
  assert.deepEqual(computeWilsonScoreInterval(-1, -1), { lowerBound: 0, point: 0, upperBound: 0 });
});

test('computeDecayedOutcomeCounts weights recent outcomes more heavily', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const decayed = computeDecayedOutcomeCounts(
    [
      { outcome: 'success', occurredAt: new Date(now).toISOString() },
      { outcome: 'failure', occurredAt: new Date(now - 30 * MS_PER_DAY).toISOString() },
    ],
    { now, halfLifeDays: 30 },
  );

  assert.equal(decayed.sampleSize, 2);
  assert.ok(Math.abs(decayed.decayedSuccess - 1) < 1e-9);
  assert.ok(Math.abs(decayed.decayedFailure - 0.5) < 1e-9);
  assert.ok(Math.abs(decayed.decayedTotal - 1.5) < 1e-9);
  assert.equal(decayed.lastOutcomeAt, new Date(now).toISOString());
});

test('computeDecayedOutcomeCounts discards outcomes beyond the max age window', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const decayed = computeDecayedOutcomeCounts(
    [
      { outcome: 'success', occurredAt: new Date(now - 400 * MS_PER_DAY).toISOString() },
      { outcome: 'failure', occurredAt: new Date(now).toISOString() },
    ],
    { now, maxAgeDays: 180 },
  );

  assert.equal(decayed.sampleSize, 1);
  assert.equal(decayed.decayedSuccess, 0);
  assert.ok(Math.abs(decayed.decayedFailure - 1) < 1e-9);
});

test('computeDecayedOutcomeCounts splits a quality-weighted success between success and failure mass', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const decayed = computeDecayedOutcomeCounts(
    [{ outcome: 'success', qualityWeight: 0.4, occurredAt: new Date(now).toISOString() }],
    { now },
  );

  // A 0.4-quality success contributes 0.4 to success and 0.6 to failure mass.
  assert.ok(Math.abs(decayed.decayedSuccess - 0.4) < 1e-9);
  assert.ok(Math.abs(decayed.decayedFailure - 0.6) < 1e-9);
  assert.ok(Math.abs(decayed.decayedTotal - 1) < 1e-9);
});

test('computeDecayedOutcomeCounts treats an absent quality weight as a full-quality success', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const decayed = computeDecayedOutcomeCounts(
    [{ outcome: 'success', occurredAt: new Date(now).toISOString() }],
    { now },
  );

  assert.ok(Math.abs(decayed.decayedSuccess - 1) < 1e-9);
  assert.equal(decayed.decayedFailure, 0);
});

test('computeDecayedOutcomeCounts ignores malformed events', () => {
  const decayed = computeDecayedOutcomeCounts([
    { outcome: 'maybe', occurredAt: new Date().toISOString() },
    { outcome: 'success', occurredAt: 'not-a-date' },
    null,
  ]);

  assert.equal(decayed.sampleSize, 0);
  assert.equal(decayed.decayedTotal, 0);
  assert.equal(decayed.lastOutcomeAt, null);
});

test('buildRecencyWeightedReputation derives failure ratio and Wilson bounds', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const reputation = buildRecencyWeightedReputation({
    events: [
      { outcome: 'failure', occurredAt: new Date(now).toISOString() },
      { outcome: 'failure', occurredAt: new Date(now).toISOString() },
      { outcome: 'failure', occurredAt: new Date(now).toISOString() },
      { outcome: 'success', occurredAt: new Date(now).toISOString() },
    ],
    now,
  });

  assert.equal(reputation.sampleSize, 4);
  assert.ok(Math.abs(reputation.decayedFailureRatio - 0.75) < 1e-9);
  assert.ok(reputation.wilsonLowerBound < reputation.successRatePoint);
  assert.ok(reputation.wilsonUpperBound > reputation.successRatePoint);
});

test('evaluateAutoIgnoreSuggestion suggests ignore for a confident failure-dominated peer', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const events = Array.from({ length: 10 }, (_, index) => ({
    outcome: index === 0 ? 'success' : 'failure',
    occurredAt: new Date(now - index * MS_PER_DAY).toISOString(),
  }));
  const reputation = buildRecencyWeightedReputation({ events, now });
  const suggestion = evaluateAutoIgnoreSuggestion({ reputation });

  assert.equal(suggestion.suggested, true);
  assert.match(suggestion.reason, /failure-dominated/);
  assert.equal(suggestion.signals.failureDominant, true);
  assert.equal(suggestion.signals.confidentlyUnreliable, true);
});

test('evaluateAutoIgnoreSuggestion does not suggest ignore for a small or healthy sample', () => {
  const now = Date.parse('2026-06-27T00:00:00.000Z');
  const tinySample = evaluateAutoIgnoreSuggestion({
    reputation: buildRecencyWeightedReputation({
      events: [
        { outcome: 'failure', occurredAt: new Date(now).toISOString() },
        { outcome: 'failure', occurredAt: new Date(now).toISOString() },
      ],
      now,
    }),
  });
  assert.equal(tinySample.suggested, false);
  assert.equal(tinySample.reason, null);

  const healthy = evaluateAutoIgnoreSuggestion({
    reputation: buildRecencyWeightedReputation({
      events: Array.from({ length: 12 }, () => ({ outcome: 'success', occurredAt: new Date(now).toISOString() })),
      now,
    }),
  });
  assert.equal(healthy.suggested, false);
});
