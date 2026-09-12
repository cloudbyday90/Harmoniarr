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

import { getCurrentScope, onScopeDispose, readonly, ref } from 'vue';
import { browseMusicBrainzArtistReleaseGroups } from '../lib/metadata-api.js';

const emptyPagination = () => ({ loaded: 0, total: null, hasMore: false, complete: false });
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

/** A per-view remote catalog cursor. Each explicit activation reads one bounded page. */
export function useArtistDiscographyPages({
  browseReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  limit = 25,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
    throw new RangeError('Discography page limit must be an integer between 1 and 25.');
  }
  const results = ref([]);
  const cache = ref(null);
  const pagination = ref(emptyPagination());
  const isLoadingMore = ref(false);
  const error = ref(null);
  let active = null;
  let disposed = false;

  function reset() {
    const previous = active;
    active = null;
    previous?.unlink();
    previous?.controller.abort();
    results.value = [];
    cache.value = null;
    pagination.value = emptyPagination();
    isLoadingMore.value = false;
    error.value = null;
  }

  function isCurrent(context) {
    return !disposed && active === context && !context.controller.signal.aborted && context.isCurrent();
  }

  async function readPage(context, first) {
    if (!isCurrent(context) || context.pending) return false;
    context.pending = true;
    isLoadingMore.value = !first;
    error.value = null;
    const offset = context.offset;
    try {
      const response = await browseReleaseGroups({
        artistId: context.mbid, limit, offset, signal: context.controller.signal,
      });
      if (!isCurrent(context)) return false;
      const page = response?.browse ?? response;
      if (!Array.isArray(page?.results)) throw new Error('Invalid discography page.');
      if (page.offset !== undefined && (!isCount(page.offset) || page.offset !== offset)) {
        throw new Error('Invalid discography page offset.');
      }
      const rows = page.results;
      if (rows.length > limit) throw new Error('Discography page exceeds the requested limit.');
      const seen = new Set(results.value.map((row) => row.id));
      const additions = rows.filter((row) => {
        if (!row || typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
      const total = isCount(page.total) ? page.total : pagination.value.total;
      const nextOffset = offset + rows.length;
      const reachedEnd = total !== null && nextOffset >= total;
      const complete = reachedEnd && results.value.length + additions.length >= total;
      const stalled = !reachedEnd && (rows.length === 0 || nextOffset <= offset);
      results.value = [...results.value, ...additions];
      cache.value = page.cache ?? cache.value;
      context.offset = nextOffset;
      pagination.value = {
        loaded: results.value.length,
        total,
        complete,
        hasMore: !reachedEnd && (total !== null || (!stalled && rows.length === limit)),
      };
      if (stalled && total !== null) error.value = 'The release catalog stopped before all releases were loaded.';
      if (reachedEnd && !complete) error.value = 'The release catalog changed while loading. Reload to check for missing releases.';
      return true;
    } catch (cause) {
      if (!isCurrent(context)) return false;
      error.value = 'Could not load releases. Please try again.';
      if (first) throw cause;
      return false;
    } finally {
      context.pending = false;
      if (active === context) isLoadingMore.value = false;
    }
  }

  async function start(mbid, { signal, isCurrent: ownsView = () => true } = {}) {
    reset();
    if (disposed || typeof mbid !== 'string' || !mbid.trim() || signal?.aborted || !ownsView()) return false;
    const context = {
      mbid, offset: 0, pending: false, controller: new AbortController(), isCurrent: ownsView,
      unlink: () => signal?.removeEventListener('abort', onAbort),
    };
    function onAbort() {
      if (active === context) reset();
    }
    active = context;
    signal?.addEventListener('abort', onAbort, { once: true });
    return readPage(context, true);
  }

  function loadMore() {
    if (!active || !pagination.value.hasMore) return Promise.resolve(false);
    return readPage(active, false);
  }

  if (getCurrentScope()) onScopeDispose(() => {
    disposed = true;
    reset();
  });

  return {
    start, loadMore, reset,
    results: readonly(results), cache: readonly(cache), pagination: readonly(pagination),
    isLoadingMore: readonly(isLoadingMore), error: readonly(error),
  };
}
