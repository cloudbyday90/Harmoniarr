/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../api-error.js';
import { assertArtworkBuffer, artworkInputByteLimit, artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { inspectArtworkBuffer, sanitizeArtworkBuffer, getArtworkBufferStats } from './artwork-image-processing.js';
import { ARTWORK_WORKER_OUTPUT_LIMIT } from './artwork-worker-protocol.js';

/** Native implementation: production calls this only in the disposable child. */
export async function transformArtworkBuffer({ buffer, maxBytes, maxDimensionPixels }, {
  inspectArtworkBufferFn = inspectArtworkBuffer,
  sanitizeArtworkBufferFn = sanitizeArtworkBuffer,
  sharpStatsFn = getArtworkBufferStats,
} = {}) {
  assertArtworkBuffer(buffer);
  maxBytes = artworkInputByteLimit({ maxOriginalFileSizeBytes: maxBytes });
  maxDimensionPixels ??= 8192;
  artworkSharpInputOptions(maxDimensionPixels);
  if (buffer.length > maxBytes) throw createApiError(400, 'artwork_file_too_large', 'Artwork exceeds the input byte limit');
  const metadata = await inspectArtworkBufferFn(buffer, { maxDimensionPixels });
  const width = metadata.autoOrient?.width ?? metadata.width;
  const height = metadata.autoOrient?.height ?? metadata.height;
  if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw createApiError(400, 'artwork_format_unsupported', 'Artwork must be a jpeg, png, or webp image');
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw createApiError(400, 'artwork_dimensions_invalid', 'Artwork dimensions could not be determined');
  }
  if (metadata.pages > 1) throw createApiError(400, 'artwork_animation_unsupported', 'Animated artwork is unsupported');
  if (width > maxDimensionPixels || height > maxDimensionPixels) {
    throw createApiError(400, 'artwork_dimensions_too_large', 'Artwork exceeds the dimension limit');
  }
  const { data, info } = await sanitizeArtworkBufferFn({ buffer, format: metadata.format, maxDimensionPixels });
  if (data.length > ARTWORK_WORKER_OUTPUT_LIMIT) {
    throw createApiError(400, 'artwork_output_too_large', 'Rewritten artwork exceeds the output byte limit');
  }
  let dominant = null;
  try {
    const stats = await sharpStatsFn(data, { maxDimensionPixels });
    dominant = stats.dominant;
  } catch {
    // Color statistics remain best effort, within the parent's whole-job deadline.
  }
  return { data, format: metadata.format, width: info.width, height: info.height, dominant };
}
