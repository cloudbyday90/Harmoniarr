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

export function normalizeStageSummaryLimit(value) {
  if (value == null || value === '') {
    return 25;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    const error = new Error('limit must be an integer between 1 and 1000');
    error.status = 400;
    error.code = 'validation_error';
    throw error;
  }

  return parsed;
}

export function buildCandidatePlanningSummary(preview) {
  return {
    blockerCount: preview?.validation?.blockers?.length ?? 0,
    canPreview: preview?.validation?.canPreview ?? false,
    libraryFolderPath: preview?.library?.previewFolderPath ?? null,
    primaryBlocker: preview?.validation?.blockers?.[0]?.message ?? null,
    primaryWarning: preview?.validation?.warnings?.[0]?.message ?? null,
    resolutionStrategy: preview?.source?.resolutionStrategy ?? null,
    sourceFolderPath: preview?.source?.resolvedFolderPath ?? preview?.source?.sourceFolderPath ?? null,
    stagingFolderPath: preview?.staging?.previewFolderPath ?? null,
    warningCount: preview?.validation?.warnings?.length ?? 0,
  };
}

function buildMusicQueueContext(candidate) {
  const context = candidate?.normalizedPayload?.musicQueue;
  if (!context || typeof context !== 'object') {
    return null;
  }

  const profileCode = typeof context.profileCode === 'string' && context.profileCode.trim()
    ? context.profileCode.trim()
    : null;
  const qualityOverride = context.qualityOverride && typeof context.qualityOverride === 'object'
    ? context.qualityOverride
    : null;
  const wantedReleaseId = typeof context.wantedReleaseId === 'string' && context.wantedReleaseId.trim()
    ? context.wantedReleaseId.trim()
    : typeof qualityOverride?.wantedReleaseId === 'string' && qualityOverride.wantedReleaseId.trim()
      ? qualityOverride.wantedReleaseId.trim()
      : null;

  if (!profileCode && !qualityOverride && !wantedReleaseId) {
    return null;
  }

  return {
    profileCode,
    qualityOverride,
    ...(wantedReleaseId ? { wantedReleaseId } : {}),
  };
}

export function buildStageCandidateBase(candidate, preview) {
  return {
    fileCount: candidate.fileCount,
    folderPath: candidate.folderPath,
    id: candidate.id,
    downloadAttemptCount: candidate.downloadAttemptCount ?? 0,
    lockedFileCount: candidate.lockedFileCount,
    musicQueueContext: buildMusicQueueContext(candidate),
    planning: buildCandidatePlanningSummary(preview),
    releaseIdentity: preview?.naming?.releaseIdentity ?? null,
    requestOwnership: candidate.normalizedPayload?.requestOwnership ?? null,
    selectionReason: candidate.selectionReason ?? null,
    sourceProvider: candidate.sourceProvider,
    sourceSearchId: candidate.sourceSearchId,
    totalSizeBytes: candidate.totalSizeBytes,
    uploaderReputation: candidate.uploaderReputation ?? null,
    username: candidate.username,
  };
}
