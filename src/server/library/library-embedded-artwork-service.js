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

import { selectCover } from 'music-metadata';
import { createApiError } from '../auth.js';

function normalizeSourceReference(picture) {
  if (typeof picture?.type === 'string' && picture.type.trim()) {
    return picture.type.trim();
  }

  if (typeof picture?.description === 'string' && picture.description.trim()) {
    return picture.description.trim();
  }

  return null;
}

export function createLibraryEmbeddedArtworkService({
  artworkAssignmentService = null,
  artworkIngestionService = null,
  selectEmbeddedCover = selectCover,
} = {}) {
  async function captureEmbeddedArtwork({ libraryFileId, metadata }) {
    if (!artworkAssignmentService || !artworkIngestionService) {
      return null;
    }

    if (typeof libraryFileId !== 'string' || libraryFileId.trim().length === 0) {
      throw createApiError(400, 'validation_error', 'libraryFileId must be a non-empty string');
    }

    const pictures = Array.isArray(metadata?.common?.picture) ? metadata.common.picture : [];
    if (pictures.length === 0) {
      if (typeof artworkAssignmentService.clearArtworkSource === 'function') {
        await artworkAssignmentService.clearArtworkSource({
          artworkRole: 'front_cover',
          ownerId: libraryFileId.trim(),
          ownerType: 'library_file',
          sourceProvider: 'embedded',
        });
      }

      return null;
    }

    const picture = selectEmbeddedCover(pictures);
    if (!picture?.data || !picture?.format) {
      return null;
    }

    const ingestion = await artworkIngestionService.ingestArtworkBuffer({
      buffer: picture.data,
      sourceProvider: 'embedded',
      storageClass: 'extracted_embedded',
    });
    const result = typeof artworkAssignmentService.reconcilePreferredArtwork === 'function'
      ? await artworkAssignmentService.reconcilePreferredArtwork({
        artworkAssetId: ingestion.asset.id,
        artworkRole: 'front_cover',
        ownerId: libraryFileId.trim(),
        ownerType: 'library_file',
        priority: 0,
        sourceProvider: 'embedded',
        sourceReference: normalizeSourceReference(picture),
      })
      : {
        assignment: await artworkAssignmentService.assignPreferredArtwork({
          artworkAssetId: ingestion.asset.id,
          artworkRole: 'front_cover',
          ownerId: libraryFileId.trim(),
          ownerType: 'library_file',
          priority: 0,
          sourceProvider: 'embedded',
          sourceReference: normalizeSourceReference(picture),
        }),
      };

    return {
      ...ingestion,
      assignment: result.assignment,
    };
  }

  return {
    captureEmbeddedArtwork,
  };
}