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

import { computed, readonly, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchSimilarArtists } from '../lib/metadata-api.js';
import { computeSuggestions } from '../lib/discover-graph.js';

/**
 * Composable for Discover recommendation traversal.
 *
 * Maintains the monitored artists currently contributing to recommendations
 * and automatically fetches similar artists for each recommendation input.
 * Suggestions are derived by merging all per-input results: artists
 * recommended by multiple monitored artists score higher, and recommendation
 * inputs themselves are excluded from the output.
 *
 * The core scoring/merging logic lives in `src/client/lib/discover-graph.js`
 * as a pure function so it can be unit-tested without a Vue runtime.
 *
 * @param {object} [options]
 * @param {function} [options.fetchSimilar]
 *   Dependency-injection override for `fetchSimilarArtists`. Defaults to the
 *   real API client. Accepts `(artistId, { limit, signal })`.
 * @param {number} [options.suggestionLimit]
 *   Maximum number of suggestions to surface. Default 20.
 */
export function useDiscoverGraph({
  fetchSimilar = fetchSimilarArtists,
  suggestionLimit = 20,
} = {}) {
  let nextInputRequestVersion = 0;
  const inputRequestVersions = new Map();

  /**
   * Ordered list of monitored artists contributing to recommendations.
   * Each entry: { id: string (MBID), name: string }.
   */
  const recommendationInputs = ref([]);

  /**
   * Map<mbid, Array<{id, name, score, source}>> holding the fetched similar-
   * artist list for each recommendation input MBID. Reassigned on each update
   * for reactivity.
   */
  const inputResults = ref(new Map());

  /**
   * Set<string> of recommendation input MBIDs for which a fetch is currently
   * in flight. Reassigned on each update for reactivity.
   */
  const loadingRecommendationInputs = ref(new Set());

  /** Most recent error message from a failed similar-artist fetch, or null. */
  const lastError = ref(null);

  /** Derived Set of input MBIDs, used to exclude inputs from suggestions. */
  const recommendationInputIds = computed(() => new Set(recommendationInputs.value.map(a => a.id)));

  /**
   * Ranked list of suggested artists derived from all input results. Inputs
   * themselves are excluded. Artists that appear across multiple inputs receive
   * a summed score so they rank higher.
   */
  const suggestions = computed(() =>
    computeSuggestions(inputResults.value, recommendationInputIds.value, suggestionLimit),
  );

  const isAnyRecommendationInputLoading = computed(() => loadingRecommendationInputs.value.size > 0);
  const hasSuggestions = computed(() => suggestions.value.length > 0);
  const hasRecommendationInputs = computed(() => recommendationInputs.value.length > 0);

  /**
   * Returns true if the given MBID is already a recommendation input.
   * @param {string} artistId
   */
  function isRecommendationInput(artistId) {
    return recommendationInputIds.value.has(artistId);
  }

  /**
   * Returns true if similar artists are currently being fetched for the given
   * recommendation input MBID.
   * @param {string} artistId
   */
  function isRecommendationInputLoading(artistId) {
    return loadingRecommendationInputs.value.has(artistId);
  }

  function hasRecommendationInput(artistId) {
    return recommendationInputs.value.some((artist) => artist.id === artistId);
  }

  function ensureRecommendationInputPresent({ id, name }) {
    if (recommendationInputIds.value.has(id)) {
      return false;
    }

    recommendationInputs.value = [...recommendationInputs.value, { id, name }];
    return true;
  }

  async function loadInputSimilarArtists(artistId) {
    const requestVersion = ++nextInputRequestVersion;
    inputRequestVersions.set(artistId, requestVersion);

    loadingRecommendationInputs.value = new Set([...loadingRecommendationInputs.value, artistId]);

    try {
      const result = await fetchSimilar(artistId, { limit: 50 });
      const similar = result?.similar ?? [];

      if (!hasRecommendationInput(artistId) || inputRequestVersions.get(artistId) !== requestVersion) {
        return;
      }

      const next = new Map(inputResults.value);
      next.set(artistId, similar);
      inputResults.value = next;
      lastError.value = null;
    } catch (error) {
      if (!hasRecommendationInput(artistId) || inputRequestVersions.get(artistId) !== requestVersion) {
        return;
      }

      lastError.value = getErrorMessage(error, 'Failed to fetch similar artists.');

      // Store an empty result so the input is still tracked.
      const next = new Map(inputResults.value);
      next.set(artistId, []);
      inputResults.value = next;
    } finally {
      if (inputRequestVersions.get(artistId) === requestVersion) {
        const next = new Set(loadingRecommendationInputs.value);
        next.delete(artistId);
        loadingRecommendationInputs.value = next;
      }
    }
  }

  /**
   * Add an artist as a recommendation input and fetch similar artists for them.
   * Idempotent: calling with an already-added input is a no-op.
   *
   * @param {{ id: string, name: string }} artist
   */
  async function addRecommendationInput(artist) {
    const { id, name } = artist;

    const wasAdded = ensureRecommendationInputPresent({ id, name });
    if (!wasAdded && (inputResults.value.has(id) || loadingRecommendationInputs.value.has(id))) {
      return;
    }

    await loadInputSimilarArtists(id);
  }

  async function hydrateRecommendationInputs(artists) {
    const artistsToLoad = [];

    for (const artist of artists) {
      const id = artist?.id ?? null;
      const name = artist?.name ?? null;
      if (!id || !name) {
        continue;
      }

      ensureRecommendationInputPresent({ id, name });

      if (!inputResults.value.has(id) && !loadingRecommendationInputs.value.has(id)) {
        artistsToLoad.push(id);
      }
    }

    await Promise.all(artistsToLoad.map((artistId) => loadInputSimilarArtists(artistId)));
  }

  /**
   * Remove a recommendation input and its associated results.
   * @param {string} artistId - MBID of the recommendation input to remove.
   */
  function removeRecommendationInput(artistId) {
    recommendationInputs.value = recommendationInputs.value.filter(a => a.id !== artistId);

    const next = new Map(inputResults.value);
    next.delete(artistId);
    inputResults.value = next;

    const nextLoading = new Set(loadingRecommendationInputs.value);
    nextLoading.delete(artistId);
    loadingRecommendationInputs.value = nextLoading;

    inputRequestVersions.delete(artistId);
  }

  /** Reset all graph state. */
  function clearRecommendationInputs() {
    recommendationInputs.value = [];
    inputResults.value = new Map();
    loadingRecommendationInputs.value = new Set();
    lastError.value = null;
    inputRequestVersions.clear();
  }

  return {
    recommendationInputs: readonly(recommendationInputs),
    suggestions,
    isAnyRecommendationInputLoading,
    hasSuggestions,
    hasRecommendationInputs,
    lastError: readonly(lastError),
    isRecommendationInput,
    isRecommendationInputLoading,
    addRecommendationInput,
    hydrateRecommendationInputs,
    removeRecommendationInput,
    clearRecommendationInputs,
  };
}
