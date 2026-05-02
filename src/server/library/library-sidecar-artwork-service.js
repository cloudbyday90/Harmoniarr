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

const supportedImageExtensions = new Set(['.jpeg', '.jpg', '.png', '.webp']);
const preferredBasenameOrder = ['front', 'cover', 'folder', 'artwork'];

function scoreSidecarFile(file) {
  const normalizedFilename = String(file.filename ?? '').trim().toLowerCase();
  const normalizedExtension = String(file.extension ?? '').trim().toLowerCase();
  if (!supportedImageExtensions.has(normalizedExtension)) {
    return null;
  }

  const basename = normalizedFilename.slice(0, normalizedFilename.length - normalizedExtension.length);
  const nameIndex = preferredBasenameOrder.indexOf(basename);
  if (nameIndex === -1) {
    return null;
  }

  return {
    file,
    sortKey: `${String(nameIndex).padStart(2, '0')}:${normalizedFilename}`,
  };
}

function groupFilesByDirectory(files) {
  const grouped = new Map();

  for (const file of files) {
    const directoryKey = path.posix.dirname(file.relativePath ?? '') || '.';
    if (!grouped.has(directoryKey)) {
      grouped.set(directoryKey, []);
    }
    grouped.get(directoryKey).push(file);
  }

  return grouped;
}

export function createLibrarySidecarArtworkService({
  artworkAssignmentService = null,
  artworkIngestionService = null,
} = {}) {
  async function captureSidecarArtwork({ files }) {
    if (!artworkAssignmentService || !artworkIngestionService || !Array.isArray(files) || files.length === 0) {
      return { assignedCount: 0, candidateCount: 0 };
    }

    let assignedCount = 0;
    let candidateCount = 0;
    const filesByDirectory = groupFilesByDirectory(files);

    for (const directoryFiles of filesByDirectory.values()) {
      const candidate = directoryFiles
        .map(scoreSidecarFile)
        .filter(Boolean)
        .sort((left, right) => left.sortKey.localeCompare(right.sortKey))[0]?.file;

      if (!candidate) {
        for (const observedFile of directoryFiles.filter((file) => file.fileState === 'observed')) {
          if (typeof artworkAssignmentService.clearArtworkSource === 'function') {
            await artworkAssignmentService.clearArtworkSource({
              artworkRole: 'front_cover',
              ownerId: observedFile.id,
              ownerType: 'library_file',
              sourceProvider: 'sidecar',
            });
          }
        }

        continue;
      }

      candidateCount += 1;
      const observedFiles = directoryFiles.filter((file) => file.fileState === 'observed');
      if (observedFiles.length === 0) {
        continue;
      }

      const ingestion = await artworkIngestionService.ingestArtworkFile({
        filePath: candidate.canonicalPath,
        sourceProvider: 'sidecar',
        storageClass: 'provider_original',
      });

      for (const observedFile of observedFiles) {
        const result = typeof artworkAssignmentService.reconcilePreferredArtwork === 'function'
          ? await artworkAssignmentService.reconcilePreferredArtwork({
            artworkAssetId: ingestion.asset.id,
            artworkRole: 'front_cover',
            ownerId: observedFile.id,
            ownerType: 'library_file',
            priority: 10,
            sourceProvider: 'sidecar',
            sourceReference: candidate.filename,
          })
          : {
            promotedToPreferred: true,
            assignment: await artworkAssignmentService.assignPreferredArtwork({
              artworkAssetId: ingestion.asset.id,
              artworkRole: 'front_cover',
              ownerId: observedFile.id,
              ownerType: 'library_file',
              priority: 10,
              sourceProvider: 'sidecar',
              sourceReference: candidate.filename,
            }),
          };

        if (result.promotedToPreferred) {
          assignedCount += 1;
        }
      }
    }

    return {
      assignedCount,
      candidateCount,
    };
  }

  return {
    captureSidecarArtwork,
  };
}