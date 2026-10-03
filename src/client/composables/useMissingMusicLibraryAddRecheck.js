/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { computed, ref } from 'vue';
import { recheckMissingMusicDecisionLibraryAdd } from '../lib/missing-music-api.js';
import { buildMissingMusicLibraryAddRecheckFeedback } from '../lib/missing-music-library-add-recheck-presentation.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

export function useMissingMusicLibraryAddRecheck(options = {}) {
  const outcomeTone = ref('info');
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId }) => `${decisionId}:recheck-library-add`,
    executeMutation: options.recheckMissingMusicDecisionLibraryAdd ?? recheckMissingMusicDecisionLibraryAdd,
    fallbackErrorMessage: 'The files could not be rechecked. Refresh this release and try again.',
    pendingMessage: 'Checking the completed files again…',
    scope: 'missing-music.decisions.recheck-library-add',
    successMessage: (payload) => {
      const feedback = buildMissingMusicLibraryAddRecheckFeedback(payload?.action);
      outcomeTone.value = feedback.tone;
      return feedback.message;
    },
  });
  return { ...mutation, recheckLibraryAdd: mutation.run, statusTone: computed(() => mutation.isPending.value ? 'info' : outcomeTone.value) };
}
