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

import { posix as path } from 'node:path';
import { createApiError } from '../auth.js';
import { resolveDownloadCandidateFolder } from '../paths/download-path-mapping-service.js';
import { loadSettings } from '../settings.js';

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
}

function sanitizeFilename(value, fallback) {
  const normalized = normalizePathInput(value);
  const basename = normalized.split('/').filter(Boolean).at(-1) ?? fallback;
  return basename.replace(/[\\/]/g, '_').trim() || fallback;
}

function buildPathWarning(code, message) {
  return { code, message };
}

function buildPathBlocker(code, message) {
  return { code, message };
}

function resolveCandidateFolderPath(candidate) {
  const candidateFolderPath = normalizePathInput(candidate.folderPath);
  if (candidateFolderPath) {
    return candidateFolderPath;
  }

  return normalizePathInput(candidate.files?.find((file) => normalizePathInput(file.folderPath))?.folderPath);
}

function buildFilePreview({ candidateId, file, relativeFolderPath, resolvedFolderPath, sourceFolderPath, stagingRoot, musicRoot }) {
  const filename = sanitizeFilename(file.filename, `candidate-${candidateId}-file`);
  const relativeSegments = relativeFolderPath ? relativeFolderPath.split('/').filter(Boolean) : [];
  const stagingSegments = [stagingRoot, 'import-candidates', candidateId, ...relativeSegments, filename];
  const librarySegments = [musicRoot, ...(relativeSegments.length ? relativeSegments : [candidateId]), filename];

  return {
    fileId: file.id,
    filename,
    rawSourcePath: sourceFolderPath ? path.join(sourceFolderPath, filename) : null,
    sourcePath: resolvedFolderPath ? path.join(resolvedFolderPath, filename) : null,
    stagingPath: path.join(...stagingSegments),
    libraryPath: path.join(...librarySegments),
  };
}

export function createImportCandidatePreviewService({
  getImportCandidate,
  loadSettingsFn = loadSettings,
} = {}) {
  if (typeof getImportCandidate !== 'function') {
    throw new Error('createImportCandidatePreviewService requires getImportCandidate');
  }

  async function previewImportCandidate({ importCandidateId }) {
    const candidate = await getImportCandidate({ importCandidateId });
    if (!candidate) {
      throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
    }

    const settings = await loadSettingsFn();
    const downloadsRoot = settings.paths?.downloads;
    const downloadMappings = settings.paths?.downloadMappings ?? [];
    const stagingRoot = settings.paths?.staging;
    const musicRoot = settings.paths?.music;
    const resolvedFolderPath = resolveCandidateFolderPath(candidate);
    const sourceResolution = resolveDownloadCandidateFolder({
      candidateFolderPath: resolvedFolderPath,
      downloadMappings,
      downloadsRoot,
    });
    const warnings = [
      ...sourceResolution.warnings,
      buildPathWarning(
        'naming_preview_mirrors_candidate',
        'Naming preview currently mirrors the candidate-relative folder and file structure until canonical naming rules are implemented.',
      ),
    ];
    const blockers = [...sourceResolution.blockers];
    const filePreviews = candidate.files.map((file) => buildFilePreview({
      candidateId: candidate.id,
      file,
      relativeFolderPath: sourceResolution.relativeFolderPath,
      resolvedFolderPath: sourceResolution.resolvedFolderPath,
      sourceFolderPath: sourceResolution.rawSourceFolderPath,
      stagingRoot,
      musicRoot,
    }));

    return {
      candidate: {
        id: candidate.id,
        status: candidate.status,
        username: candidate.username,
        folderPath: candidate.folderPath,
        fileCount: candidate.fileCount,
      },
      source: {
        downloadsRoot,
        mapping: sourceResolution.matchedMapping,
        rawFolderPath: candidate.folderPath,
        relativeFolderPath: sourceResolution.relativeFolderPath,
        resolutionStrategy: sourceResolution.resolutionStrategy,
        sourceFolderPath: sourceResolution.rawSourceFolderPath,
        resolvedFolderPath: sourceResolution.resolvedFolderPath,
      },
      staging: {
        root: stagingRoot,
        previewFolderPath: path.join(stagingRoot, 'import-candidates', candidate.id, sourceResolution.relativeFolderPath),
      },
      library: {
        root: musicRoot,
        rootFolderPolicy: 'single_root',
        previewFolderPath: path.join(musicRoot, sourceResolution.relativeFolderPath || candidate.id),
      },
      naming: {
        strategy: 'mirror_candidate_path',
        filePreviews,
      },
      validation: {
        canPreview: blockers.length === 0,
        blockers,
        warnings,
      },
    };
  }

  return {
    previewImportCandidate,
  };
}