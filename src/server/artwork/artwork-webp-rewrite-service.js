/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import sharp from 'sharp';
import { artworkSharpInputOptions } from './artwork-image-content-policy.js';
import { ARTWORK_WEBP_QUALITY, ARTWORK_WEBP_EFFORT } from './artwork-webp-policy.js';
import { ARTWORK_WEBP_REWRITE_BUDGET_MS, ARTWORK_WEBP_SELECTION_INPUT_LIMIT, ARTWORK_WEBP_SELECTION_DIMENSION_LIMIT } from './artwork-webp-selection-policy.js';
import { ARTWORK_WORKER_OUTPUT_LIMIT, artworkWorkerError } from './artwork-worker-protocol.js';

const encode = ({ buffer, maxDimensionPixels, lossless, seconds }) => sharp(buffer, artworkSharpInputOptions(maxDimensionPixels)).rotate()
  .webp({ quality: ARTWORK_WEBP_QUALITY, effort: ARTWORK_WEBP_EFFORT, ...(lossless ? { lossless: true } : {}) })
  .timeout({ seconds }).toBuffer({ resolveWithObject: true });

export function createArtworkWebpRewriteService({ encodeFn = encode, now = () => performance.now() } = {}) {
  if (typeof encodeFn !== 'function' || typeof now !== 'function') throw new TypeError('Invalid WebP rewrite dependencies');
  return { async rewrite({ buffer, maxDimensionPixels }) {
    try {
      if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > ARTWORK_WEBP_SELECTION_INPUT_LIMIT) throw artworkWorkerError();
      const started = now(); if (!Number.isFinite(started)) throw artworkWorkerError();
      const deadline = started + ARTWORK_WEBP_REWRITE_BUDGET_MS;
      const run = async lossless => {
        const current = now(); const seconds = Math.floor((deadline - current) / 1000);
        if (!Number.isFinite(current) || current < started || seconds < 1) throw artworkWorkerError();
        const result = await encodeFn({ buffer, maxDimensionPixels, lossless, seconds });
        const completed = now();
        if (!Number.isFinite(completed) || completed < current || completed >= deadline || !Buffer.isBuffer(result?.data) || !result.data.length || result.data.length > ARTWORK_WORKER_OUTPUT_LIMIT
          || result.info?.format !== 'webp' || result.info.channels !== 3
          || !['width', 'height'].every(key => Number.isInteger(result.info[key]) && result.info[key] > 0 && result.info[key] <= ARTWORK_WEBP_SELECTION_DIMENSION_LIMIT)) throw artworkWorkerError();
        return result;
      };
      // Keep the first buffer owned while the second native pipeline runs.
      const baseline = await run(false); const candidate = await run(true);
      if (baseline.info.width !== candidate.info.width || baseline.info.height !== candidate.info.height) throw artworkWorkerError();
      return candidate.data.length <= baseline.data.length ? candidate : baseline;
    } catch { throw artworkWorkerError(); }
  } };
}
export const rewriteArtworkWebpSelection = options => createArtworkWebpRewriteService().rewrite(options);
