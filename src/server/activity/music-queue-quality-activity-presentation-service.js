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

import {
  addMusicQueueActivityFanoutScope,
  resolveMusicQueueWantedReleaseIds,
} from './music-queue-activity-fanout-service.js';

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBlockers(blockers) {
  return Array.isArray(blockers)
    ? blockers.map((blocker) => ({
        code: normalizeString(blocker?.code),
        fileId: normalizeString(blocker?.fileId),
        filename: normalizeString(blocker?.filename),
        message: normalizeString(blocker?.message),
      }))
    : [];
}

export function buildMusicQueueQualityBlockedActivityEvent({
  qualityGate = {},
  runId = null,
  summaryCandidate = {},
} = {}) {
  const musicQueueContext = summaryCandidate.musicQueueContext ?? {};
  const releaseIdentity = summaryCandidate.releaseIdentity ?? {};
  const wantedReleaseIds = resolveMusicQueueWantedReleaseIds(summaryCandidate);
  const wantedReleaseId = wantedReleaseIds[0]
    ?? normalizeString(musicQueueContext.wantedReleaseId)
    ?? normalizeString(musicQueueContext.qualityOverride?.wantedReleaseId);
  const releaseTitle = normalizeString(releaseIdentity.releaseTitle) ?? 'Downloaded files';
  const artistName = normalizeString(releaseIdentity.artistName);

  return addMusicQueueActivityFanoutScope({
    actorUserId: null,
    entityArtist: artistName,
    entityId: wantedReleaseId ?? normalizeString(summaryCandidate.id),
    entityTitle: releaseTitle,
    entityType: wantedReleaseId ? 'wanted_release' : 'import_candidate',
    eventType: 'music_queue_quality_blocked',
    extraPayload: {
      blockers: normalizeBlockers(qualityGate.blockers),
      checkedFileCount: Number.isFinite(Number(qualityGate.checkedFileCount))
        ? Number(qualityGate.checkedFileCount)
        : 0,
      importCandidateId: normalizeString(summaryCandidate.id),
      message: normalizeString(qualityGate.message),
      profileCode: normalizeString(qualityGate.profileCode),
      runId: normalizeString(runId),
      route: wantedReleaseId
        ? {
            name: 'music-queue-release',
            params: { wantedReleaseId },
          }
        : null,
      schemaVersion: 1,
      status: normalizeString(qualityGate.status),
      wantedReleaseId,
    },
  }, { wantedReleaseIds });
}
