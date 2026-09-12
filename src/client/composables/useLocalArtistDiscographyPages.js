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
import { fetchOperatorArtistDiscography } from '../lib/metadata-api.js';

const emptyPage = () => ({ loaded: 0, total: null, hasMore: false, complete: false, source: 'local' });

/** Display rows only. Appending never changes the authoritative projection or draft. */
export function useLocalArtistDiscographyPages({ fetchPage = fetchOperatorArtistDiscography, limit = 25 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 25) throw new RangeError('Invalid local discography page limit.');
  const results = ref([]);
  const pagination = ref(emptyPage());
  const loading = ref(false);
  const error = ref(null);
  let active = null;
  let disposed = false;

  function reset() {
    const previous = active;
    active = null;
    previous?.unlink();
    previous?.controller.abort();
    results.value = [];
    pagination.value = emptyPage();
    loading.value = false;
    error.value = null;
  }

  const current = (context) => !disposed && active === context
    && !context.controller.signal.aborted && context.ownsView();

  async function read(context) {
    if (!current(context) || context.pending) return false;
    context.pending = true;
    loading.value = true;
    error.value = null;
    try {
      const payload = await fetchPage(context.artistId, {
        limit, cursor: context.cursor, signal: context.controller.signal,
      });
      if (!current(context)) return false;
      const rows = payload?.releaseGroups;
      const info = payload?.pageInfo;
      if (!Array.isArray(rows) || rows.length > limit || typeof info?.hasMore !== 'boolean'
        || (info.hasMore ? typeof info.nextCursor !== 'string' || !info.nextCursor
          || context.cursors.has(info.nextCursor) || rows.length === 0 : info.nextCursor !== null)) {
        throw new Error('Invalid local catalog page.');
      }
      const previous = context.first ? [] : results.value;
      const seen = new Set(previous.map((row) => row.id));
      for (const row of rows) {
        if (!row || typeof row.id !== 'string' || !row.id || row.artistId !== context.artistId || seen.has(row.id)) {
          throw new Error('Invalid local catalog identity.');
        }
        seen.add(row.id);
      }
      results.value = [...previous, ...rows];
      context.first = false;
      context.cursor = info.nextCursor ?? undefined;
      if (info.nextCursor) context.cursors.add(info.nextCursor);
      pagination.value = { ...emptyPage(), loaded: results.value.length, hasMore: info.hasMore };
      return true;
    } catch {
      if (current(context)) error.value = 'Could not load local releases. Please try again.';
      return false;
    } finally {
      context.pending = false;
      if (active === context) loading.value = false;
    }
  }

  function start(artistId, { signal, isCurrent: ownsView = () => true, seed = [] } = {}) {
    reset();
    if (disposed || !artistId || signal?.aborted || !ownsView()) return Promise.resolve(false);
    const context = { artistId, cursor: undefined, first: true, cursors: new Set(), pending: false,
      controller: new AbortController(), ownsView, unlink: () => signal?.removeEventListener('abort', onAbort) };
    function onAbort() { if (active === context) reset(); }
    active = context;
    signal?.addEventListener('abort', onAbort, { once: true });
    results.value = seed.slice(0, limit);
    pagination.value = { ...emptyPage(), loaded: results.value.length, hasMore: true };
    return read(context);
  }

  function loadMore() {
    return active && pagination.value.hasMore ? read(active) : Promise.resolve(false);
  }

  if (getCurrentScope()) onScopeDispose(() => { disposed = true; reset(); });
  return { start, reset, loadMore, results: readonly(results), pagination: readonly(pagination),
    loading: readonly(loading), error: readonly(error) };
}
