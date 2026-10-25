/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const fixed = [
  { id: 'rgb8-jpeg-admitted-noise', format: 'jpeg', quality: 24, inputBytes: 14154530, fileName: 'jpeg-q24.jpg',
    expectedAdmission: 'admitted', maxAdmissionHeadroomBytes: 2 * 1024 ** 2,
    sha256: '3dedf187e23829c61b4447251deb729f57870b1ff089c13ed7e359d03389ddb7' },
  { id: 'rgb8-webp-canvas-refusal', format: 'webp', quality: 3, inputBytes: 14127228, fileName: 'webp-q3.webp',
    expectedAdmission: 'refused', sha256: 'a365d35a2c254a99f04fbd9226df65d9858dd6531b92325ed160ad4f9c1b529c' },
  { id: 'rgb8-webp-admitted-7120-noise', width: 7120, height: 7120, format: 'webp', quality: 3, inputBytes: 10675042,
    fileName: 'webp-7120-q3.webp', exifArtist: 'Harmoniarr synthetic admitted WebP', expectedAdmission: 'admitted',
    maxAdmissionHeadroomBytes: 4 * 1024 ** 2, sha256: '7ea1eb9d58f173027c2e3534dacac3c8c83596a438e7b062d0ce5c03122430ad' },
];
export const boundaryArtworkCases = Object.freeze(fixed.map(spec => Object.freeze({
  width: 8192, height: 8192, channels: 3, bits: 8, noise: true, prepared: true, boundedOutcome: true, ...spec,
})));
export function selectBoundaryArtworkCase(id) {
  // Keep the previous native command/selector usable without a second policy.
  const canonical = id === 'rgb8-webp-admitted-noise' ? 'rgb8-webp-canvas-refusal' : id;
  const spec = boundaryArtworkCases.find(row => row.id === canonical);
  if (!spec) throw new TypeError('Select a fixed boundary artwork case');
  return spec;
}
