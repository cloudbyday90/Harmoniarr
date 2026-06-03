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
  filterIgnoredSourceUsers,
  formatIgnoreActor,
  formatIgnoreReason,
  formatIgnoreSource,
  formatIgnoredUserCountLabel,
  formatSourceUsername,
  formatSuggestionReason,
  formatSuggestionSignals,
} from '../../src/client/lib/source-user-ignore-presentation.js';

test('formatIgnoredUserCountLabel handles empty, singular, and plural counts', () => {
  assert.equal(formatIgnoredUserCountLabel(0), 'No ignored source users');
  assert.equal(formatIgnoredUserCountLabel(-1), 'No ignored source users');
  assert.equal(formatIgnoredUserCountLabel(NaN), 'No ignored source users');
  assert.equal(formatIgnoredUserCountLabel(1), '1 ignored source user');
  assert.equal(formatIgnoredUserCountLabel(3), '3 ignored source users');
});

test('formatSourceUsername falls back to "Unknown peer"', () => {
  assert.equal(formatSourceUsername('Alice'), 'Alice');
  assert.equal(formatSourceUsername('   '), 'Unknown peer');
  assert.equal(formatSourceUsername(null), 'Unknown peer');
});

test('formatIgnoreReason falls back when blank', () => {
  assert.equal(formatIgnoreReason('Repeated fakes'), 'Repeated fakes');
  assert.equal(formatIgnoreReason(''), 'No reason recorded');
});

test('formatIgnoreSource maps provenance to readable labels', () => {
  assert.equal(formatIgnoreSource('auto'), 'Auto-applied');
  assert.equal(formatIgnoreSource('manual'), 'Operator');
  assert.equal(formatIgnoreSource('other'), 'other');
  assert.equal(formatIgnoreSource(null), 'Unknown');
});

test('formatIgnoreActor falls back to "System"', () => {
  assert.equal(formatIgnoreActor('admin-1'), 'admin-1');
  assert.equal(formatIgnoreActor(null), 'System');
});

test('formatSuggestionReason provides a default explanation', () => {
  assert.equal(formatSuggestionReason('Failure dominated'), 'Failure dominated');
  assert.equal(formatSuggestionReason(''), 'Repeated low-quality deliveries');
});

test('formatSuggestionSignals renders a compact summary', () => {
  assert.equal(
    formatSuggestionSignals({ sampleSize: 10, decayedFailureRatio: 0.8, successUpperBound: 0.2 }),
    '10 samples · 80% recent failures · ≤20% success bound',
  );
  assert.equal(formatSuggestionSignals(null), '—');
  assert.equal(formatSuggestionSignals({}), '—');
});

test('filterIgnoredSourceUsers matches across username, reason, and source', () => {
  const entries = [
    { username: 'Alice', reason: 'Repeated fakes', source: 'manual' },
    { username: 'Bob', reason: 'Auto flagged', source: 'auto' },
  ];

  assert.equal(filterIgnoredSourceUsers(entries, '').length, 2);
  assert.equal(filterIgnoredSourceUsers(entries, 'alice').length, 1);
  assert.equal(filterIgnoredSourceUsers(entries, 'auto')[0].username, 'Bob');
  assert.equal(filterIgnoredSourceUsers(entries, 'fakes')[0].username, 'Alice');
  assert.deepEqual(filterIgnoredSourceUsers(null, 'x'), []);
});
