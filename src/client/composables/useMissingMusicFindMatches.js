/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { findMissingMusicDecisionMatches } from '../lib/missing-music-api.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

function successMessage(payload) {
  const action = payload?.action ?? {};
  if (action.intentAlreadyRecorded === true) {
    return action.searchAlreadyQueued === true
      ? 'Find matches was already requested for this recipient. This release is queued using saved automation.'
      : 'Find matches was already requested for this recipient. Check the current release status.';
  }
  if (action.searchPreparationStarted === true) {
    return action.dispatchAlreadyActive === true
      ? 'Find matches requested for this recipient. Search work is already running; this release is queued for evaluation.'
      : 'Find matches requested for this recipient. This release is queued using saved automation.';
  }
  return 'The search request was accepted. Check the current release status.';
}

export function useMissingMusicFindMatches(options = {}) {
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:find-matches`,
    executeMutation: options.findMissingMusicDecisionMatches ?? findMissingMusicDecisionMatches,
    fallbackErrorMessage: 'Matches could not be requested. Refresh this release and try again.',
    pendingMessage: 'Requesting matches…',
    scope: 'missing-music.decisions.find-matches',
    successMessage,
  });
  return { ...mutation, findMatches: mutation.run };
}
