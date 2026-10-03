/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { searchMissingMusicDecisionAgain } from '../lib/missing-music-api.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

export function useMissingMusicSearchAgain(options = {}) {
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:search-again`,
    executeMutation: options.searchMissingMusicDecisionAgain ?? searchMissingMusicDecisionAgain,
    fallbackErrorMessage: 'The search could not be queued. Refresh this release and try again.',
    pendingMessage: 'Queueing a new search…',
    scope: 'missing-music.decisions.search-again',
    successMessage: (payload) => payload?.action?.dispatchAlreadyActive
      ? 'Search work is already running. This release is queued for evaluation.'
      : payload?.action?.restartAlreadyQueued
        ? 'A new search is already queued for this release.'
        : 'A new search is queued. Acquisition will follow the saved automation policy.',
  });
  return { ...mutation, searchAgain: mutation.run };
}
