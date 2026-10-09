/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { canReviewMissingMusicDownload, getMissingMusicDownloadReviewReference } from './missing-music-download-review-handoff-policy.js';

export function createMissingMusicDownloadReviewHandoffService({ resolveMissingMusicDecisionTarget } = {}) {
  if (typeof resolveMissingMusicDecisionTarget !== 'function') throw new TypeError('Download review handoff requires the decision target service');
  async function getMissingMusicDownloadReviewHandoff({ actorUser, decisionId } = {}) {
    if (actorUser?.role !== 'admin') throw createApiError(403, 'missing_music_download_review_admin_required', 'Only an administrator can review download evidence');
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    if (!canReviewMissingMusicDownload({ actorUser, targetUser: target.targetUser, release: target.release })) {
      throw createApiError(409, 'missing_music_download_review_unavailable', 'This release does not currently have a download request to review');
    }
    return { decisionId: target.decisionId, ...getMissingMusicDownloadReviewReference(target.release),
      release: { artistName: target.release.artistName ?? null, title: target.release.releaseTitle ?? null },
      requestedFor: { username: target.targetUser.username ?? null } };
  }
  return { getMissingMusicDownloadReviewHandoff };
}
