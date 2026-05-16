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

import path from 'node:path';
import { stat } from 'node:fs/promises';
import { createApiError } from '../auth.js';
import { getArtworkAssetById } from './artwork-repository.js';
import { createArtworkPolicyService } from './artwork-policy-service.js';

function resolveAbsoluteArtworkPath(rootPath, relativePath) {
  const absoluteRoot = path.resolve(rootPath);
  const absolutePath = path.resolve(rootPath, relativePath);

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw createApiError(404, 'artwork_asset_not_found', 'Artwork asset not found');
  }

  return absolutePath;
}

export function createArtworkServeService({
  artworkPolicyService = createArtworkPolicyService(),
  getArtworkAssetByIdFn = getArtworkAssetById,
  statFn = stat,
} = {}) {
  async function serveArtworkFile({ assetId }) {
    if (typeof assetId !== 'string' || assetId.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'assetId must be a non-empty string');
    }

    const asset = await getArtworkAssetByIdFn(assetId);
    if (!asset) {
      throw createApiError(404, 'artwork_asset_not_found', 'Artwork asset not found');
    }

    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    const absolutePath = resolveAbsoluteArtworkPath(policy.storage.root, asset.relativePath);

    let fileStats;
    try {
      fileStats = await statFn(absolutePath);
    } catch {
      throw createApiError(404, 'artwork_asset_not_found', 'Artwork file not found on disk');
    }

    return {
      absolutePath,
      fileStats,
      mimeType: asset.mimeType,
      fileSize: fileStats.size,
    };
  }

  return { serveArtworkFile };
}
