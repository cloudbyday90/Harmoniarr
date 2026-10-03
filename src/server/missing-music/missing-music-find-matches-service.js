/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { createRuntimeReporter } from '../runtime-reporter.js';

export function createMissingMusicFindMatchesService({ resolveMissingMusicDecisionTarget, requestInitialMusicSearch, startLibraryDiscoveryRun } = {}) {
  for (const [name, dependency] of Object.entries({ resolveMissingMusicDecisionTarget, requestInitialMusicSearch, startLibraryDiscoveryRun })) {
    if (typeof dependency !== 'function') throw new TypeError(`createMissingMusicFindMatchesService requires ${name}`);
  }
  async function findMissingMusicDecisionMatches({ actorUser, decisionId, requestMetadata = null }) {
    const target = await resolveMissingMusicDecisionTarget({ actorUser, decisionId });
    if (target.targetUser.isDisabled) throw createApiError(409, 'missing_music_decision_read_only', 'This Missing Music history is read-only');
    const intent = await requestInitialMusicSearch({ appUserId: target.targetUser.id, metadataReleaseId: target.release.metadataReleaseId,
      wantedReleaseId: target.decisionId, requestedByUserId: actorUser.id, requestMetadata });
    let run = null;
    let dispatchAlreadyActive = false;
    if (!intent.intentAlreadyRecorded) {
      try { run = (await startLibraryDiscoveryRun({ triggeredByUserId: actorUser.id, triggerSource: 'missing_music_find_matches', requestMetadata }))?.run ?? null; }
      catch (error) {
        if (error?.code === 'library_discovery_in_progress') dispatchAlreadyActive = true;
        else createRuntimeReporter({ prefix: 'harmoniarr' }).writeError(error, { label: 'initial search dispatch deferred' });
      }
    }
    return { action: { code: 'find_matches', decisionId: target.decisionId, targetUserId: target.targetUser.id,
      searchPreparationStarted: !intent.intentAlreadyRecorded, searchAlreadyQueued: intent.searchAlreadyQueued === true,
      intentAlreadyRecorded: intent.intentAlreadyRecorded === true, dispatchAlreadyActive, discoveryRunId: run?.id ?? null } };
  }
  return { findMissingMusicDecisionMatches };
}
