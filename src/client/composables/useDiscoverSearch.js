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
import {
  importMusicBrainzArtist,
  searchMusicBrainzArtists,
  updateMetadataArtistMonitoring,
} from '../lib/metadata-api.js';
import { useToast } from './useToast.js';

/**
 * Focused composable for the Discover search and monitor flow.
 *
 * Handles artist search, per-card monitoring state, and toast feedback.
 * Intentionally scoped to Discover only — does not attempt to be a
 * general-purpose artist workflow.
 */
export function useDiscoverSearch({
  searchArtists = searchMusicBrainzArtists,
  importArtist = importMusicBrainzArtist,
  updateMonitoring = updateMetadataArtistMonitoring,
} = {}) {
  const toast = useToast();

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
   * Per-artist action state map.
   * Key: artist MusicBrainz ID.
   * Value: 'monitoring' | 'monitored' | 'error'
   * Artists absent from this map are in their idle state.
   */
  const artistStates = ref(/** @type {Record<string, string>} */ ({}));

  /** Whether at least one artist has been successfully monitored this session. */
  const hasMonitored = computed(() => {
    return Object.values(artistStates.value).some((s) => s === 'monitored');
  });

  /**
   * Run an artist search against MusicBrainz.
   * Clears previous results and error on each call.
   */
  async function runSearch() {
    const trimmed = query.value.trim();
    if (!trimmed) return;

    searchError.value = '';
    results.value = [];
    isSearching.value = true;
    hasSearched.value = true;

    try {
      const payload = await searchArtists({ query: trimmed, limit: 20 });
      results.value = payload.search?.results ?? [];
    } catch (error) {
      searchError.value = getErrorMessage(error, 'Artist search failed. Please try again.');
    } finally {
      isSearching.value = false;
    }
  }

  /**
   * Import then monitor an artist from a search result card.
   * Tracks per-card state so multiple cards can be acted on independently.
   *
   * @param {{ id: string, name: string }} artist
   */
  async function monitorArtist(artist) {
    const { id, name } = artist;

    // Prevent double-click / re-monitor
    if (artistStates.value[id] === 'monitoring' || artistStates.value[id] === 'monitored') {
      return;
    }

    artistStates.value = { ...artistStates.value, [id]: 'monitoring' };

    try {
      // Import/upsert the MusicBrainz artist into the local database first.
      // The route responds with { ok, imported: { artistId, source } }.
      const importResult = await importArtist(id);
      const localArtistId = importResult?.imported?.artistId ?? null;

      if (!localArtistId) {
        throw new Error(`Could not resolve local ID for ${name} after import.`);
      }

      await updateMonitoring(localArtistId, { monitored: true });

      artistStates.value = { ...artistStates.value, [id]: 'monitored' };
      toast.success(`Monitoring ${name}.`);
    } catch (error) {
      artistStates.value = { ...artistStates.value, [id]: 'error' };
      toast.error(getErrorMessage(error, `Could not monitor ${name}. Please try again.`));
    }
  }

  return {
    artistStates,
    hasMonitored,
    hasSearched,
    isSearching,
    monitorArtist,
    query,
    results,
    runSearch,
    searchError,
  };
}
