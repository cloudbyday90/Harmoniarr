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
import { createImportCandidateCanonicalNamingService } from './import-candidate-canonical-naming-service.js';
import { createLibraryNamingService } from '../library/library-naming-service.js';
import { createMediaStagingSafetyService } from '../media/media-staging-safety-service.js';
import { resolveDownloadCandidateFolder } from '../paths/download-path-mapping-service.js';
import { loadSettings } from '../settings.js';
import { createImportCandidateMediaPlacementPlanner } from './import-candidate-media-placement-planner.js';

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
}

function buildPathWarning(code, message) {
  return { code, message };
}

function resolveCandidateFolderPath(candidate) {
  const candidateFolderPath = normalizePathInput(candidate.folderPath);
  if (candidateFolderPath) {
    return candidateFolderPath;
  }

  return normalizePathInput(candidate.files?.find((file) => normalizePathInput(file.folderPath))?.folderPath);
}

function sanitizeRelativeFolderPath(relativeFolderPath, libraryNamingService, fallbackSegment) {
  const segments = normalizePathInput(relativeFolderPath).split('/').filter(Boolean);
  if (!segments.length) {
    return fallbackSegment;
  }

  return path.join(...segments.map((segment) => libraryNamingService.sanitizeLibraryPathSegment(segment, {
    fallback: fallbackSegment,
  })));
}

function buildFilePreview({
  candidateId,
  file,
  libraryFolderPath,
  relativeFolderPath,
  resolvedFolderPath,
  sourceFilename,
  sourceFolderPath,
  stagingRoot,
  targetFilename,
}) {
  const relativeSegments = relativeFolderPath ? relativeFolderPath.split('/').filter(Boolean) : [];
  const stagingSegments = [stagingRoot, 'import-candidates', candidateId, ...relativeSegments, targetFilename];

  return {
    fileId: file.id,
    filename: targetFilename,
    rawSourcePath: sourceFolderPath ? path.join(sourceFolderPath, sourceFilename) : null,
    sourcePath: resolvedFolderPath ? path.join(resolvedFolderPath, sourceFilename) : null,
    stagingPath: path.join(...stagingSegments),
    libraryPath: path.join(libraryFolderPath, targetFilename),
  };
}

function resolveCandidateOwnedTargetUser(candidate) {
  const requestedForUserId = candidate?.normalizedPayload?.requestOwnership?.sourceRequestedForUserId;
  if (typeof requestedForUserId !== 'string') {
    return null;
  }

  const normalizedUserId = requestedForUserId.trim();
  return normalizedUserId ? { id: normalizedUserId } : null;
}

export function createImportCandidatePreviewService({
  canonicalImportNamingService = createImportCandidateCanonicalNamingService(),
  getImportCandidate,
  getAppUserById = null,
  libraryNamingService = createLibraryNamingService(),
  loadSettingsFn = loadSettings,
  mediaStagingSafetyService = createMediaStagingSafetyService(),
  mediaPlacementPlanner = createImportCandidateMediaPlacementPlanner(),
} = {}) {
  if (typeof getImportCandidate !== 'function') {
    throw new Error('createImportCandidatePreviewService requires getImportCandidate');
  }

  if (typeof mediaPlacementPlanner?.planCandidateLibraryPlacement !== 'function') {
    throw new Error('createImportCandidatePreviewService requires mediaPlacementPlanner.planCandidateLibraryPlacement');
  }

  async function previewImportCandidate({ importCandidateId, targetUser = null }) {
    const candidate = await getImportCandidate({ importCandidateId });
    if (!candidate) {
      throw createApiError(404, 'import_candidate_not_found', 'Import candidate not found');
    }

    const settings = await loadSettingsFn();
    const downloadsRoot = settings.paths?.downloads;
    const downloadMappings = settings.paths?.downloadMappings ?? [];
    const stagingRoot = settings.paths?.staging;
    const musicRoot = settings.paths?.music;
    const userMusicRoots = settings.paths?.userMusicRoots ?? [];
    const resolvedFolderPath = resolveCandidateFolderPath(candidate);
    const effectiveTargetUser = resolveCandidateOwnedTargetUser(candidate) ?? targetUser;
    const sourceResolution = resolveDownloadCandidateFolder({
      candidateFolderPath: resolvedFolderPath,
      downloadMappings,
      downloadsRoot,
    });
    const appUser = effectiveTargetUser && typeof getAppUserById === 'function'
      ? await getAppUserById({ userId: effectiveTargetUser.id })
      : null;
    const canonicalNamingPlan = typeof canonicalImportNamingService?.resolveCanonicalImportNaming === 'function'
      ? await canonicalImportNamingService.resolveCanonicalImportNaming({ candidate })
      : null;
    const warnings = [
      ...sourceResolution.warnings,
    ];
    const blockers = [...sourceResolution.blockers];
    const relativeFolderPath = canonicalNamingPlan?.canApply
      ? canonicalNamingPlan.relativeFolderPath
      : sanitizeRelativeFolderPath(
        sourceResolution.relativeFolderPath || candidate.id,
        libraryNamingService,
        candidate.id,
      );
    if (canonicalNamingPlan?.warnings?.length) {
      warnings.push(...canonicalNamingPlan.warnings);
    }
    if (!canonicalNamingPlan?.canApply) {
      warnings.push(buildPathWarning(
        'naming_preview_mirrors_candidate',
        'Naming preview mirrors the candidate-relative folder and filename structure when no canonical release naming plan is available.',
      ));
    }
    const libraryPlacement = mediaPlacementPlanner.planCandidateLibraryPlacement({
      appUsers: appUser ? [appUser] : [],
      musicRoot,
      relativeFolderPath,
      targetUser: effectiveTargetUser,
      userMusicRoots,
    });
    if (effectiveTargetUser && !libraryPlacement.targetUser?.configured) {
      warnings.push(buildPathWarning(
        'per_user_destination_unconfigured',
        'No configured per-user destination exists for the active app user, so preview falls back to the shared library root until a per-user path is configured in settings.',
      ));
    } else if (libraryPlacement.targetUser?.configuredBy === 'settings') {
      warnings.push(buildPathWarning(
        'per_user_destination_legacy_settings_fallback',
        'The active app user is still using the legacy settings-backed destination mapping. Move this root onto the user record to keep provisioning, permissions, and future Plex onboarding in one boundary.',
      ));
    }
    const filePreviews = candidate.files.map((file) => {
      const safetyAssessment = mediaStagingSafetyService.assessCandidateFile({
        candidateId: candidate.id,
        file,
      });
      if (safetyAssessment.blockers.length > 0) {
        blockers.push(...safetyAssessment.blockers);
      }

      return buildFilePreview({
        candidateId: candidate.id,
        file,
        libraryFolderPath: libraryPlacement.previewFolderPath,
        relativeFolderPath,
        resolvedFolderPath: sourceResolution.resolvedFolderPath,
        sourceFilename: safetyAssessment.sourceFilename,
        sourceFolderPath: sourceResolution.rawSourceFolderPath,
        stagingRoot,
        targetFilename: canonicalNamingPlan?.canApply
          ? (canonicalNamingPlan.fileNamesById.get(file.id)
            ?? libraryNamingService.sanitizeLibraryFilename(file.filename, {
              extension: file.extension,
              fallback: `candidate-${candidate.id}-file`,
            }))
          : libraryNamingService.sanitizeLibraryFilename(file.filename, {
            extension: file.extension,
            fallback: `candidate-${candidate.id}-file`,
          }),
      });
    });

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
        previewFolderPath: path.join(stagingRoot, 'import-candidates', candidate.id, relativeFolderPath),
      },
      library: {
        configuredUserRootPaths: libraryPlacement.configuredUserRootPaths,
        root: musicRoot,
        rootFolderPolicy: libraryPlacement.rootFolderPolicy,
        previewFolderPath: libraryPlacement.previewFolderPath,
        reusePolicy: libraryPlacement.reusePolicy,
        targetUser: libraryPlacement.targetUser,
        userRootPath: libraryPlacement.userRootPath,
      },
      naming: {
        releaseIdentity: canonicalNamingPlan?.canApply
          ? {
            artistName: canonicalNamingPlan.artistName ?? null,
            releaseTitle: canonicalNamingPlan.releaseTitle ?? null,
          }
          : null,
        strategy: canonicalNamingPlan?.canApply ? canonicalNamingPlan.strategy : 'mirror_candidate_path',
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
