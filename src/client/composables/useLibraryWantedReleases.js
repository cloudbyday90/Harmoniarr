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
import { fetchLibraryWantedReleases as defaultFetchLibraryWantedReleases } from '../lib/library-api.js';

export function useLibraryWantedReleases({
  fetchLibraryWantedReleases = defaultFetchLibraryWantedReleases,
} = {}) {
  const wantedReleasesResponse = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const wantedReleases = computed(() => wantedReleasesResponse.value?.wantedReleases ?? []);
  const missingReleases = computed(() => wantedReleases.value.filter((r) => r.wantedStatus === 'missing'));
  const partialReleases = computed(() => wantedReleases.value.filter((r) => r.wantedStatus === 'partial'));
  const totalCount = computed(() => wantedReleasesResponse.value?.total ?? 0);

  async function loadWantedReleases({ wantedStatus = null } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      wantedReleasesResponse.value = await fetchLibraryWantedReleases({ wantedStatus });
    } catch (error) {
      wantedReleasesResponse.value = null;
      errorMessage.value = getErrorMessage(error, 'Wanted releases failed to load');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    errorMessage,
    isLoading,
    loadWantedReleases,
    missingReleases,
    partialReleases,
    totalCount,
    wantedReleases,
  };
}
