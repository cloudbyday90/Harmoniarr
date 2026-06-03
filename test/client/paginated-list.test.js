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
  clampVisibleCount,
  resolveNextVisibleCount,
  resolveRemainingCount,
} from '../../src/client/lib/paginated-list.js';

// ── clampVisibleCount ─────────────────────────────────────────────────────────

test('clampVisibleCount returns 0 when there are no items', () => {
  assert.equal(clampVisibleCount(12, 0, 12), 0);
});

test('clampVisibleCount floors at one page when the desired count is too small', () => {
  assert.equal(clampVisibleCount(1, 50, 12), 12);
});

test('clampVisibleCount caps at the total when the desired count is too large', () => {
  assert.equal(clampVisibleCount(999, 30, 12), 30);
});

test('clampVisibleCount uses total as the floor when total is below a page', () => {
  assert.equal(clampVisibleCount(12, 5, 12), 5);
});

test('clampVisibleCount returns the desired count when it is within bounds', () => {
  assert.equal(clampVisibleCount(24, 50, 12), 24);
});

test('clampVisibleCount handles a non-finite desired count by using the floor', () => {
  assert.equal(clampVisibleCount(Number.NaN, 50, 12), 12);
});

test('clampVisibleCount handles a non-finite total as zero', () => {
  assert.equal(clampVisibleCount(12, Number.NaN, 12), 0);
});

test('clampVisibleCount defaults the step to 12', () => {
  assert.equal(clampVisibleCount(1, 50), 12);
});

// ── resolveNextVisibleCount ───────────────────────────────────────────────────

test('resolveNextVisibleCount advances by exactly one step', () => {
  assert.equal(resolveNextVisibleCount(12, 50, 12), 24);
});

test('resolveNextVisibleCount caps the advance at the total', () => {
  assert.equal(resolveNextVisibleCount(45, 50, 12), 50);
});

test('resolveNextVisibleCount stays at the total once everything is visible', () => {
  assert.equal(resolveNextVisibleCount(50, 50, 12), 50);
});

test('resolveNextVisibleCount normalizes an out-of-range current count first', () => {
  assert.equal(resolveNextVisibleCount(1, 50, 12), 24);
});

test('resolveNextVisibleCount returns 0 when there are no items', () => {
  assert.equal(resolveNextVisibleCount(0, 0, 12), 0);
});

// ── resolveRemainingCount ─────────────────────────────────────────────────────

test('resolveRemainingCount reports the hidden tail', () => {
  assert.equal(resolveRemainingCount(12, 50), 38);
});

test('resolveRemainingCount returns 0 when everything is visible', () => {
  assert.equal(resolveRemainingCount(50, 50), 0);
});

test('resolveRemainingCount never returns a negative number', () => {
  assert.equal(resolveRemainingCount(60, 50), 0);
});

test('resolveRemainingCount treats a non-finite visible count as zero shown', () => {
  assert.equal(resolveRemainingCount(Number.NaN, 50), 50);
});

test('resolveRemainingCount returns 0 for an empty list', () => {
  assert.equal(resolveRemainingCount(0, 0), 0);
});
