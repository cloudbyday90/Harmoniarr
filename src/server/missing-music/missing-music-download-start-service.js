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
import { projectMusicQueueRelease } from '../acquisition/acquisition-pipeline-service.js';
import {
  buildMusicQueueDownloadQueuedActivityEvent,
} from '../activity/music-queue-milestone-activity-event-service.js';
import { recordActivityEventSafely } from '../activity/music-queue-lifecycle-activity-event-service.js';
import { canStartMissingMusicDownload } from './missing-music-download-start-policy.js';
import { findSelectedMissingMusicMatchId } from './missing-music-selected-match.js';

function validateDependencies({
  projectMusicQueueReleaseFn,
  resolveMissingMusicDecisionTarget,
  startImportCandidateExecutionRun,
}) {
  if (typeof projectMusicQueueReleaseFn !== 'function') {
    throw new TypeError('createMissingMusicDownloadStartService requires projectMusicQueueReleaseFn');
  }

  if (typeof resolveMissingMusicDecisionTarget !== 'function') {
    throw new TypeError('createMissingMusicDownloadStartService requires resolveMissingMusicDecisionTarget');
  }

  if (typeof startImportCandidateExecutionRun !== 'function') {
    throw new TypeError('createMissingMusicDownloadStartService requires startImportCandidateExecutionRun');
  }
}

function buildActivityCandidate({ matchId, target }) {
  return {
    id: matchId,
    musicQueueContext: { wantedReleaseId: target.decisionId },
    releaseIdentity: {
      artistName: target.release.artistName,
      releaseTitle: target.release.releaseTitle,
    },
  };
}

/**
 * Owns the release-scoped boundary between a manual Missing Music selection
 * and the existing durable download execution worker. The browser supplies
 * only a decision ID; candidate and target account are re-resolved here.
 */
export function createMissingMusicDownloadStartService({
  projectMusicQueueReleaseFn = projectMusicQueueRelease,
  recordActivityEventFn = null,
  resolveMissingMusicDecisionTarget,
  startImportCandidateExecutionRun,
} = {}) {
  validateDependencies({
    projectMusicQueueReleaseFn,
    resolveMissingMusicDecisionTarget,
    startImportCandidateExecutionRun,
  });

  async function startMissingMusicDecisionDownload({
    actorUser,
    decisionId,
    requestMetadata = null,
  } = {}) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });

    if (target.targetUser.isDisabled) {
      throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    }

    if (actorUser?.role !== 'admin') {
      throw createApiError(403, 'missing_music_download_admin_required', 'Only an administrator can start a download');
    }

    const matchId = findSelectedMissingMusicMatchId(target.release);
    const nextAction = projectMusicQueueReleaseFn(target.release)?.status?.nextAction ?? null;
    if (!canStartMissingMusicDownload({
      actorUser,
      nextAction,
      targetUser: target.targetUser,
    }) || !matchId) {
      throw createApiError(
        409,
        'missing_music_download_not_ready',
        'Select one match for this release before starting its download',
      );
    }

    const execution = await startImportCandidateExecutionRun({
      requestMetadata,
      selectedCandidateId: matchId,
      sourceWantedReleaseId: target.decisionId,
      triggeredByUserId: actorUser.id,
      triggerSource: 'missing_music_manual',
    });
    const operationRunId = execution?.run?.id ?? null;

    recordActivityEventSafely(
      recordActivityEventFn,
      buildMusicQueueDownloadQueuedActivityEvent({
        actorUserId: actorUser.id,
        candidate: buildActivityCandidate({ matchId, target }),
        operationRunId,
      }),
    );

    return {
      action: {
        code: 'start_download',
        decisionId: target.decisionId,
        downloadPreparationStarted: true,
        matchId,
        operationRunId,
        targetUserId: target.targetUser.id,
      },
    };
  }

  return {
    startMissingMusicDecisionDownload,
  };
}
