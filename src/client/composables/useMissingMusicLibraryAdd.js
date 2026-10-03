/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref } from 'vue';
import { addMissingMusicDecisionToLibrary } from '../lib/missing-music-api.js';
import { buildMissingMusicLibraryAddFeedback } from '../lib/missing-music-library-add-presentation.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

export function useMissingMusicLibraryAdd(options = {}) {
  const outcomeTone = ref('info');
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:add-to-library`,
    executeMutation: options.addMissingMusicDecisionToLibrary ?? addMissingMusicDecisionToLibrary,
    fallbackErrorMessage: 'The library add could not be requested. Refresh this release and try again.',
    pendingMessage: 'Checking the prepared files before queueing the library add…',
    scope: 'missing-music.decisions.add-to-library',
    successMessage: (payload) => {
      const feedback = buildMissingMusicLibraryAddFeedback(payload?.action);
      outcomeTone.value = feedback.tone;
      return feedback.message;
    },
  });
  return { ...mutation, addToLibrary: mutation.run, statusTone: computed(() => mutation.isPending.value ? 'info' : outcomeTone.value) };
}
