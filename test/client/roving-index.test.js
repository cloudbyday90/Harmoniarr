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
import { resolveRovingIntent, resolveRovingIndex } from '../../src/client/lib/roving-index.js';

// ── resolveRovingIntent ───────────────────────────────────────────────────────

test('resolveRovingIntent maps the four arrow keys', () => {
  assert.equal(resolveRovingIntent({ key: 'ArrowRight' }), 'next');
  assert.equal(resolveRovingIntent({ key: 'ArrowLeft' }), 'prev');
  assert.equal(resolveRovingIntent({ key: 'ArrowDown' }), 'down');
  assert.equal(resolveRovingIntent({ key: 'ArrowUp' }), 'up');
});

test('resolveRovingIntent treats plain Home/End as row-scoped', () => {
  assert.equal(resolveRovingIntent({ key: 'Home' }), 'row-start');
  assert.equal(resolveRovingIntent({ key: 'End' }), 'row-end');
});

test('resolveRovingIntent treats Ctrl+Home/Ctrl+End as grid-scoped', () => {
  assert.equal(resolveRovingIntent({ key: 'Home', ctrlKey: true }), 'first');
  assert.equal(resolveRovingIntent({ key: 'End', ctrlKey: true }), 'last');
});

test('resolveRovingIntent treats Cmd (metaKey) Home/End as grid-scoped on macOS', () => {
  assert.equal(resolveRovingIntent({ key: 'Home', metaKey: true }), 'first');
  assert.equal(resolveRovingIntent({ key: 'End', metaKey: true }), 'last');
});

test('resolveRovingIntent ignores modifier keys on arrows', () => {
  // Arrow intent is the same regardless of held modifier.
  assert.equal(resolveRovingIntent({ key: 'ArrowRight', ctrlKey: true }), 'next');
  assert.equal(resolveRovingIntent({ key: 'ArrowDown', metaKey: true }), 'down');
});

test('resolveRovingIntent returns null for non-navigation keys', () => {
  assert.equal(resolveRovingIntent({ key: 'Enter' }), null);
  assert.equal(resolveRovingIntent({ key: ' ' }), null);
  assert.equal(resolveRovingIntent({ key: 'Tab' }), null);
  assert.equal(resolveRovingIntent({ key: 'a' }), null);
});

test('resolveRovingIntent returns null for a missing or non-string key', () => {
  assert.equal(resolveRovingIntent({}), null);
  assert.equal(resolveRovingIntent({ key: undefined }), null);
  assert.equal(resolveRovingIntent({ key: 39 }), null);
  assert.equal(resolveRovingIntent(), null);
});

test('resolveRovingIntent treats ctrlKey/metaKey as strict booleans', () => {
  // Truthy coercion must not trigger the grid-wide modifier.
  assert.equal(resolveRovingIntent({ key: 'Home', ctrlKey: 'yes' }), 'row-start');
  assert.equal(resolveRovingIntent({ key: 'End', metaKey: 1 }), 'row-end');
});

// ── resolveRovingIntent — axis ────────────────────────────────────────────────

test('resolveRovingIntent defaults to the grid axis (all four arrows active)', () => {
  assert.equal(resolveRovingIntent({ key: 'ArrowRight' }), 'next');
  assert.equal(resolveRovingIntent({ key: 'ArrowLeft' }), 'prev');
  assert.equal(resolveRovingIntent({ key: 'ArrowDown' }), 'down');
  assert.equal(resolveRovingIntent({ key: 'ArrowUp' }), 'up');
  // Grid keeps row-scoped Home/End and Ctrl-scoped first/last.
  assert.equal(resolveRovingIntent({ key: 'Home' }), 'row-start');
  assert.equal(resolveRovingIntent({ key: 'Home', ctrlKey: true }), 'first');
});

test('resolveRovingIntent horizontal axis ignores Up/Down', () => {
  assert.equal(resolveRovingIntent({ key: 'ArrowRight', axis: 'horizontal' }), 'next');
  assert.equal(resolveRovingIntent({ key: 'ArrowLeft', axis: 'horizontal' }), 'prev');
  assert.equal(resolveRovingIntent({ key: 'ArrowDown', axis: 'horizontal' }), null);
  assert.equal(resolveRovingIntent({ key: 'ArrowUp', axis: 'horizontal' }), null);
});

test('resolveRovingIntent horizontal axis maps Home/End to first/last (no row concept)', () => {
  assert.equal(resolveRovingIntent({ key: 'Home', axis: 'horizontal' }), 'first');
  assert.equal(resolveRovingIntent({ key: 'End', axis: 'horizontal' }), 'last');
  // Modifier does not change it in a 1-D list.
  assert.equal(resolveRovingIntent({ key: 'Home', axis: 'horizontal', ctrlKey: true }), 'first');
  assert.equal(resolveRovingIntent({ key: 'End', axis: 'horizontal', metaKey: true }), 'last');
});

test('resolveRovingIntent vertical axis ignores Left/Right', () => {
  assert.equal(resolveRovingIntent({ key: 'ArrowDown', axis: 'vertical' }), 'down');
  assert.equal(resolveRovingIntent({ key: 'ArrowUp', axis: 'vertical' }), 'up');
  assert.equal(resolveRovingIntent({ key: 'ArrowRight', axis: 'vertical' }), null);
  assert.equal(resolveRovingIntent({ key: 'ArrowLeft', axis: 'vertical' }), null);
  assert.equal(resolveRovingIntent({ key: 'Home', axis: 'vertical' }), 'first');
  assert.equal(resolveRovingIntent({ key: 'End', axis: 'vertical' }), 'last');
});

test('resolveRovingIntent horizontal axis still ignores non-navigation keys', () => {
  assert.equal(resolveRovingIntent({ key: 'Enter', axis: 'horizontal' }), null);
  assert.equal(resolveRovingIntent({ key: 'Tab', axis: 'horizontal' }), null);
});

// ── resolveRovingIndex — horizontal ───────────────────────────────────────────

test('resolveRovingIndex moves next/prev within bounds', () => {
  assert.equal(resolveRovingIndex(3, 'next', 4, 12), 4);
  assert.equal(resolveRovingIndex(3, 'prev', 4, 12), 2);
});

test('resolveRovingIndex stops (does not wrap) at the grid edges', () => {
  assert.equal(resolveRovingIndex(11, 'next', 4, 12), 11);
  assert.equal(resolveRovingIndex(0, 'prev', 4, 12), 0);
});

test('resolveRovingIndex stops at the right edge of a partial last row', () => {
  // 10 items, 4 columns → last row has indices 8,9. From 9, next stops.
  assert.equal(resolveRovingIndex(9, 'next', 4, 10), 9);
});

// ── resolveRovingIndex — vertical ─────────────────────────────────────────────

test('resolveRovingIndex moves down/up by the column stride', () => {
  assert.equal(resolveRovingIndex(1, 'down', 4, 12), 5);
  assert.equal(resolveRovingIndex(5, 'up', 4, 12), 1);
});

test('resolveRovingIndex down from the last row stops at the edge', () => {
  // Row 0: 0-3, row 1: 4-7, row 2: 8-11. From 9 (last row), down is a no-op.
  assert.equal(resolveRovingIndex(9, 'down', 4, 12), 9);
});

test('resolveRovingIndex down lands on the last item when the target row is partial', () => {
  // 10 items, 4 columns. From index 7 (end of row 1), down targets 11 → clamps to 9.
  assert.equal(resolveRovingIndex(7, 'down', 4, 10), 9);
});

test('resolveRovingIndex up from the first row stays put', () => {
  assert.equal(resolveRovingIndex(2, 'up', 4, 12), 2);
  assert.equal(resolveRovingIndex(0, 'up', 4, 12), 0);
});

// ── resolveRovingIndex — Home / End (row and grid) ────────────────────────────

test('resolveRovingIndex row-start/row-end jump to the current row edges', () => {
  // 4 columns: row 1 = indices 4,5,6,7.
  assert.equal(resolveRovingIndex(6, 'row-start', 4, 12), 4);
  assert.equal(resolveRovingIndex(5, 'row-end', 4, 12), 7);
});

test('resolveRovingIndex row-end clamps when the last row is partial', () => {
  // 10 items, 4 columns: last row = 8,9. From 8, row-end targets 11 → clamps to 9.
  assert.equal(resolveRovingIndex(8, 'row-end', 4, 10), 9);
});

test('resolveRovingIndex first/last jump to the grid edges', () => {
  assert.equal(resolveRovingIndex(7, 'first', 4, 12), 0);
  assert.equal(resolveRovingIndex(2, 'last', 4, 12), 11);
});

// ── resolveRovingIndex — clamping & guards ────────────────────────────────────

test('resolveRovingIndex clamps a stale current index into range before moving', () => {
  // current=99 in a 12-item grid normalizes to 11, then next stays at 11.
  assert.equal(resolveRovingIndex(99, 'next', 4, 12), 11);
  // current=-3 normalizes to 0, then prev stays at 0.
  assert.equal(resolveRovingIndex(-3, 'prev', 4, 12), 0);
});

test('resolveRovingIndex defaults an unknown current index to the first cell', () => {
  assert.equal(resolveRovingIndex(Number.NaN, 'next', 4, 12), 1);
});

test('resolveRovingIndex treats a single-column layout as a linear list', () => {
  // Up/Down move by 1; horizontal is still valid and also moves by 1.
  assert.equal(resolveRovingIndex(0, 'down', 1, 5), 1);
  assert.equal(resolveRovingIndex(2, 'up', 1, 5), 1);
  assert.equal(resolveRovingIndex(0, 'next', 1, 5), 1);
  assert.equal(resolveRovingIndex(4, 'prev', 1, 5), 3);
  assert.equal(resolveRovingIndex(2, 'row-start', 1, 5), 2);
  assert.equal(resolveRovingIndex(2, 'row-end', 1, 5), 2);
});

test('resolveRovingIndex clamps columns down to total when columns exceed items', () => {
  // 3 items but layout reports 6 columns → behaves as 3-wide single row.
  assert.equal(resolveRovingIndex(0, 'row-end', 6, 3), 2);
  assert.equal(resolveRovingIndex(1, 'down', 6, 3), 1);
});

test('resolveRovingIndex coerces non-finite columns to a single column', () => {
  assert.equal(resolveRovingIndex(0, 'down', Number.NaN, 5), 1);
  assert.equal(resolveRovingIndex(0, 'down', 0, 5), 1);
});

test('resolveRovingIndex returns null for an empty grid', () => {
  assert.equal(resolveRovingIndex(0, 'next', 4, 0), null);
  assert.equal(resolveRovingIndex(0, 'first', 4, 0), null);
});

test('resolveRovingIndex returns null for a non-finite total', () => {
  assert.equal(resolveRovingIndex(0, 'next', 4, Number.NaN), null);
});

test('resolveRovingIndex returns null for an unknown intent', () => {
  assert.equal(resolveRovingIndex(0, 'diagonal', 4, 12), null);
});

test('resolveRovingIndex returns null for a null intent', () => {
  assert.equal(resolveRovingIndex(0, null, 4, 12), null);
});

// ── integration: intent → index ───────────────────────────────────────────────

test('a full keyboard walk across a 3x4 grid never overflows', () => {
  const total = 12;
  const cols = 4;
  let index = 0;
  const step = (descriptor) => {
    const intent = resolveRovingIntent(descriptor);
    const next = resolveRovingIndex(index, intent, cols, total);
    if (next != null) index = next;
    return index;
  };
  // Horizontal is linear: Right crosses the row boundary (3 -> 4).
  step({ key: 'ArrowRight' }); // 0->1
  step({ key: 'ArrowRight' }); // 1->2
  step({ key: 'ArrowRight' }); // 2->3
  step({ key: 'ArrowRight' }); // 3->4 (wraps to next row's first cell)
  assert.equal(index, 4);
  // Right at the grid end stays put (no wrap past the last cell).
  step({ key: 'End', ctrlKey: true }); // -> 11
  assert.equal(index, 11);
  step({ key: 'ArrowRight' }); // 11 stays (grid edge)
  assert.equal(index, 11);
  // Vertical uses the column stride and respects row edges.
  step({ key: 'ArrowUp' }); // 11->7
  step({ key: 'ArrowUp' }); // 7->3
  assert.equal(index, 3);
  step({ key: 'ArrowUp' }); // top row -> stays
  assert.equal(index, 3);
  // Home to row start, then Ctrl+Home to grid start.
  step({ key: 'Home' }); // row-start of row 0 = 0
  assert.equal(index, 0);
});
