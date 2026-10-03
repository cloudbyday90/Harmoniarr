/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { computed } from 'vue';
import { selectMissingMusicDecisionMatch as defaultSelectMissingMusicDecisionMatch } from '../lib/missing-music-api.js';
import { useMissingMusicDecisionMutation } from './useMissingMusicDecisionMutation.js';

function normalizeId(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function useMissingMusicMatchSelection(options = {}) {
  const mutation = useMissingMusicDecisionMutation({
    ...options,
    actionKey: ({ decisionId, matchId }) => `${decisionId}:${matchId}:select`,
    executeMutation: options.selectMissingMusicDecisionMatch ?? defaultSelectMissingMusicDecisionMatch,
    fallbackErrorMessage: 'The match could not be selected. Refresh this release and try again.',
    pendingMessage: 'Selecting this match…',
    scope: 'missing-music.decisions.matches.select',
    successMessage: 'Match selected. Download has not started.',
  });
  const activeMatchId = computed(() => mutation.activePayload.value?.matchId ?? '');

  function selectMatch({ decisionId, matchId } = {}) {
    const normalizedMatchId = normalizeId(matchId);
    if (!normalizedMatchId) return Promise.resolve(null);
    return mutation.run({ decisionId, matchId: normalizedMatchId });
  }

  return {
    activeMatchId,
    clearFeedback: mutation.clearFeedback,
    errorMessage: mutation.errorMessage,
    isPending: mutation.isPending,
    selectMatch,
    statusMessage: mutation.statusMessage,
  };
}
