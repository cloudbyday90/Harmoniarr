/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../api-error.js';

export const ARTWORK_WORKER_HEADER_LIMIT = 1024;
export const ARTWORK_WORKER_OUTPUT_LIMIT = 100 * 1024 * 1024;
const refusals = new Map([
  ['artwork_file_too_large', 'Artwork exceeds the input byte limit'],
  ['artwork_output_too_large', 'Rewritten artwork exceeds the output byte limit'],
  ['artwork_image_invalid', 'Artwork could not be processed within the image policy'],
  ['artwork_format_unsupported', 'Artwork must be a jpeg, png, or webp image'],
  ['artwork_dimensions_invalid', 'Artwork dimensions could not be determined'],
  ['artwork_dimensions_too_large', 'Artwork exceeds the dimension limit'],
  ['artwork_animation_unsupported', 'Animated artwork is unsupported'],
]);
const ownedErrors = new WeakSet();
export const isArtworkWorkerError = error => error instanceof Error && ownedErrors.has(error);
export function artworkWorkerError(reason = 'failed') {
  const error = createApiError(503, `artwork_worker_${reason}`, 'Artwork processing is temporarily unavailable');
  ownedErrors.add(error);
  return error;
}
export function artworkWorkerRefusal(code) {
  return refusals.has(code) ? createApiError(400, code, refusals.get(code)) : null;
}

export function createArtworkWorkerCollector(maxDimensionPixels) {
  let headerBytes = Buffer.alloc(0); let header; let size = 0; const chunks = [];
  return {
    push(chunk) {
      if (!header) {
        const end = chunk.indexOf(10);
        const prefix = end === -1 ? chunk : chunk.subarray(0, end);
        if (headerBytes.length + prefix.length > ARTWORK_WORKER_HEADER_LIMIT) throw artworkWorkerError();
        headerBytes = Buffer.concat([headerBytes, prefix]);
        if (end === -1) return;
        try { header = JSON.parse(headerBytes.toString('utf8')); } catch { throw artworkWorkerError(); }
        if (!header || typeof header !== 'object' || Array.isArray(header)) throw artworkWorkerError();
        if (header.error) {
          if (!artworkWorkerRefusal(header.error) || Object.keys(header).length !== 1) throw artworkWorkerError();
          header.size = 0;
        } else {
          if (!['jpeg', 'png', 'webp'].includes(header.format)
            || !Number.isSafeInteger(header.size) || header.size < 1 || header.size > ARTWORK_WORKER_OUTPUT_LIMIT
            || !['width', 'height'].every(key => Number.isInteger(header[key]) && header[key] > 0 && header[key] <= maxDimensionPixels)
            || (header.dominant !== null && (!header.dominant || !['r', 'g', 'b'].every(key =>
              Number.isInteger(header.dominant[key]) && header.dominant[key] >= 0 && header.dominant[key] <= 255)))) {
            throw artworkWorkerError();
          }
        }
        chunk = chunk.subarray(end + 1);
      }
      size += chunk.length;
      if (size > header.size) throw artworkWorkerError();
      if (chunk.length) chunks.push(chunk);
    },
    result(exitCode) {
      if (!header || size !== header.size) throw artworkWorkerError();
      if (header.error && exitCode === 1) throw artworkWorkerRefusal(header.error);
      if (exitCode !== 0 || header.error) throw artworkWorkerError();
      return { data: Buffer.concat(chunks, size), format: header.format, width: header.width, height: header.height,
        dominant: header.dominant === null ? null : { r: header.dominant.r, g: header.dominant.g, b: header.dominant.b } };
    },
  };
}
