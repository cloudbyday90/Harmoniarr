/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';

export function createMissingMusicFallbackQualityService({ allowMusicQueueReleaseFallbackQuality, resolveMissingMusicDecisionTarget } = {}) {
  for (const [name, dependency] of Object.entries({ allowMusicQueueReleaseFallbackQuality, resolveMissingMusicDecisionTarget })) {
    if (typeof dependency !== 'function') throw new TypeError(`createMissingMusicFallbackQualityService requires ${name}`);
  }
  async function allowMissingMusicDecisionFallbackQuality({ actorUser, decisionId, requestMetadata = null } = {}) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    if (target.targetUser.isDisabled || target.targetUser.accountStatus === 'disabled') {
      throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    }
    const result = await allowMusicQueueReleaseFallbackQuality({ actorUserId: actorUser.id,
      appUserId: target.targetUser.id, includeRelease: false, requestMetadata, wantedReleaseId: target.decisionId });
    return { action: {
      code: 'allow_fallback_quality', decisionId: target.decisionId, targetUserId: target.targetUser.id,
      fallbackAllowed: true, searchPreparationStarted: result.action?.overrideAlreadyAllowed !== true || result.action?.restartAlreadyQueued === true,
      overrideAlreadyAllowed: result.action?.overrideAlreadyAllowed === true,
      restartAlreadyQueued: result.action?.restartAlreadyQueued === true,
      dispatchAlreadyActive: result.action?.dispatchAlreadyActive === true,
      discoveryRunId: result.action?.discoveryRunId ?? null,
    } };
  }
  return { allowMissingMusicDecisionFallbackQuality };
}
