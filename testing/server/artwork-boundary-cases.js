/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const fixed = [
  ['jpeg', 24, 14154530, '3dedf187e23829c61b4447251deb729f57870b1ff089c13ed7e359d03389ddb7'],
  ['webp', 3, 14127228, 'a365d35a2c254a99f04fbd9226df65d9858dd6531b92325ed160ad4f9c1b529c'],
];
export const boundaryArtworkCases = Object.freeze(fixed.map(([format, quality, inputBytes, sha256]) => Object.freeze({
  id: `rgb8-${format}-admitted-noise`, width: 8192, height: 8192, channels: 3, bits: 8, format, quality, inputBytes, sha256,
  fileName: `${format}-q${quality}.${format === 'jpeg' ? 'jpg' : 'webp'}`, noise: true, prepared: true, boundedOutcome: true,
})));
export function selectBoundaryArtworkCase(id) {
  const spec = boundaryArtworkCases.find(row => row.id === id);
  if (!spec) throw new TypeError('Select a fixed admitted artwork case');
  return spec;
}
