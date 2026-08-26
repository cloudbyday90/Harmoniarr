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

import { createApiError } from '../auth.js';
import {
  buildMusicQueueMatchSelectedActivityEvent,
} from '../activity/music-queue-milestone-activity-event-service.js';
import { recordActivityEventSafely } from '../activity/music-queue-lifecycle-activity-event-service.js';
import { findSelectableMissingMusicMatch } from './missing-music-match-choice-projection.js';

const MAX_MATCH_ID_LENGTH = 200;

function normalizeMatchId(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'matchId must be text');
  }

  const matchId = value.trim();
  if (matchId.length === 0 || matchId.length > MAX_MATCH_ID_LENGTH) {
    throw createApiError(400, 'validation_error', `matchId must be between 1 and ${MAX_MATCH_ID_LENGTH} characters`);
  }

  return matchId;
}

function validateDependencies({ resolveMissingMusicDecisionTarget, selectImportCandidate }) {
  if (typeof resolveMissingMusicDecisionTarget !== 'function') {
    throw new TypeError('createMissingMusicDecisionCommandService requires resolveMissingMusicDecisionTarget');
  }

  if (typeof selectImportCandidate !== 'function') {
    throw new TypeError('createMissingMusicDecisionCommandService requires selectImportCandidate');
  }
}

/**
 * Owns mutations initiated from Missing Music. Selection is intentionally the
 * final action in this slice: it records the chosen candidate but does not
 * start a download or enqueue provider work.
 */
export function createMissingMusicDecisionCommandService({
  recordActivityEventFn = null,
  resolveMissingMusicDecisionTarget,
  selectImportCandidate,
} = {}) {
  validateDependencies({ resolveMissingMusicDecisionTarget, selectImportCandidate });

  async function selectMissingMusicDecisionMatch({
    actorUser,
    decisionId,
    matchId,
    requestMetadata = null,
  } = {}) {
    const normalizedMatchId = normalizeMatchId(matchId);
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });

    if (target.targetUser.isDisabled) {
      throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    }

    const match = findSelectableMissingMusicMatch(target.release, normalizedMatchId);
    if (!match) {
      throw createApiError(404, 'missing_music_match_not_found', 'Missing Music match was not found for this release');
    }

    const selection = await selectImportCandidate({
      actorUserId: actorUser.id,
      eventDetails: {
        missingMusic: {
          targetUserId: target.targetUser.id,
          transferStarted: false,
          wantedReleaseId: target.decisionId,
        },
      },
      importCandidateId: normalizedMatchId,
      reason: 'Selected from Missing Music',
      requestMetadata,
    });

    recordActivityEventSafely(
      recordActivityEventFn,
      buildMusicQueueMatchSelectedActivityEvent({
        actorUserId: actorUser.id,
        candidate: selection?.candidate ?? {
          id: normalizedMatchId,
          musicQueueContext: { wantedReleaseId: target.decisionId },
          releaseIdentity: {
            artistName: target.release.artistName,
            releaseTitle: target.release.releaseTitle,
          },
        },
        selectionMode: 'manual',
      }),
    );

    return {
      action: {
        code: 'use_match',
        decisionId: target.decisionId,
        downloadStarted: false,
        matchId: normalizedMatchId,
        targetUserId: target.targetUser.id,
      },
    };
  }

  return {
    selectMissingMusicDecisionMatch,
  };
}
