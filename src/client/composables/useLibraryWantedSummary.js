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
import { fetchLibraryWantedSummary as defaultFetchLibraryWantedSummary } from '../lib/library-api.js';

export function useLibraryWantedSummary({
  fetchLibraryWantedSummary = defaultFetchLibraryWantedSummary,
} = {}) {
  const libraryWantedSummary = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const monitoredArtistCount = computed(() => libraryWantedSummary.value?.monitoredArtistCount ?? 0);
  const releaseCounts = computed(() => libraryWantedSummary.value?.releaseCounts ?? null);
  const summary = computed(() => libraryWantedSummary.value?.summary ?? null);

  async function loadLibraryWantedSummary() {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      libraryWantedSummary.value = await fetchLibraryWantedSummary();
    } catch (error) {
      libraryWantedSummary.value = null;
      errorMessage.value = getErrorMessage(error, 'Library wanted summary failed');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    isLoading,
    libraryWantedSummary,
    loadLibraryWantedSummary,
    monitoredArtistCount,
    releaseCounts,
    summary,
  };
}