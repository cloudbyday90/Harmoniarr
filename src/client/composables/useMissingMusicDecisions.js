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

import { computed, ref } from 'vue';
import { fetchMissingMusicDecisions as defaultFetchMissingMusicDecisions } from '../lib/missing-music-api.js';
import {
  createMissingMusicDecisionFilters,
  DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
} from '../lib/missing-music-worklist-presentation.js';
import { useAsyncResource } from './useAsyncResource.js';

function normalizePayload(payload) {
  return {
    checkedAt: payload?.checkedAt ?? null,
    decisions: Array.isArray(payload?.decisions) ? payload.decisions : [],
    filters: payload?.filters ?? {},
    page: payload?.page ?? { limit: 50, offset: 0, sourceLimitReached: false, total: 0 },
    scope: payload?.scope ?? 'mine',
    users: Array.isArray(payload?.users) ? payload.users : [],
  };
}

/**
 * Owns the SWR read lifecycle for the Missing Music worklist. The server still
 * resolves the authenticated actor and permitted target-user scope.
 */
export function useMissingMusicDecisions({
  fetchMissingMusicDecisions = defaultFetchMissingMusicDecisions,
  immediate = true,
  initialFilters = DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
  pollIntervalMs = 30000,
  revalidateOnFocus = true,
} = {}) {
  const filters = ref(createMissingMusicDecisionFilters(initialFilters));
  const resource = useAsyncResource({
    fallbackErrorMessage: 'Missing Music could not be refreshed.',
    fetcher: () => fetchMissingMusicDecisions(filters.value),
    immediate,
    initialData: normalizePayload(null),
    pollIntervalMs,
    project: normalizePayload,
    revalidateOnFocus,
  });

  const decisions = computed(() => resource.data.value.decisions);
  const page = computed(() => resource.data.value.page);
  const scope = computed(() => resource.data.value.scope);
  const users = computed(() => resource.data.value.users);

  async function applyFilters(nextFilters) {
    filters.value = createMissingMusicDecisionFilters({
      ...filters.value,
      ...nextFilters,
    });
    await resource.load();
  }

  return {
    applyFilters,
    decisions,
    errorMessage: resource.errorMessage,
    filters,
    isLoading: resource.isLoading,
    isRevalidating: resource.isRevalidating,
    page,
    refresh: resource.load,
    scope,
    users,
  };
}
