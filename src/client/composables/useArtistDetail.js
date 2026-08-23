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
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';
import {
  browseMusicBrainzArtistReleaseGroups,
  fetchOperatorArtistProjection,
  resolveMusicBrainzArtistLocal,
} from '../lib/metadata-api.js';
import { useArtistDetailRelatedArtists } from './useArtistDetailRelatedArtists.js';

/**
 * Composable for the artist detail page.
 *
 * Coordinates the critical artist/discography path and a separate
 * non-critical related-artists enhancement for a given MusicBrainz artist
 * MBID:
 *
 * 1. Local metadata (resolveMusicBrainzArtistLocal): artist object, monitoring
 *    state. A 404 is treated as "not imported yet" and falls back to
 *    MusicBrainz browse data.
 * 2. Operator projection (fetchOperatorArtistProjection): canonical policy,
 *    selection, override, and local release-group state for imported artists.
 * 3. MusicBrainz release-group browse: fallback raw discography.
 * 4. Related artists: a non-critical enhancement which begins after the
 *    critical path settles, so it cannot pre-empt a provider-backed
 *    Discography request in the shared server-side client queue.
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
  fetchSimilar,
  releaseGroupLimit = 100,
  similarLimit = 8,
} = {}) {
  const artist = ref(null);
  const operator = ref(null);
  const projection = ref(null);
  const monitoring = ref(null);
  const releaseGroups = ref([]);
  const discographyCache = ref(null);
  const isLoading = ref(false);
  const artistError = ref(null);
  const discographyError = ref(null);
  const artistDetailRequestGate = createLatestRequestGate();
  const {
    invalidateRelatedArtists,
    isLoadingRelatedArtists,
    loadRelatedArtists,
    relatedArtists,
    relatedArtistsCache,
    relatedError,
  } = useArtistDetailRelatedArtists({ fetchSimilar, similarLimit });

  /** True when the operator projection or legacy metadata indicates the artist is monitored. */
  const isMonitored = computed(() =>
    operator.value?.monitoring?.isMonitored === true || monitoring.value?.monitored === true,
  );

  /**
   * Loads all artist detail data for the given MBID.
   *
   * The related-artist enhancement starts concurrently but is intentionally
   * not awaited. The operator projection is preferred for imported artists;
   * MusicBrainz browse remains the fallback when the projection has no release
   * groups because an empty local catalog is not proof of a complete empty
   * discography.
   *
   * @param {string} mbid - MusicBrainz artist MBID.
   * @param {{ signal?: AbortSignal }} [opts]
   */
  async function loadArtistDetail(mbid, { signal } = {}) {
    if (!mbid) {
      artistDetailRequestGate.invalidate();
      invalidateRelatedArtists();
      return;
    }

    const request = artistDetailRequestGate.begin();
    const requestSignal = signal ?? request.signal;

    isLoading.value = true;
    artistError.value = null;
    discographyError.value = null;
    artist.value = null;
    monitoring.value = null;
    operator.value = null;
    projection.value = null;
    releaseGroups.value = [];
    discographyCache.value = null;
    let localPayload = null;
    try {
      localPayload = await resolveLocal(mbid, { signal: requestSignal });
    } catch (error) {
      if (!request.isCurrent() || isAbortError(error)) {
        if (request.isCurrent()) {
          isLoading.value = false;
        }
        return;
      }

      if (error?.status !== 404) {
        artistError.value = getErrorMessage(error, 'Could not load artist data.');
      }
      artist.value = null;
      monitoring.value = null;
    }

    try {
      if (!request.isCurrent()) {
        return;
      }

      let shouldBrowseDiscography = true;
      const localArtist = localPayload?.artist ?? null;
      if (localArtist) {
        artist.value = localArtist;
        monitoring.value = localPayload?.monitoring ?? null;
        const localArtistId = localArtist.id ?? null;

        if (localArtistId) {
          try {
            const operatorPayload = await fetchOperatorProjection(localArtistId, { signal: requestSignal });
            if (!request.isCurrent()) {
              return;
            }

            const projectedReleaseGroups = Array.isArray(operatorPayload?.releaseGroups)
              ? operatorPayload.releaseGroups
              : [];
            projection.value = operatorPayload;
            operator.value = operatorPayload?.operator ?? null;
            artist.value = operatorPayload?.artist ?? artist.value;
            monitoring.value = operatorPayload?.operator?.monitoring ?? monitoring.value;
            releaseGroups.value = projectedReleaseGroups;
            shouldBrowseDiscography = projectedReleaseGroups.length === 0;
          } catch (error) {
            if (!request.isCurrent() || isAbortError(error)) {
              return;
            }

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
      }

      if (!request.isCurrent() || !shouldBrowseDiscography) {
        return;
      }

      try {
        const discographyResult = await browseReleaseGroups({
          artistId: mbid,
          limit: releaseGroupLimit,
          signal: requestSignal,
        });
        if (!request.isCurrent()) {
          return;
        }

        const browsePayload = discographyResult?.browse ?? discographyResult;
        releaseGroups.value = Array.isArray(browsePayload?.results)
          ? browsePayload.results
          : [];
        discographyCache.value = browsePayload?.cache ?? null;
      } catch (error) {
        if (!request.isCurrent() || isAbortError(error)) {
          return;
        }

        discographyError.value = getErrorMessage(
          error,
          'Could not load discography.',
        );
        releaseGroups.value = [];
      }
    } finally {
      if (request.isCurrent() && !requestSignal?.aborted) {
        isLoading.value = false;
        // Related artists are intentionally lower priority than the critical
        // local/projection/discography path. Starting this expensive provider
        // fanout afterwards avoids consuming the shared MusicBrainz request
        // queue and response budget before Discography has a chance to read
        // its SWR cache or complete a cold fill.
        void loadRelatedArtists(mbid, {
          isCurrent: request.isCurrent,
          signal: requestSignal,
        });
      }
    }
  }

  function cancelArtistDetailLoad() {
    artistDetailRequestGate.invalidate();
    invalidateRelatedArtists();
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
    discographyCache: readonly(discographyCache),
    relatedArtists: readonly(relatedArtists),
    relatedArtistsCache,
    isLoading: readonly(isLoading),
    isLoadingRelatedArtists,
    isMonitored,
    artistError: readonly(artistError),
    discographyError: readonly(discographyError),
    relatedError: readonly(relatedError),
    loadArtistDetail,
    cancelArtistDetailLoad,
    setMonitoring,
    setOperatorProjection,
  };
}
