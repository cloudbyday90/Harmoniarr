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

import { createApiError } from '../auth.js';
import { getArtworkAssetById, patchArtworkDominantColor } from './artwork-repository.js';

/**
 * Validates that value is a finite number within [min, max].
 * Throws a 422 API error on failure.
 */
function assertRange(value, min, max, fieldName) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw createApiError(
      422,
      'dominant_color_invalid',
      `${fieldName} must be a number between ${min} and ${max}`,
    );
  }
}

/**
 * createArtworkDominantColorService — validates and persists client-extracted OKLCH
 * dominant color values for an artwork asset.
 *
 * The write path is one-way and non-overwriting: the underlying SQL uses
 * WHERE dominant_hue IS NULL, so server-computed values at ingest time are
 * never replaced by client-side extraction.
 *
 * @param {{ getArtworkAssetByIdFn?, patchArtworkDominantColorFn? }} deps
 */
export function createArtworkDominantColorService({
  getArtworkAssetByIdFn = getArtworkAssetById,
  patchArtworkDominantColorFn = patchArtworkDominantColor,
} = {}) {
  /**
   * Writes a dominant color result for an artwork asset.
   *
   * Validates ranges: hue 0–360, chroma 0–0.4, lightness 0–1.
   * Only writes if dominant_hue is currently NULL (server-computed values
   * take precedence and are never overwritten).
   *
   * @param {{ artworkAssetId: string, hue: number, chroma: number, lightness: number }}
   * @returns {Promise<{ ok: true, updated: boolean }>}
   */
  async function writeDominantColor({ artworkAssetId, hue, chroma, lightness }) {
    if (!artworkAssetId || typeof artworkAssetId !== 'string') {
      throw createApiError(422, 'dominant_color_invalid', 'artworkAssetId must be a non-empty string');
    }

    assertRange(hue, 0, 360, 'hue');
    assertRange(chroma, 0, 0.4, 'chroma');
    assertRange(lightness, 0, 1, 'lightness');

    const asset = await getArtworkAssetByIdFn(artworkAssetId);
    if (!asset) {
      throw createApiError(404, 'artwork_asset_not_found', 'Artwork asset not found');
    }

    const updated = await patchArtworkDominantColorFn(
      { assetId: artworkAssetId, hue, chroma, lightness },
    );

    return { ok: true, updated };
  }

  return { writeDominantColor };
}
