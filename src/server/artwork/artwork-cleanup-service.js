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

import { rm } from 'node:fs/promises';
import path from 'node:path';
import { createArtworkPolicyService } from './artwork-policy-service.js';
import { throwIfOperationRunCancellationRequested } from '../operation-run-cancellation.js';
import {
  deleteArtworkAssetById,
  listArtworkCleanupCandidates,
} from './artwork-repository.js';

function resolveAbsoluteArtworkPath(rootPath, relativePath) {
  const absoluteRoot = path.resolve(rootPath);
  const absolutePath = path.resolve(rootPath, relativePath);

  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${path.sep}`)) {
    throw new Error('Resolved artwork cleanup path escapes the configured storage root');
  }

  return absolutePath;
}

export function calculateArtworkCleanupCutoff({ now = new Date(), retentionDays }) {
  const cutoffDate = new Date(now);
  cutoffDate.setUTCDate(cutoffDate.getUTCDate() - retentionDays);
  return cutoffDate.toISOString();
}

export function createArtworkCleanupService({
  artworkPolicyService = createArtworkPolicyService(),
  deleteArtworkAssetByIdFn = deleteArtworkAssetById,
  listArtworkCleanupCandidatesFn = listArtworkCleanupCandidates,
  nowFn = () => new Date(),
  removeFileFn = rm,
} = {}) {
  async function cleanupUnassignedArtwork({ isCancellationRequested = null, limit = 100, runId = null } = {}) {
    const policy = await artworkPolicyService.getArtworkRuntimePolicy();
    const retentionDays = policy.cleanup?.unassignedRetentionDays ?? 90;
    const unassignedBefore = calculateArtworkCleanupCutoff({
      now: nowFn(),
      retentionDays,
    });
    const cleanupCandidates = await listArtworkCleanupCandidatesFn({
      limit,
      unassignedBefore,
    });

    const summary = {
      deletedAssetCount: 0,
      deletedFileCount: 0,
      failedAssetCount: 0,
      failures: [],
      missingFileCount: 0,
      retentionCutoff: unassignedBefore,
      scannedAssetCount: cleanupCandidates.length,
    };

    for (const asset of cleanupCandidates) {
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      const absolutePath = resolveAbsoluteArtworkPath(policy.storage.root, asset.relativePath);

      try {
        await removeFileFn(absolutePath, { force: false });
        summary.deletedFileCount += 1;
      } catch (error) {
        if (error?.code === 'ENOENT') {
          summary.missingFileCount += 1;
        } else {
          summary.failedAssetCount += 1;
          summary.failures.push({
            artworkAssetId: asset.id,
            code: error?.code ?? 'artwork_cleanup_failed',
            message: error?.message ?? 'Artwork cleanup failed while removing the file',
            relativePath: asset.relativePath,
          });
          continue;
        }
      }

      await deleteArtworkAssetByIdFn(asset.id);
      summary.deletedAssetCount += 1;
    }

    return summary;
  }

  return {
    cleanupUnassignedArtwork,
  };
}