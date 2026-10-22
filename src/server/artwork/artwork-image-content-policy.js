/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';

export function assertArtworkRasterSignature(buffer) {
  const jpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp) throw createApiError(400, 'artwork_format_unsupported', 'Artwork must be a jpeg, png, or webp image');
  return jpeg ? 'image/jpeg' : png ? 'image/png' : 'image/webp';
}

export function artworkSharpInputOptions(maxDimensionPixels = 8192) {
  if (!Number.isSafeInteger(maxDimensionPixels) || maxDimensionPixels < 1 || maxDimensionPixels > 8192) {
    throw createApiError(400, 'artwork_dimensions_invalid', 'Artwork dimension policy is invalid');
  }
  return { failOn: 'warning', limitInputPixels: maxDimensionPixels ** 2 };
}
