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
import { fetchLibraryReleases as defaultFetchLibraryReleases } from '../lib/library-api.js';

export function useLibraryReleases({
  fetchLibraryReleases = defaultFetchLibraryReleases,
} = {}) {
  const releasesResponse = ref(null);
  const errorMessage = ref('');
  const isLoading = ref(true);

  const releases = computed(() => releasesResponse.value?.releases ?? []);
  const totalCount = computed(() => releasesResponse.value?.total ?? 0);
  const completeReleases = computed(() => releases.value.filter((r) => r.reconciliationStatus === 'complete'));
  const partialReleases = computed(() => releases.value.filter((r) => r.reconciliationStatus === 'partial'));
  const duplicateReleases = computed(() => releases.value.filter((r) => r.reconciliationStatus === 'duplicate'));

  async function loadReleases({ reconciliationStatus = null } = {}) {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      releasesResponse.value = await fetchLibraryReleases({ reconciliationStatus });
    } catch (error) {
      releasesResponse.value = null;
      errorMessage.value = getErrorMessage(error, 'Library releases failed to load');
    } finally {
      isLoading.value = false;
    }
  }

  return {
    completeReleases,
    duplicateReleases,
    errorMessage,
    isLoading,
    loadReleases,
    partialReleases,
    releases,
    totalCount,
  };
}
