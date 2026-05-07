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
import { fetchReleaseGroupTracklist, markReleaseCanonical } from '../lib/metadata-api.js';
import { getErrorMessage } from '../lib/error-utils.js';

/**
 * Data composable for the release detail modal.
 *
 * Loads release details via a single tracklist endpoint call. Supports edition
 * switching and admin-only "set as default" canonical override.
 *
 * @param {object} [options]
 * @param {function} [options.fetchTracklist] - Override for testing.
 * @param {function} [options.setCanonical] - Override for testing.
 */
export function useReleaseDetail({
  fetchTracklist = fetchReleaseGroupTracklist,
  setCanonical = markReleaseCanonical,
} = {}) {
  const release = ref(null);
  const media = ref([]);
  const ownership = ref(null);
  const allReleases = ref([]);
  const requestState = ref(null);
  const source = ref(null);
  const loading = ref(false);
  const error = ref(null);
  const canonicalError = ref(null);
  const isSavingCanonical = ref(false);

  let abortController = null;

  async function load(releaseGroupMbid, { preferReleaseMbid = null, preferReleaseId = null } = {}) {
    if (!releaseGroupMbid) return;

    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();
    const { signal } = abortController;

    loading.value = true;
    error.value = null;

    try {
      const data = await fetchTracklist(releaseGroupMbid, {
        preferReleaseMbid,
        preferReleaseId,
        signal,
      });

      release.value = data.release ?? null;
      media.value = Array.isArray(data.media) ? data.media : [];
      ownership.value = data.ownership ?? null;
      allReleases.value = Array.isArray(data.allReleases) ? data.allReleases : [];
      requestState.value = data.requestState ?? null;
      source.value = data.source ?? null;
    } catch (err) {
      if (err?.name === 'AbortError') return;
      error.value = getErrorMessage(err, 'Could not load release details.');
    } finally {
      loading.value = false;
    }
  }

  function switchEdition(releaseGroupMbid, releaseId) {
    return load(releaseGroupMbid, { preferReleaseId: releaseId });
  }

  async function setDefaultEdition(releaseGroupMbid, releaseId) {
    if (!releaseId) return;
    canonicalError.value = null;
    isSavingCanonical.value = true;
    try {
      await setCanonical(releaseId);
      // Reload with the newly-canonical release selected.
      await load(releaseGroupMbid, { preferReleaseId: releaseId });
    } catch (err) {
      canonicalError.value = getErrorMessage(err, 'Could not update default edition.');
    } finally {
      isSavingCanonical.value = false;
    }
  }

  return {
    release: readonly(release),
    media: readonly(media),
    ownership: readonly(ownership),
    allReleases: readonly(allReleases),
    requestState: readonly(requestState),
    source: readonly(source),
    loading: readonly(loading),
    error: readonly(error),
    canonicalError: readonly(canonicalError),
    isSavingCanonical: readonly(isSavingCanonical),
    load,
    switchEdition,
    setDefaultEdition,
  };
}
