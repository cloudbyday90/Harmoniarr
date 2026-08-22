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

import { readonly, ref } from 'vue';
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { fetchSimilarArtists } from '../lib/metadata-api.js';

function canApplyResult({ isCurrent, requestId, latestRequestId }) {
  return isCurrent() && requestId === latestRequestId();
}

/**
 * Owns the non-critical related-artist enhancement for Artist Detail.
 *
 * The parent composable starts this work alongside its critical artist and
 * discography read, but deliberately does not await it. A local request token
 * prevents a late response from a previous artist route from replacing the
 * current artist's recommendations.
 */
export function useArtistDetailRelatedArtists({
  fetchSimilar = fetchSimilarArtists,
  similarLimit = 8,
} = {}) {
  const relatedArtists = ref([]);
  const relatedArtistsCache = ref(null);
  const relatedError = ref(null);
  const isLoadingRelatedArtists = ref(false);
  let latestRequestId = 0;

  function invalidateRelatedArtists() {
    latestRequestId += 1;
    relatedArtists.value = [];
    relatedArtistsCache.value = null;
    relatedError.value = null;
    isLoadingRelatedArtists.value = false;
  }

  async function loadRelatedArtists(mbid, {
    isCurrent = () => true,
    signal,
  } = {}) {
    const requestId = ++latestRequestId;
    relatedArtists.value = [];
    relatedArtistsCache.value = null;
    relatedError.value = null;

    if (!mbid) {
      isLoadingRelatedArtists.value = false;
      return false;
    }

    isLoadingRelatedArtists.value = true;
    const canApply = () => canApplyResult({
      isCurrent,
      latestRequestId: () => latestRequestId,
      requestId,
    });

    try {
      const payload = await fetchSimilar(mbid, { limit: similarLimit, signal });
      if (!canApply()) {
        return false;
      }

      relatedArtists.value = Array.isArray(payload?.similar)
        ? payload.similar.slice(0, similarLimit)
        : [];
      relatedArtistsCache.value = payload?.cache ?? null;
      return true;
    } catch (error) {
      if (!canApply() || isAbortError(error)) {
        return false;
      }

      relatedArtists.value = [];
      relatedError.value = getErrorMessage(
        error,
        'Could not load related artists.',
      );
      return false;
    } finally {
      if (canApply()) {
        isLoadingRelatedArtists.value = false;
      }
    }
  }

  return {
    invalidateRelatedArtists,
    isLoadingRelatedArtists: readonly(isLoadingRelatedArtists),
    loadRelatedArtists,
    relatedArtists: readonly(relatedArtists),
    relatedArtistsCache: readonly(relatedArtistsCache),
    relatedError: readonly(relatedError),
  };
}
