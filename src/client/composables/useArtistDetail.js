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
  fetchOperatorArtistProjection,
  fetchSimilarArtists,
  resolveMusicBrainzArtistLocal,
} from '../lib/metadata-api.js';

/**
 * Composable for the artist detail page.
 *
 * Loads three data sources in parallel for a given MusicBrainz artist MBID:
 *
 * 1. Local metadata (resolveMusicBrainzArtistLocal): artist object, monitoring
 *    state. A 404 is treated as "not imported yet" and falls back to
 *    MusicBrainz browse data.
 * 2. Operator projection (fetchOperatorArtistProjection): canonical policy,
 *    selection, override, and local release-group state for imported artists.
 * 3. MusicBrainz release-group browse: fallback raw discography.
 * 4. Similar artists (fetchSimilarArtists): related artist strip data.
 *
 * Exposes cache setters so parent views can update monitoring or the operator
 * projection after successful mutations without triggering a full reload.
 *
 * All returned refs are readonly to prevent accidental external mutation.
 *
 * @param {object} [options]
 * @param {function} [options.resolveLocal] - Override for testing.
 * @param {function} [options.fetchOperatorProjection] - Override for testing.
 * @param {function} [options.browseReleaseGroups] - Override for testing.
 * @param {function} [options.fetchSimilar] - Override for testing.
 * @param {number} [options.releaseGroupLimit=100] - Max release groups to load.
 * @param {number} [options.similarLimit=8] - Max related artists to show.
 */
export function useArtistDetail({
  resolveLocal = resolveMusicBrainzArtistLocal,
  fetchOperatorProjection = fetchOperatorArtistProjection,
  browseReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  fetchSimilar = fetchSimilarArtists,
  releaseGroupLimit = 100,
  similarLimit = 8,
} = {}) {
  const artist = ref(null);
  const operator = ref(null);
  const projection = ref(null);
  const monitoring = ref(null);
  const releaseGroups = ref([]);
  const relatedArtists = ref([]);
  const isLoading = ref(false);
  const artistError = ref(null);
  const discographyError = ref(null);
  const relatedError = ref(null);

  /** True when the operator projection or legacy metadata indicates the artist is monitored. */
  const isMonitored = computed(() =>
    operator.value?.monitoring?.isMonitored === true || monitoring.value?.monitored === true,
  );

  /**
   * Loads all artist detail data for the given MBID.
   *
   * Local artist and related-artist fetches run concurrently. The operator
   * projection is preferred for imported artists; MusicBrainz browse remains
   * the fallback discography source when no operator projection is available.
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

    try {
      const [localResult, similarResult] = await Promise.allSettled([
        resolveLocal(mbid, { signal }),
        fetchSimilar(mbid, { limit: similarLimit, signal }),
      ]);

      let shouldBrowseDiscography = true;

      // Local artist — 404 is not an error (artist not yet imported).
      if (localResult.status === 'fulfilled') {
        artist.value = localResult.value?.artist ?? null;
        monitoring.value = localResult.value?.monitoring ?? null;
        const localArtistId = localResult.value?.artist?.id ?? null;

        if (localArtistId) {
          try {
            const operatorPayload = await fetchOperatorProjection(localArtistId, { signal });
            projection.value = operatorPayload;
            operator.value = operatorPayload?.operator ?? null;
            artist.value = operatorPayload?.artist ?? artist.value;
            monitoring.value = operatorPayload?.operator?.monitoring ?? monitoring.value;
            releaseGroups.value = Array.isArray(operatorPayload?.releaseGroups)
              ? operatorPayload.releaseGroups
              : [];
            shouldBrowseDiscography = false;
          } catch (error) {
            if (error?.status !== 404) {
              artistError.value = getErrorMessage(
                error,
                'Could not load operator artist policy.',
              );
            }
            projection.value = null;
            operator.value = null;
          }
        }
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

      if (shouldBrowseDiscography) {
        try {
          const discographyResult = await browseReleaseGroups({
            artistId: mbid,
            limit: releaseGroupLimit,
            signal,
          });
          releaseGroups.value = Array.isArray(discographyResult?.results)
            ? discographyResult.results
            : [];
        } catch (error) {
          discographyError.value = getErrorMessage(
            error,
            'Could not load discography.',
          );
          releaseGroups.value = [];
        }
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
    } catch (error) {
      artistError.value = getErrorMessage(error, 'Could not load artist detail.');
      releaseGroups.value = [];
      relatedError.value = getErrorMessage(
        error,
        'Could not load related artists.',
      );
      relatedArtists.value = [];
    } finally {
      isLoading.value = false;
    }
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

  function setOperatorProjection(nextProjection) {
    projection.value = nextProjection ?? null;
    operator.value = nextProjection?.operator ?? null;
    artist.value = nextProjection?.artist ?? artist.value;
    monitoring.value = nextProjection?.operator?.monitoring ?? monitoring.value;
    releaseGroups.value = Array.isArray(nextProjection?.releaseGroups)
      ? nextProjection.releaseGroups
      : releaseGroups.value;
  }

  return {
    artist: readonly(artist),
    operator: readonly(operator),
    projection: readonly(projection),
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
    setOperatorProjection,
  };
}
