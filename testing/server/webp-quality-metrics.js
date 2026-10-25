/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** RGB8 decoded-input error, not original-source fidelity or perceptual quality. */
export function measureRgb8Error(reference, candidate) {
  if (!Buffer.isBuffer(reference) || !Buffer.isBuffer(candidate) || !reference.length
    || reference.length !== candidate.length || reference.length % 3 !== 0
    || !Number.isSafeInteger(reference.length * 255 ** 2)) throw new TypeError('Require equal nonempty bounded RGB8 buffers');
  let sumSquaredError = 0; let maxAbsoluteError = 0;
  for (let index = 0; index < reference.length; index++) {
    const difference = Math.abs(reference[index] - candidate[index]);
    sumSquaredError += difference * difference;
    if (difference > maxAbsoluteError) maxAbsoluteError = difference;
  }
  const mseRgb = sumSquaredError / reference.length;
  return { samples: reference.length, pixels: reference.length / 3, sumSquaredError, mseRgb, maxAbsoluteError,
    identical: sumSquaredError === 0, psnrRgbDb: sumSquaredError === 0 ? null : 10 * Math.log10(255 ** 2 / mseRgb) };
}
