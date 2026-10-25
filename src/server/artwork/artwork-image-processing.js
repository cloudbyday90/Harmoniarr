/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import sharp from 'sharp';
import { createApiError } from '../api-error.js';
import { assertArtworkBuffer, assertArtworkRasterSignature, artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { artworkWorkerError } from './artwork-worker-protocol.js';
import { ARTWORK_WEBP_EFFORT, ARTWORK_WEBP_QUALITY } from './artwork-webp-policy.js';

const encoders = {
  jpeg: image => image.jpeg({ chromaSubsampling: '4:4:4', quality: 90 }),
  png: image => image.png({ compressionLevel: 9 }),
  webp: image => image.webp({ effort: ARTWORK_WEBP_EFFORT, quality: ARTWORK_WEBP_QUALITY }),
};

export async function inspectArtworkBuffer(buffer, { maxDimensionPixels } = {}) {
  assertArtworkBuffer(buffer); assertArtworkRasterSignature(buffer);
  const options = artworkSharpInputOptions(maxDimensionPixels);
  try { return await sharp(buffer, options).metadata(); }
  catch { throw createApiError(400, 'artwork_image_invalid', 'Artwork could not be inspected within the image policy'); }
}

export async function sanitizeArtworkBuffer({ buffer, format, maxDimensionPixels }) {
  const encoder = encoders[format];
  if (!Object.hasOwn(encoders, format)) throw createApiError(400, 'artwork_format_unsupported', 'Artwork format is unsupported');
  // Maximum-size images share CPU with media commands. Leave room for metadata
  // and best-effort stats inside the worker's unchanged 15-second outer deadline.
  const pipeline = encoder(sharp(buffer, artworkSharpInputOptions(maxDimensionPixels)).rotate()).timeout({ seconds: 10 });
  try { return await pipeline.toBuffer({ resolveWithObject: true }); }
  // Native rewrite errors have no stable structured distinction between corrupt
  // data, allocation failure and timeout. Do not turn capacity loss into absence.
  catch { throw artworkWorkerError(); }
}

export async function getArtworkBufferStats(buffer, { maxDimensionPixels } = {}) {
  return sharp(buffer, artworkSharpInputOptions(maxDimensionPixels)).timeout({ seconds: 3 }).stats();
}
