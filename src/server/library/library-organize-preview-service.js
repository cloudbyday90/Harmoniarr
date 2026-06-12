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

import { isAbsolute, join, relative, resolve, posix as posixPath } from 'node:path';
import { isAudioFileExtension } from './library-file-type-policy.js';
import { createLibraryNamingService } from './library-naming-service.js';
import { createLibraryOrganizePreviewStore } from './library-organize-preview-store.js';

function buildStatus(code, message) {
  return { code, message };
}

function normalizeRelativePath(value) {
  return typeof value === 'string'
    ? value.split('\\').join('/').replace(/^\/+|\/+$/g, '')
    : '';
}

function buildComparisonKey(value) {
  const normalized = String(value ?? '').replaceAll('\\', '/');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function isPathInsideRoot(rootPath, targetPath) {
  const resolvedRoot = resolve(rootPath);
  const resolvedTarget = resolve(targetPath);
  const pathDelta = relative(resolvedRoot, resolvedTarget);

  return pathDelta === '' || (!pathDelta.startsWith('..') && !isAbsolute(pathDelta));
}

function buildSummary(counts) {
  if (counts.totalFiles === 0) {
    return {
      message: 'No observed library files are available for organize preview yet.',
      status: 'empty',
    };
  }

  if (counts.renameRequiredCount > 0 && counts.blockedCount > 0) {
    return {
      message: `${counts.renameRequiredCount} library file${counts.renameRequiredCount === 1 ? ' can' : 's can'} be reorganized now, but ${counts.blockedCount} still need match or collision review first.`,
      status: 'attention',
    };
  }

  if (counts.blockedCount > 0) {
    return {
      message: `${counts.blockedCount} library file${counts.blockedCount === 1 ? ' still needs' : 's still need'} review before a rename or organize apply path can be prepared.`,
      status: 'attention',
    };
  }

  if (counts.renameRequiredCount > 0) {
    return {
      message: `${counts.renameRequiredCount} library file${counts.renameRequiredCount === 1 ? ' can' : 's can'} be renamed or moved to match the canonical library layout.`,
      status: 'ready',
    };
  }

  return {
    message: 'Observed matched library files already follow the canonical naming layout.',
    status: 'clean',
  };
}

async function buildProposedNaming(row, libraryNamingService) {
  if (!isAudioFileExtension(row.extension)) {
    return {
      status: buildStatus(
        'blocked_unsupported_extension',
        'Only observed audio files participate in the canonical organize preview.',
      ),
    };
  }

  if (row.matchStatus !== 'matched') {
    return {
      status: buildStatus(
        row.matchStatus === 'ambiguous' ? 'blocked_ambiguous' : 'blocked_unmatched',
        row.matchStatus === 'ambiguous'
          ? 'This file has multiple canonical metadata candidates and needs reconciliation before it can be renamed.'
          : 'This file does not have a canonical metadata match yet, so organize preview cannot compute a trusted destination.',
      ),
    };
  }

  const albumTitle = row.releaseGroupTitle ?? row.releaseTitle ?? null;
  if (!row.artistName || !albumTitle || !row.trackTitle || row.trackPosition <= 0) {
    return {
      status: buildStatus(
        'blocked_missing_metadata',
        'The canonical metadata needed to build artist, album, or track naming is incomplete for this file.',
      ),
    };
  }

  const artistFolderName = await libraryNamingService.buildArtistFolderName({ artistName: row.artistName });
  const albumFolderName = await libraryNamingService.buildAlbumFolderName({
    albumTitle,
    releaseDate: row.releaseDate,
  });
  const relativeFolderPath = posixPath.join(
    artistFolderName,
    albumFolderName,
  );
  const filename = await libraryNamingService.buildTrackFilename({
    discNumber: row.mediumPosition,
    extension: row.extension,
    isMultiDisc: row.mediumCount > 1,
    trackNumber: row.trackPosition,
    trackTitle: row.trackTitle,
  });
  const relativePath = posixPath.join(relativeFolderPath, filename);
  const absolutePath = join(row.libraryRootPath, ...relativePath.split('/'));

  if (!isPathInsideRoot(row.libraryRootPath, absolutePath)) {
    return {
      proposedPath: absolutePath,
      proposedRelativePath: relativePath,
      status: buildStatus(
        'blocked_outside_root',
        'The computed canonical destination escapes the scanned library root and cannot be used.',
      ),
    };
  }

  return {
    proposedFilename: filename,
    proposedPath: absolutePath,
    proposedRelativePath: relativePath,
    status: null,
  };
}

function finalizeStatus(preview) {
  if (preview.status) {
    return preview;
  }

  const currentPathKey = buildComparisonKey(preview.currentPath);
  const proposedPathKey = buildComparisonKey(preview.proposedPath);
  const isRenameRequired = currentPathKey !== proposedPathKey;

  return {
    ...preview,
    status: buildStatus(
      isRenameRequired ? 'rename_required' : 'already_canonical',
      isRenameRequired
        ? 'This file can be renamed or moved into the canonical artist, album, and track layout.'
        : 'This file already matches the canonical naming layout.',
    ),
  };
}

function applyDuplicateTargetBlocking(files) {
  const filesByTargetPath = new Map();

  for (const file of files) {
    if (!file.proposedPath || file.status.code.startsWith('blocked_')) {
      continue;
    }

    const targetKey = buildComparisonKey(file.proposedPath);
    const bucket = filesByTargetPath.get(targetKey) ?? [];
    bucket.push(file.fileId);
    filesByTargetPath.set(targetKey, bucket);
  }

  return files.map((file) => {
    if (!file.proposedPath || file.status.code.startsWith('blocked_')) {
      return file;
    }

    const targetKey = buildComparisonKey(file.proposedPath);
    if ((filesByTargetPath.get(targetKey) ?? []).length <= 1) {
      return file;
    }

    return {
      ...file,
      status: buildStatus(
        'blocked_duplicate_target',
        'Another observed library file resolves to the same canonical destination, so this rename plan needs collision review first.',
      ),
    };
  });
}

function buildCounts(files) {
  return files.reduce((counts, file) => {
    counts.totalFiles += 1;
    if (file.match.status === 'matched') {
      counts.matchedFiles += 1;
    }

    switch (file.status.code) {
      case 'rename_required':
        counts.renameRequiredCount += 1;
        break;
      case 'already_canonical':
        counts.alreadyCanonicalCount += 1;
        break;
      case 'blocked_ambiguous':
        counts.blockedAmbiguousCount += 1;
        counts.blockedCount += 1;
        break;
      case 'blocked_duplicate_target':
        counts.blockedDuplicateTargetCount += 1;
        counts.blockedCount += 1;
        break;
      case 'blocked_missing_metadata':
        counts.blockedMissingMetadataCount += 1;
        counts.blockedCount += 1;
        break;
      case 'blocked_outside_root':
        counts.blockedOutsideRootCount += 1;
        counts.blockedCount += 1;
        break;
      case 'blocked_unsupported_extension':
        counts.blockedUnsupportedExtensionCount += 1;
        counts.blockedCount += 1;
        break;
      default:
        counts.blockedUnmatchedCount += 1;
        counts.blockedCount += 1;
        break;
    }

    return counts;
  }, {
    alreadyCanonicalCount: 0,
    blockedAmbiguousCount: 0,
    blockedCount: 0,
    blockedDuplicateTargetCount: 0,
    blockedMissingMetadataCount: 0,
    blockedOutsideRootCount: 0,
    blockedUnmatchedCount: 0,
    blockedUnsupportedExtensionCount: 0,
    matchedFiles: 0,
    renameRequiredCount: 0,
    totalFiles: 0,
  });
}

export function createLibraryOrganizePreviewService({
  libraryNamingService = createLibraryNamingService(),
  libraryOrganizePreviewStore = createLibraryOrganizePreviewStore(),
} = {}) {
  async function buildLibraryOrganizePreview() {
    const rows = await libraryOrganizePreviewStore.listLibraryFilesForOrganizePreview();
    const initialFiles = await Promise.all(rows.map(async (row) => {
      const previewPlan = await buildProposedNaming(row, libraryNamingService);
      const proposedRelativePath = normalizeRelativePath(previewPlan.proposedRelativePath ?? '');

      return finalizeStatus({
        currentFilename: row.filename,
        currentPath: row.canonicalPath,
        currentRelativePath: normalizeRelativePath(row.relativePath),
        fileId: row.id,
        libraryRootPath: row.libraryRootPath,
        match: {
          artistName: row.artistName,
          matchedBy: row.matchedBy,
          metadataReleaseId: row.metadataReleaseId,
          metadataTrackId: row.metadataTrackId,
          releaseTitle: row.releaseTitle ?? row.releaseGroupTitle ?? null,
          status: row.matchStatus ?? 'unmatched',
          trackTitle: row.trackTitle,
        },
        naming: {
          strategy: 'canonical_release_default_template',
        },
        proposedFilename: previewPlan.proposedFilename ?? null,
        proposedPath: previewPlan.proposedPath ?? null,
        proposedRelativePath: proposedRelativePath || null,
        status: previewPlan.status,
      });
    }));
    const files = applyDuplicateTargetBlocking(initialFiles);
    const counts = buildCounts(files);

    return {
      checkedAt: new Date().toISOString(),
      counts,
      files,
      summary: buildSummary(counts),
    };
  }

  return {
    buildLibraryOrganizePreview,
  };
}
