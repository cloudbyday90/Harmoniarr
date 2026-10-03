/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { allowMissingMusicDecisionFallbackQuality } from '../lib/missing-music-api.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

function buildSuccessMessage(payload) {
  const action = payload?.action ?? {};
  const consentMessage = action.overrideAlreadyAllowed
    ? 'Fallback quality was already allowed for this recipient.'
    : 'Fallback quality is allowed for this recipient.';
  const workMessage = action.searchPreparationStarted
    ? action.dispatchAlreadyActive
      ? ' Search work is already running. This release is queued for evaluation.'
      : action.restartAlreadyQueued
        ? ' A search is already queued for this release.'
        : ' A new search is queued using saved automation.'
    : '';
  return `${consentMessage}${workMessage} Other household quality requirements still apply.`;
}

export function useMissingMusicQualityFallback(options = {}) {
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:allow-fallback-quality`,
    executeMutation: options.allowMissingMusicDecisionFallbackQuality ?? allowMissingMusicDecisionFallbackQuality,
    fallbackErrorMessage: 'The quality choice could not be saved. Refresh this release and try again.',
    pendingMessage: 'Saving the quality choice…',
    scope: 'missing-music.decisions.allow-fallback-quality',
    successMessage: buildSuccessMessage,
  });
  return { ...mutation, allowFallbackQuality: mutation.run };
}
