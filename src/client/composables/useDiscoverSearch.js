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
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { searchMusicBrainzArtists } from '../lib/metadata-api.js';

/**
 * Focused composable for the Discover artist search flow.
 *
 * Handles search query state, in-flight status, result population, and error
 * messaging. Monitoring logic has been extracted into `useArtistMonitoring.js`
 * so that it can be reused independently across screens.
 */
export function useDiscoverSearch({
  searchArtists = searchMusicBrainzArtists,
} = {}) {

  /** Current value of the search text input. */
  const query = ref('');

  /** Artist results from the last completed search. */
  const results = ref([]);

  /** True while a search request is in flight. */
  const isSearching = ref(false);

  /** Error message from the last failed search, or empty string. */
  const searchError = ref('');

  /**
   * Whether the user has submitted at least one search.
   * Used to distinguish "before any search" from "search returned no results".
   */
  const hasSearched = ref(false);

  /**
   * Run an artist search against MusicBrainz.
   * Clears previous results and error on each call. Pass an AbortSignal so a
   * newer search can supersede an in-flight one: an aborted call is treated as
   * an intentional cancellation (no error, no loading-flag reset) and its
   * stale result is discarded.
   */
  async function runSearch({ signal } = {}) {
    const trimmed = query.value.trim();
    if (!trimmed) return;

    searchError.value = '';
    results.value = [];
    isSearching.value = true;
    hasSearched.value = true;

    try {
      const payload = await searchArtists({ query: trimmed, limit: 20, signal });
      // A newer search may have aborted this one mid-flight; discard its result.
      if (signal?.aborted) return;
      results.value = payload.search?.results ?? [];
    } catch (error) {
      // An abort is an intentional cancellation, not a failure.
      if (signal?.aborted || isAbortError(error)) return;
      searchError.value = getErrorMessage(error, 'Artist search failed. Please try again.');
    } finally {
      // Only the still-current (non-aborted) search owns the loading flag.
      if (!signal?.aborted) isSearching.value = false;
    }
  }

  return {
    hasSearched,
    isSearching,
    query,
    results,
    runSearch,
    searchError,
  };
}
