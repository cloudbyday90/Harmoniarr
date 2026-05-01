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

import { ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import {
  searchLocalMetadataArtists,
  searchLocalMetadataReleaseGroups,
  searchLocalMetadataReleases,
} from '../lib/metadata-api.js';

export function useMetadataLocalSearchWorkflow({
  searchArtists = searchLocalMetadataArtists,
  searchReleaseGroups = searchLocalMetadataReleaseGroups,
  searchReleases = searchLocalMetadataReleases,
} = {}) {
  const localSearchQuery = ref('');
  const localArtistResults = ref([]);
  const localReleaseGroupResults = ref([]);
  const localReleaseResults = ref([]);
  const localSearchError = ref('');
  const hasSearchedLocal = ref(false);
  const isSearchingLocal = ref(false);

  function resetLocalSearchResults() {
    localArtistResults.value = [];
    localReleaseGroupResults.value = [];
    localReleaseResults.value = [];
  }

  async function runLocalSearch() {
    const query = localSearchQuery.value.trim();
    localSearchError.value = '';

    if (!query) {
      hasSearchedLocal.value = false;
      resetLocalSearchResults();
      return;
    }

    isSearchingLocal.value = true;
    hasSearchedLocal.value = true;

    try {
      const [artistPayload, releaseGroupPayload, releasePayload] = await Promise.all([
        searchArtists({ query, limit: 6 }),
        searchReleaseGroups({ query, limit: 6 }),
        searchReleases({ query, limit: 6 }),
      ]);

      localArtistResults.value = artistPayload.search?.results ?? [];
      localReleaseGroupResults.value = releaseGroupPayload.search?.results ?? [];
      localReleaseResults.value = releasePayload.search?.results ?? [];
    } catch (error) {
      resetLocalSearchResults();
      localSearchError.value = getErrorMessage(error, 'Local metadata search failed');
    } finally {
      isSearchingLocal.value = false;
    }
  }

  return {
    hasSearchedLocal,
    isSearchingLocal,
    localArtistResults,
    localReleaseGroupResults,
    localReleaseResults,
    localSearchError,
    localSearchQuery,
    runLocalSearch,
  };
}