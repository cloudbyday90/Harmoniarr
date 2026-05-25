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
 * Composable for the Discover taste-graph traversal.
 *
 * Maintains a list of "seeds" — artists the user has picked — and
 * automatically fetches similar artists for each seed. Suggestions are derived
 * by merging all per-seed results: artists recommended by multiple seeds score
 * higher, and seed artists themselves are excluded from the output.
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
  let nextSeedRequestVersion = 0;
  const seedRequestVersions = new Map();

  /**
   * Ordered list of seed artists the user has picked.
   * Each entry: { id: string (MBID), name: string }.
   */
  const seeds = ref([]);

  /**
   * Map<mbid, Array<{id, name, score, source}>> holding the fetched similar-
   * artist list for each seed MBID. Reassigned on each update for reactivity.
   */
  const seedResults = ref(new Map());

  /**
   * Set<string> of seed MBIDs for which a fetch is currently in flight.
   * Reassigned on each update for reactivity.
   */
  const loadingSeeds = ref(new Set());

  /** Most recent error message from a failed similar-artist fetch, or null. */
  const lastError = ref(null);

  /** Derived Set of seed MBIDs — used to exclude seeds from suggestions. */
  const seedIds = computed(() => new Set(seeds.value.map(a => a.id)));

  /**
   * Ranked list of suggested artists derived from all seed results.
   * Seeds themselves are excluded. Artists that appear across multiple seeds
   * receive a summed score so they rank higher.
   */
  const suggestions = computed(() =>
    computeSuggestions(seedResults.value, seedIds.value, suggestionLimit),
  );

  const isAnySeedLoading = computed(() => loadingSeeds.value.size > 0);
  const hasSuggestions = computed(() => suggestions.value.length > 0);
  const hasSeeds = computed(() => seeds.value.length > 0);

  /**
   * Returns true if the given MBID is already a seed.
   * @param {string} artistId
   */
  function isSeed(artistId) {
    return seedIds.value.has(artistId);
  }

  /**
   * Returns true if similar artists are currently being fetched for the given
   * seed MBID.
   * @param {string} artistId
   */
  function isSeedLoading(artistId) {
    return loadingSeeds.value.has(artistId);
  }

  function hasSeed(artistId) {
    return seeds.value.some((artist) => artist.id === artistId);
  }

  function ensureSeedPresent({ id, name }) {
    if (seedIds.value.has(id)) {
      return false;
    }

    seeds.value = [...seeds.value, { id, name }];
    return true;
  }

  async function loadSeedSimilarArtists(artistId) {
    const requestVersion = ++nextSeedRequestVersion;
    seedRequestVersions.set(artistId, requestVersion);

    loadingSeeds.value = new Set([...loadingSeeds.value, artistId]);

    try {
      const result = await fetchSimilar(artistId, { limit: 50 });
      const similar = result?.similar ?? [];

      if (!hasSeed(artistId) || seedRequestVersions.get(artistId) !== requestVersion) {
        return;
      }

      const next = new Map(seedResults.value);
      next.set(artistId, similar);
      seedResults.value = next;
      lastError.value = null;
    } catch (error) {
      if (!hasSeed(artistId) || seedRequestVersions.get(artistId) !== requestVersion) {
        return;
      }

      lastError.value = getErrorMessage(error, 'Failed to fetch similar artists.');

      // Store an empty result so the seed is still tracked.
      const next = new Map(seedResults.value);
      next.set(artistId, []);
      seedResults.value = next;
    } finally {
      if (seedRequestVersions.get(artistId) === requestVersion) {
        const next = new Set(loadingSeeds.value);
        next.delete(artistId);
        loadingSeeds.value = next;
      }
    }
  }

  /**
   * Add an artist as a seed and fetch similar artists for them.
   * Idempotent: calling with an already-seeded artist is a no-op.
   *
   * @param {{ id: string, name: string }} artist
   */
  async function addSeed(artist) {
    const { id, name } = artist;

    const wasAdded = ensureSeedPresent({ id, name });
    if (!wasAdded && (seedResults.value.has(id) || loadingSeeds.value.has(id))) {
      return;
    }

    await loadSeedSimilarArtists(id);
  }

  async function hydrateSeeds(artists) {
    const artistsToLoad = [];

    for (const artist of artists) {
      const id = artist?.id ?? null;
      const name = artist?.name ?? null;
      if (!id || !name) {
        continue;
      }

      ensureSeedPresent({ id, name });

      if (!seedResults.value.has(id) && !loadingSeeds.value.has(id)) {
        artistsToLoad.push(id);
      }
    }

    await Promise.all(artistsToLoad.map((artistId) => loadSeedSimilarArtists(artistId)));
  }

  /**
   * Remove a seed and its associated results.
   * @param {string} artistId - MBID of the seed to remove.
   */
  function removeSeed(artistId) {
    seeds.value = seeds.value.filter(a => a.id !== artistId);

    const next = new Map(seedResults.value);
    next.delete(artistId);
    seedResults.value = next;

    const nextLoading = new Set(loadingSeeds.value);
    nextLoading.delete(artistId);
    loadingSeeds.value = nextLoading;

    seedRequestVersions.delete(artistId);
  }

  /** Reset all graph state. */
  function clearSeeds() {
    seeds.value = [];
    seedResults.value = new Map();
    loadingSeeds.value = new Set();
    lastError.value = null;
    seedRequestVersions.clear();
  }

  return {
    seeds: readonly(seeds),
    suggestions,
    isAnySeedLoading,
    hasSuggestions,
    hasSeeds,
    lastError: readonly(lastError),
    isSeed,
    isSeedLoading,
    addSeed,
    hydrateSeeds,
    removeSeed,
    clearSeeds,
  };
}
