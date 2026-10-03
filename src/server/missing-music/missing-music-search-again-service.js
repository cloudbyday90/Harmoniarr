/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';

export function createMissingMusicSearchAgainService({
  requestMusicQueueReleaseRediscovery,
  resolveMissingMusicDecisionTarget,
} = {}) {
  for (const [name, dependency] of Object.entries({ requestMusicQueueReleaseRediscovery, resolveMissingMusicDecisionTarget })) {
    if (typeof dependency !== 'function') throw new TypeError(`createMissingMusicSearchAgainService requires ${name}`);
  }

  async function searchMissingMusicDecisionAgain({ actorUser, decisionId, requestMetadata = null } = {}) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    if (target.targetUser.isDisabled || target.targetUser.accountStatus === 'disabled') {
      throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    }

    const result = await requestMusicQueueReleaseRediscovery({
      actorUserId: actorUser.id,
      appUserId: target.targetUser.id,
      includeRelease: false,
      requestMetadata,
      wantedReleaseId: target.decisionId,
    });

    return {
      action: {
        code: 'search_again',
        decisionId: target.decisionId,
        targetUserId: target.targetUser.id,
        searchPreparationStarted: true,
        restartAlreadyQueued: result.action?.restartAlreadyQueued === true,
        dispatchAlreadyActive: result.action?.dispatchAlreadyActive === true,
        discoveryRunId: result.action?.discoveryRunId ?? null,
      },
    };
  }

  return { searchMissingMusicDecisionAgain };
}
