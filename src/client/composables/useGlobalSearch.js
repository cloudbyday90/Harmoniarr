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

import { computed, onScopeDispose, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { fetchGlobalSearch } from '../lib/search-api.js';
import { buildArtistDetailLocation } from '../lib/artist-detail-route.js';
import { getReleaseArtistName, getReleaseTitle } from '../lib/release-normalization.js';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 200;
const RESULT_LIMIT = 5;

function flatMap() {
  const items = [];
  let index = 0;

  return {
    addArtist(item) {
      items.push({ type: 'artist', item, flatIndex: index++ });
    },
    addReleaseGroup(item) {
      items.push({ type: 'releaseGroup', item, flatIndex: index++ });
    },
    addRelease(item) {
      items.push({ type: 'release', item, flatIndex: index++ });
    },
    build() {
      return { items, count: index };
    },
  };
}

export function useGlobalSearch({ router: injectedRouter } = {}) {
  const resolvedRouter = injectedRouter ?? useRouter();
  const query = ref('');
  const results = shallowRef({ artists: [], releaseGroups: [], releases: [] });
  const loading = ref(false);
  const errorMessage = ref('');
  const activeIndex = ref(-1);

  let abortController = null;
  let debounceTimer = null;

  function cancelPending() {
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
  }

  const flatResults = computed(() => {
    const builder = flatMap();
    for (const artist of results.value.artists) {
      builder.addArtist(artist);
    }
    for (const rg of results.value.releaseGroups) {
      builder.addReleaseGroup(rg);
    }
    for (const release of results.value.releases) {
      builder.addRelease(release);
    }
    return builder.build();
  });

  const hasAnyResults = computed(() => {
    return results.value.artists.length > 0
      || results.value.releaseGroups.length > 0
      || results.value.releases.length > 0;
  });

  const hasArtistResults = computed(() => results.value.artists.length > 0);
  const hasReleaseGroupResults = computed(() => results.value.releaseGroups.length > 0);
  const hasReleaseResults = computed(() => results.value.releases.length > 0);

  const totalResultCount = computed(() => flatResults.value.count);

  function reset() {
    cancelPending();
    clearTimeout(debounceTimer);
    results.value = { artists: [], releaseGroups: [], releases: [] };
    loading.value = false;
    errorMessage.value = '';
    activeIndex.value = -1;
  }

  function resetQuery() {
    query.value = '';
    reset();
  }

  async function search(q) {
    const trimmed = q.trim();
    if (trimmed.length < MIN_CHARS) {
      results.value = { artists: [], releaseGroups: [], releases: [] };
      errorMessage.value = '';
      loading.value = false;
      return;
    }

    cancelPending();
    abortController = new AbortController();
    const signal = abortController.signal;

    loading.value = true;
    errorMessage.value = '';
    activeIndex.value = -1;

    try {
      const payload = await fetchGlobalSearch({
        query: trimmed,
        artistLimit: RESULT_LIMIT,
        releaseGroupLimit: RESULT_LIMIT,
        releaseLimit: RESULT_LIMIT,
        signal,
      });

      results.value = {
        artists: payload?.artists ?? [],
        releaseGroups: payload?.releaseGroups ?? [],
        releases: payload?.releases ?? [],
      };
    } catch (err) {
      if (err.name === 'AbortError' || err?.code === 'request_aborted') {
        return;
      }
      errorMessage.value = err?.message ?? 'Search failed';
    } finally {
      if (abortController?.signal === signal) {
        loading.value = false;
        abortController = null;
      }
    }
  }

  function scheduleSearch(value) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => search(value), DEBOUNCE_MS);
  }

  function searchImmediate(value) {
    clearTimeout(debounceTimer);
    return search(value);
  }

  function handleKeydown(event) {
    const count = flatResults.value.count;
    if (count === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activeIndex.value = activeIndex.value < count - 1
        ? activeIndex.value + 1
        : 0;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      activeIndex.value = activeIndex.value > 0
        ? activeIndex.value - 1
        : count - 1;
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      activeIndex.value = Math.min(activeIndex.value + 5, count - 1);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      activeIndex.value = Math.max(activeIndex.value - 5, 0);
    } else if (event.key === 'Home') {
      event.preventDefault();
      activeIndex.value = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      activeIndex.value = count - 1;
    }
  }

  function selectActive() {
    if (activeIndex.value < 0 || activeIndex.value >= flatResults.value.count) {
      return null;
    }
    return flatResults.value.items[activeIndex.value];
  }

  function buildArtistNavigateLocation(artist) {
    const mbid = artist.source?.musicbrainzArtistId ?? String(artist.id);
    return buildArtistDetailLocation(mbid, artist.name);
  }

  async function navigateToResult(entry, { close } = {}) {
    if (typeof close === 'function') {
      close();
    }

    switch (entry.type) {
      case 'artist': {
        const artist = entry.item;
        const location = buildArtistNavigateLocation(artist);
        await resolvedRouter.push(location);
        break;
      }
      case 'releaseGroup': {
        const rg = entry.item;
        const location = buildArtistNavigateLocation({ id: rg.artistId, source: rg.source });
        await resolvedRouter.push(location);
        break;
      }
      case 'release': {
        const release = entry.item;
        await resolvedRouter.push({ name: 'search', query: { q: release.artistName ?? getReleaseArtistName(release) ?? getReleaseTitle(release) } });
        break;
      }
      default:
        break;
    }
  }

  function handleEnter({ close } = {}) {
    const entry = selectActive();
    if (!entry) return true;
    navigateToResult(entry, { close });
    return false;
  }

  onScopeDispose(() => {
    cancelPending();
    clearTimeout(debounceTimer);
  });

  return {
    activeIndex,
    buildArtistNavigateLocation,
    errorMessage,
    flatResults,
    handleEnter,
    handleKeydown,
    hasAnyResults,
    hasArtistResults,
    hasReleaseGroupResults,
    hasReleaseResults,
    loading,
    navigateToResult,
    query,
    resetQuery,
    results,
    scheduleSearch,
    searchImmediate,
    selectActive,
    totalResultCount,
  };
}
