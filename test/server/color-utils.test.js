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
import { VIBRANCY_THRESHOLD, isVibrant, rgbToOklch } from '../../src/server/artwork/color-utils.js';

test('rgbToOklch returns a result object with l, c, h fields', () => {
  const result = rgbToOklch(128, 128, 128);
  assert.ok('l' in result);
  assert.ok('c' in result);
  assert.ok('h' in result);
});

test('rgbToOklch pure red has high chroma well above VIBRANCY_THRESHOLD', () => {
  const { c } = rgbToOklch(255, 0, 0);
  assert.ok(c > VIBRANCY_THRESHOLD, `Expected red chroma ${c} > ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch pure green has high chroma well above VIBRANCY_THRESHOLD', () => {
  const { c } = rgbToOklch(0, 255, 0);
  assert.ok(c > VIBRANCY_THRESHOLD, `Expected green chroma ${c} > ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch pure blue has high chroma well above VIBRANCY_THRESHOLD', () => {
  const { c } = rgbToOklch(0, 0, 255);
  assert.ok(c > VIBRANCY_THRESHOLD, `Expected blue chroma ${c} > ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch white is approximately achromatic (c near 0)', () => {
  const { c } = rgbToOklch(255, 255, 255);
  assert.ok(c < VIBRANCY_THRESHOLD, `Expected white chroma ${c} < ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch black is approximately achromatic (c near 0)', () => {
  const { c } = rgbToOklch(0, 0, 0);
  assert.ok(c < VIBRANCY_THRESHOLD, `Expected black chroma ${c} < ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch mid-grey is approximately achromatic (c near 0)', () => {
  const { c } = rgbToOklch(128, 128, 128);
  assert.ok(c < VIBRANCY_THRESHOLD, `Expected grey chroma ${c} < ${VIBRANCY_THRESHOLD}`);
});

test('rgbToOklch hue is always in range 0–360', () => {
  const colors = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
    [128, 64, 200],
    [1, 1, 1],
  ];

  for (const [r, g, b] of colors) {
    const { h } = rgbToOklch(r, g, b);
    assert.ok(h >= 0 && h <= 360, `Expected hue in [0, 360] for rgb(${r},${g},${b}), got ${h}`);
  }
});

test('rgbToOklch lightness is in range 0–1', () => {
  const colors = [
    [0, 0, 0],
    [255, 255, 255],
    [128, 0, 128],
  ];

  for (const [r, g, b] of colors) {
    const { l } = rgbToOklch(r, g, b);
    assert.ok(l >= 0 && l <= 1, `Expected lightness in [0, 1] for rgb(${r},${g},${b}), got ${l}`);
  }
});

test('rgbToOklch white has higher lightness than black', () => {
  const white = rgbToOklch(255, 255, 255);
  const black = rgbToOklch(0, 0, 0);
  assert.ok(white.l > black.l);
});

test('isVibrant returns true for saturated colors', () => {
  const { c } = rgbToOklch(255, 0, 0);
  assert.equal(isVibrant({ c }), true);
});

test('isVibrant returns false for grey colors', () => {
  const { c } = rgbToOklch(128, 128, 128);
  assert.equal(isVibrant({ c }), false);
});

test('isVibrant threshold boundary: exactly at threshold is vibrant', () => {
  assert.equal(isVibrant({ c: VIBRANCY_THRESHOLD }), true);
});

test('isVibrant threshold boundary: just below threshold is not vibrant', () => {
  assert.equal(isVibrant({ c: VIBRANCY_THRESHOLD - 0.0001 }), false);
});
