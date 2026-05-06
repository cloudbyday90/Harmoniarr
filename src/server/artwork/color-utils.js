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

/**
 * color-utils.js — Pure-JS OKLCH color conversion utilities.
 *
 * Implements the standard sRGB → OKLCH pipeline:
 *   sRGB (0–255) → linear sRGB → LMS (via Oklab M1) → Oklab → OKLCH
 *
 * Reference: Björn Ottosson's Oklab specification
 *   https://bottosson.github.io/posts/oklab/
 *
 * VIBRANCY_THRESHOLD is the minimum chroma value for a color to be considered
 * a useful card accent. Near-achromatic colors (grey/black/white album art)
 * have chroma well below this and are suppressed at ingest time.
 */

export const VIBRANCY_THRESHOLD = 0.05;

/**
 * Convert sRGB channel values (integers 0–255) to OKLCH.
 *
 * Returns { l, c, h } where:
 *   l — perceived lightness, 0.0–1.0
 *   c — chroma (colorfulness), approximately 0.0–0.4 for in-gamut colors
 *   h — hue angle in degrees, 0–360
 *
 * @param {number} r — red channel, 0–255
 * @param {number} g — green channel, 0–255
 * @param {number} b — blue channel, 0–255
 * @returns {{ l: number, c: number, h: number }}
 */
export function rgbToOklch(r, g, b) {
  // Step 1: sRGB → linear sRGB (IEC 61966-2-1 inverse transfer function)
  const lr = linearize(r / 255);
  const lg = linearize(g / 255);
  const lb = linearize(b / 255);

  // Step 2: linear sRGB → LMS cone responses (Oklab M1 matrix), then cube-root
  const lp = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const mp = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const sp = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  // Step 3: LMS cube-roots → Oklab (Ottosson M2 matrix)
  const okl = 0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp;
  const oka = 1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp;
  const okb = 0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp;

  // Step 4: Oklab (L, a, b) → OKLCH (L, C, H)
  const c = Math.sqrt(oka * oka + okb * okb);
  const h = ((Math.atan2(okb, oka) * 180) / Math.PI + 360) % 360;

  return { l: okl, c, h };
}

/**
 * Returns true if the color meets the vibrancy threshold (C >= VIBRANCY_THRESHOLD).
 * Near-grey colors with low chroma are not useful as card border accents.
 *
 * @param {{ c: number }} oklch
 * @returns {boolean}
 */
export function isVibrant({ c }) {
  return c >= VIBRANCY_THRESHOLD;
}

// --- Internal helpers ---

/**
 * sRGB gamma expansion: convert a single normalized channel (0.0–1.0)
 * from gamma-compressed sRGB to linear light.
 *
 * @param {number} c — normalized channel value, 0.0–1.0
 * @returns {number}
 */
function linearize(c) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
