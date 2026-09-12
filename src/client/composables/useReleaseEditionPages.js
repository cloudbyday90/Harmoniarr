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

import { computed, getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { fetchMusicBrainzReleaseGroupReleases } from '../lib/metadata-api.js';

const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const mbidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Dialog-owned edition inventory; provider offsets count raw rows, not unique editions. */
export function useReleaseEditionPages({ fetchEditions = fetchMusicBrainzReleaseGroupReleases } = {}) {
  const results = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const hasMore = ref(false);
  let group = null;
  let offset = 0;
  let controller = null;
  let generation = 0;
  let disposed = false;

  function pause() {
    generation += 1;
    controller?.abort();
    controller = null;
    loading.value = false;
  }

  function reset() {
    pause();
    group = null;
    offset = 0;
    results.value = [];
    error.value = null;
    hasMore.value = false;
  }

  function merge(rows) {
    if (disposed) return;
    const merged = [...results.value];
    for (const row of rows) {
      const index = merged.findIndex((existing) =>
        (row.musicbrainzReleaseId && existing.musicbrainzReleaseId === row.musicbrainzReleaseId)
        || (row.id && existing.id === row.id));
      if (index < 0) merged.push(row);
      else merged[index] = row.id ? row : { ...row, ...merged[index] };
    }
    results.value = merged;
  }

  function validate(page, expectedOffset) {
    if (page?.releaseGroupId !== group || page.limit !== 25
      || page.offset !== expectedOffset || !isCount(page.total)
      || !Array.isArray(page.results) || page.results.length > 25
      || !page.results.every((row) => mbidPattern.test(row?.musicbrainzReleaseId ?? ''))
      || (page.results.length === 0 && expectedOffset < page.total)) {
      throw new Error('Invalid edition page.');
    }
    return expectedOffset + page.results.length;
  }

  function accept(releaseGroupMbid, rows, page = null) {
    if (disposed) return;
    if (group === releaseGroupMbid) {
      merge(rows);
      return;
    }
    reset();
    group = releaseGroupMbid;
    merge(rows);
    hasMore.value = true;
    if (page) {
      try {
        offset = validate({ ...page, results: rows }, 0);
        hasMore.value = offset < page.total;
      } catch {
        // Preserve usable editions; an explicit activation retries from offset zero.
        error.value = 'Could not load more editions. Please try again.';
      }
    }
  }

  async function loadMore() {
    if (disposed || !group || loading.value || !hasMore.value) return false;
    const token = generation;
    const requestedOffset = offset;
    controller = new AbortController();
    const { signal } = controller;
    loading.value = true;
    error.value = null;
    try {
      const response = await fetchEditions(group, { limit: 25, offset: requestedOffset, signal });
      if (generation !== token || signal.aborted) return false;
      const page = response?.releases ?? response;
      const nextOffset = validate(page, requestedOffset);
      merge(page.results);
      offset = nextOffset;
      hasMore.value = offset < page.total;
      return true;
    } catch {
      if (generation === token && !signal.aborted) error.value = 'Could not load more editions. Please try again.';
      return false;
    } finally {
      if (generation === token) {
        loading.value = false;
        controller = null;
      }
    }
  }

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    reset();
  });
  return {
    accept, merge, pause, reset, loadMore,
    results: readonly(results), loading: readonly(loading), error: readonly(error),
    hasMore: readonly(hasMore), loadedCount: computed(() => results.value.length),
  };
}
