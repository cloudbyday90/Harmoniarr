/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';

const OUTCOMES = new Set(['queued', 'already_queued', 'prerequisite_not_ready', 'still_needs_review', 'not_available', 'deferred']);

export function createMissingMusicLibraryAddRecheckService({ resolveMissingMusicDecisionTarget, recheckReleaseSafeAdd } = {}) {
  for (const [name, dependency] of Object.entries({ resolveMissingMusicDecisionTarget, recheckReleaseSafeAdd })) {
    if (typeof dependency !== 'function') throw new TypeError(`createMissingMusicLibraryAddRecheckService requires ${name}`);
  }
  async function recheckMissingMusicDecisionLibraryAdd({ actorUser, decisionId, requestMetadata = null }) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    if (target.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    const result = await recheckReleaseSafeAdd({ actorUserId: actorUser.id, appUserId: target.targetUser.id,
      wantedReleaseId: target.release.id, requestMetadata });
    const outcome = OUTCOMES.has(result?.outcome) ? result.outcome : 'not_available';
    return { action: { code: 'recheck_library_add', decisionId: target.decisionId, targetUserId: target.targetUser.id,
      outcome, runId: ['queued', 'already_queued'].includes(outcome) && typeof result?.runId === 'string' ? result.runId : null } };
  }
  return { recheckMissingMusicDecisionLibraryAdd };
}
