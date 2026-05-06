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
import {
  browseMusicBrainzArtistReleaseGroups,
  fetchSimilarArtists,
  resolveMusicBrainzArtistLocal,
} from '../lib/metadata-api.js';

/**
 * Composable for the artist detail page.
 *
 * Loads three data sources in parallel for a given MusicBrainz artist MBID:
 *
 * 1. Local metadata (resolveMusicBrainzArtistLocal): artist object, monitoring
 *    state. A 404 is treated as "not imported yet" and surfaces as `null`
 *    artist, not as an error.
 * 2. MusicBrainz release-group browse: raw discography for the artist.
 * 3. Similar artists (fetchSimilarArtists): related artist strip data.
 *
 * Exposes `setMonitoring(patch)` so the parent view can update cached
 * monitoring state after a successful monitor/unmonitor action without
 * triggering a full reload.
 *
 * All returned refs are readonly to prevent accidental external mutation.
 *
 * @param {object} [options]
 * @param {function} [options.resolveLocal] - Override for testing.
 * @param {function} [options.browseReleaseGroups] - Override for testing.
 * @param {function} [options.fetchSimilar] - Override for testing.
 * @param {number} [options.releaseGroupLimit=100] - Max release groups to load.
 * @param {number} [options.similarLimit=8] - Max related artists to show.
 */
export function useArtistDetail({
  resolveLocal = resolveMusicBrainzArtistLocal,
  browseReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  fetchSimilar = fetchSimilarArtists,
  releaseGroupLimit = 100,
  similarLimit = 8,
} = {}) {
  const artist = ref(null);
  const monitoring = ref(null);
  const releaseGroups = ref([]);
  const relatedArtists = ref([]);
  const isLoading = ref(false);
  const artistError = ref(null);
  const discographyError = ref(null);
  const relatedError = ref(null);

  /** True when the local metadata indicates the artist is monitored. */
  const isMonitored = computed(() => monitoring.value?.monitored === true);

  /**
   * Loads all artist detail data for the given MBID.
   *
   * All three fetches run concurrently via Promise.allSettled so that a
   * failure in one does not block the others.
   *
   * @param {string} mbid - MusicBrainz artist MBID.
   * @param {{ signal?: AbortSignal }} [opts]
   */
  async function loadArtistDetail(mbid, { signal } = {}) {
    if (!mbid) return;

    isLoading.value = true;
    artistError.value = null;
    discographyError.value = null;
    relatedError.value = null;

    const [localResult, discographyResult, similarResult] = await Promise.allSettled([
      resolveLocal(mbid, { signal }),
      browseReleaseGroups({ artistId: mbid, limit: releaseGroupLimit, signal }),
      fetchSimilar(mbid, { limit: similarLimit, signal }),
    ]);

    // Local artist — 404 is not an error (artist not yet imported).
    if (localResult.status === 'fulfilled') {
      artist.value = localResult.value?.artist ?? null;
      monitoring.value = localResult.value?.monitoring ?? null;
    } else {
      if (localResult.reason?.status !== 404) {
        artistError.value = getErrorMessage(
          localResult.reason,
          'Could not load artist data.',
        );
      }
      artist.value = null;
      monitoring.value = null;
    }

    // Discography.
    if (discographyResult.status === 'fulfilled') {
      releaseGroups.value = Array.isArray(discographyResult.value?.results)
        ? discographyResult.value.results
        : [];
    } else {
      discographyError.value = getErrorMessage(
        discographyResult.reason,
        'Could not load discography.',
      );
      releaseGroups.value = [];
    }

    // Related artists.
    if (similarResult.status === 'fulfilled') {
      relatedArtists.value = Array.isArray(similarResult.value?.similar)
        ? similarResult.value.similar.slice(0, similarLimit)
        : [];
    } else {
      relatedError.value = getErrorMessage(
        similarResult.reason,
        'Could not load related artists.',
      );
      relatedArtists.value = [];
    }

    isLoading.value = false;
  }

  /**
   * Updates the cached monitoring state after a successful monitor/unmonitor
   * action performed by the parent view, avoiding a full reload.
   *
   * @param {{ monitored: boolean }} monitoringPatch
   */
  function setMonitoring(monitoringPatch) {
    monitoring.value = monitoringPatch;
  }

  return {
    artist: readonly(artist),
    monitoring: readonly(monitoring),
    releaseGroups: readonly(releaseGroups),
    relatedArtists: readonly(relatedArtists),
    isLoading: readonly(isLoading),
    isMonitored,
    artistError: readonly(artistError),
    discographyError: readonly(discographyError),
    relatedError: readonly(relatedError),
    loadArtistDetail,
    setMonitoring,
  };
}
