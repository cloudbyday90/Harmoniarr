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
  deriveImportCandidateAddRecoveryReasonCode,
  normalizeImportCandidateAddBlockerCode,
} from '../import-candidates/import-candidate-add-blocker.js';
import {
  addMusicQueueActivityFanoutScope,
  resolveMusicQueueWantedReleaseIds,
} from './music-queue-activity-fanout-service.js';

function normalizeOptionalString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function buildMusicQueueAddBlockedActivityEvent({
  blockerCode = null,
  recoveryReasonCode = null,
  runId = null,
  summaryCandidate = {},
} = {}) {
  const normalizedBlockerCode = normalizeImportCandidateAddBlockerCode(blockerCode);
  if (!normalizedBlockerCode) {
    return null;
  }

  const musicQueueContext = summaryCandidate.musicQueueContext ?? {};
  const releaseIdentity = summaryCandidate.releaseIdentity ?? {};
  const wantedReleaseIds = resolveMusicQueueWantedReleaseIds(summaryCandidate);
  const wantedReleaseId = wantedReleaseIds[0]
    ?? normalizeOptionalString(musicQueueContext.wantedReleaseId);
  const normalizedRecoveryReasonCode = deriveImportCandidateAddRecoveryReasonCode({
    addBlockerCode: normalizedBlockerCode,
    recoveryReasonCode,
  });

  return addMusicQueueActivityFanoutScope({
    actorUserId: null,
    entityArtist: normalizeOptionalString(releaseIdentity.artistName),
    entityId: wantedReleaseId ?? normalizeOptionalString(summaryCandidate.id),
    entityTitle: normalizeOptionalString(releaseIdentity.releaseTitle) ?? 'Downloaded files',
    entityType: wantedReleaseId ? 'wanted_release' : 'import_candidate',
    eventType: 'music_queue_import_blocked',
    extraPayload: {
      addBlockerCode: normalizedBlockerCode,
      importCandidateId: normalizeOptionalString(summaryCandidate.id),
      ...(normalizedRecoveryReasonCode ? { recoveryReasonCode: normalizedRecoveryReasonCode } : {}),
      runId: normalizeOptionalString(runId),
      schemaVersion: 1,
      wantedReleaseId,
    },
  }, { wantedReleaseIds });
}
