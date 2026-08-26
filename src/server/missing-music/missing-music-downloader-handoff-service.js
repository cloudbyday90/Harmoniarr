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
import { canViewMissingMusicDownloader } from './missing-music-downloader-handoff-policy.js';

function normalizeText(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function validateDependencies({ projectMusicQueueReleaseFn, resolveMissingMusicDecisionTarget }) {
  if (typeof projectMusicQueueReleaseFn !== 'function') {
    throw new TypeError('createMissingMusicDownloaderHandoffService requires projectMusicQueueReleaseFn');
  }

  if (typeof resolveMissingMusicDecisionTarget !== 'function') {
    throw new TypeError('createMissingMusicDownloaderHandoffService requires resolveMissingMusicDecisionTarget');
  }
}

/**
 * Resolves a Missing Music decision into the minimal context needed by
 * Downloader. The browser supplies only a decision ID. Neither a target user
 * nor provider-derived transfer data is accepted or returned.
 */
export function createMissingMusicDownloaderHandoffService({
  projectMusicQueueReleaseFn = projectMusicQueueRelease,
  resolveMissingMusicDecisionTarget,
} = {}) {
  validateDependencies({ projectMusicQueueReleaseFn, resolveMissingMusicDecisionTarget });

  async function getMissingMusicDownloaderHandoff({ actorUser, decisionId } = {}) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    const release = projectMusicQueueReleaseFn(target.release);
    const nextAction = release?.status?.nextAction ?? null;

    if (!canViewMissingMusicDownloader({ actorUser, nextAction })) {
      throw createApiError(
        409,
        'missing_music_downloader_unavailable',
        'This Missing Music release does not currently have a download to view',
      );
    }

    return {
      decisionId: target.decisionId,
      release: {
        artistName: normalizeText(release?.artistName),
        title: normalizeText(release?.releaseTitle),
      },
      requestedFor: {
        username: normalizeText(target.targetUser?.username),
      },
      wantedReleaseId: target.decisionId,
    };
  }

  return {
    getMissingMusicDownloaderHandoff,
  };
}
