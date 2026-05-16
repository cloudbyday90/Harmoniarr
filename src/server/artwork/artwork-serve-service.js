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
