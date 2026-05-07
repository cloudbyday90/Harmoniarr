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
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchReleaseRadar as defaultFetchReleaseRadar } from '../lib/library-api.js';
import { normalizeRadarReleaseForCard } from '../lib/release-radar-normalization.js';

/**
 * Composable that loads the release radar: new and upcoming releases from
 * monitored artists.
 *
 * Not lifecycle-bound — the caller triggers `load()`, typically in `onMounted`.
 * Returns raw radar items pre-normalized via `normalizeRadarReleaseForCard` so
 * they can be passed directly to `ReleaseCard`.
 *
 * @param {object} [options]
 * @param {function} [options.fetchRadarFn] - Override for testing.
 */
export function useReleaseRadar({
  fetchRadarFn = defaultFetchReleaseRadar,
} = {}) {
  const recent = ref([]);
  const upcoming = ref([]);
  const checkedAt = ref(null);
  const windows = ref({ recentDays: 30, upcomingDays: 90 });
  const isLoading = ref(false);
  const errorMessage = ref('');

  const hasRecent = computed(() => recent.value.length > 0);
  const hasUpcoming = computed(() => upcoming.value.length > 0);
  const isEmpty = computed(() => !hasRecent.value && !hasUpcoming.value);

  /**
   * Loads the release radar from the API. Normalizes each item for use with
   * `ReleaseCard`. Clears any previous error before fetching.
   *
   * @param {object} [options]
   * @param {AbortSignal} [options.signal] - Optional abort signal.
   */
  async function load({ signal } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const payload = await fetchRadarFn({ signal });
      recent.value = Array.isArray(payload?.recent)
        ? payload.recent.map(normalizeRadarReleaseForCard)
        : [];
      upcoming.value = Array.isArray(payload?.upcoming)
        ? payload.upcoming.map(normalizeRadarReleaseForCard)
        : [];
      checkedAt.value = payload?.checkedAt ?? null;
      windows.value = payload?.windows ?? { recentDays: 30, upcomingDays: 90 };
    } catch (error) {
      recent.value = [];
      upcoming.value = [];
      checkedAt.value = null;
      errorMessage.value = getErrorMessage(error, 'Could not load release radar.');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    checkedAt,
    errorMessage,
    hasRecent,
    hasUpcoming,
    isEmpty,
    isLoading,
    load,
    recent,
    upcoming,
    windows,
  };
}
