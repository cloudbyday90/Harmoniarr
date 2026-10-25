/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { inspectOpaqueLosslessWebpContainer } from './artwork-webp-container.js';
export const ARTWORK_WEBP_SELECTION_DIMENSION_LIMIT = 1024;
export const ARTWORK_WEBP_SELECTION_INPUT_LIMIT = 1024 ** 2;
export const ARTWORK_WEBP_REWRITE_BUDGET_MS = 10_000;

/** Wire-safe geometry bound, shared by parent reservation and child admission. */
export function canReserveArtworkWebpSelection(metadata, inputBytes) {
  return metadata?.format === 'webp' && metadata.channels === 3 && metadata.depth === 'uchar'
    && Number.isSafeInteger(inputBytes) && inputBytes > 0 && inputBytes <= ARTWORK_WEBP_SELECTION_INPUT_LIMIT
    && ['width', 'height'].every(key => Number.isInteger(metadata[key]) && metadata[key] > 0 && metadata[key] <= ARTWORK_WEBP_SELECTION_DIMENSION_LIMIT);
}
/** Unsupported layouts keep the baseline rewrite; facts never bypass decoding. */
export function shouldSelectArtworkWebpOutput(buffer, metadata) {
  if (!Buffer.isBuffer(buffer) || !canReserveArtworkWebpSelection(metadata, buffer.length)
    || metadata.space !== 'srgb' || metadata.hasProfile !== false || metadata.hasAlpha !== false
    || (metadata.orientation !== undefined && metadata.orientation !== 1) || (metadata.pages !== undefined && metadata.pages !== 1)
    || (metadata.autoOrient && (metadata.autoOrient.width !== metadata.width || metadata.autoOrient.height !== metadata.height))) return false;
  try {
    const facts = inspectOpaqueLosslessWebpContainer(buffer);
    return facts.width === metadata.width && facts.height === metadata.height && facts.hasIcc === false;
  } catch (error) { if (!(error instanceof TypeError)) throw error; return false; }
}
