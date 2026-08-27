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
import { getModalFocusWrapIndex } from '../../src/client/lib/modal-focus-trap.js';

test('modal focus wrapping moves forward Tab from the last control to the first', () => {
  assert.equal(getModalFocusWrapIndex({ activeIndex: 1, focusableCount: 2 }), 0);
});

test('modal focus wrapping moves Shift+Tab from the first control to the last', () => {
  assert.equal(getModalFocusWrapIndex({ activeIndex: 0, focusableCount: 2, isShiftTab: true }), 1);
});

test('modal focus wrapping leaves ordinary in-dialog Tab movement to the browser', () => {
  assert.equal(getModalFocusWrapIndex({ activeIndex: 0, focusableCount: 2 }), null);
  assert.equal(getModalFocusWrapIndex({ activeIndex: 1, focusableCount: 2, isShiftTab: true }), null);
});

test('modal focus wrapping handles a modal with no focused control', () => {
  assert.equal(getModalFocusWrapIndex({ activeIndex: -1, focusableCount: 2 }), 0);
  assert.equal(getModalFocusWrapIndex({ activeIndex: -1, focusableCount: 2, isShiftTab: true }), 1);
  assert.equal(getModalFocusWrapIndex({ activeIndex: -1, focusableCount: 0 }), null);
});
