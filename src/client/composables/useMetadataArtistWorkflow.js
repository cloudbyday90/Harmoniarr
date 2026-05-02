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

import { ref } from 'vue';
import { isAbortError } from '../lib/abort-error.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { createLatestRequestGate } from '../lib/latest-request-gate.js';
import {
  browseMusicBrainzArtistReleaseGroups,
  fetchMetadataArtist,
  fetchMetadataArtistDetectionEvents as defaultFetchMetadataArtistDetectionEvents,
  importMusicBrainzArtist,
  resolveMusicBrainzArtistLocal,
  searchMusicBrainzArtists,
  startMetadataArtistRefresh as defaultStartMetadataArtistRefresh,
  updateMetadataArtistMonitoring as defaultUpdateMetadataArtistMonitoring,
} from '../lib/metadata-api.js';
import { useMetadataLocalSearchWorkflow } from './useMetadataLocalSearchWorkflow.js';
import { useMetadataReleaseWorkflow } from './useMetadataReleaseWorkflow.js';

export function useMetadataArtistWorkflow({
  browseArtistReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  fetchArtist = fetchMetadataArtist,
  fetchArtistDetectionEvents = defaultFetchMetadataArtistDetectionEvents,
  importArtistById = importMusicBrainzArtist,
  resolveArtistLocal = resolveMusicBrainzArtistLocal,
  searchArtists = searchMusicBrainzArtists,
  startMetadataArtistRefreshRequest = defaultStartMetadataArtistRefresh,
  updateArtistMonitoringRequest = defaultUpdateMetadataArtistMonitoring,
  createLocalSearchWorkflow = useMetadataLocalSearchWorkflow,
  createReleaseWorkflow = useMetadataReleaseWorkflow,
} = {}) {
  const searchQuery = ref('');
  const searchResults = ref([]);
  const selectedArtist = ref(null);
  const localArtist = ref(null);
  const providerReleaseGroups = ref([]);
  const detectionEventsPageInfo = ref({ hasMore: false, nextCursor: null });
  const searchError = ref('');
  const artistActionError = ref('');
  const detectionEventsErrorMessage = ref('');
  const queuedRefreshRun = ref(null);
  const isSearching = ref(false);
  const isImportingArtist = ref(false);
  const isLoadingArtist = ref(false);
  const isLoadingMoreDetectionEvents = ref(false);
  const isRefreshingArtist = ref(false);
  const isUpdatingArtistMonitoring = ref(false);
  const artistWorkspaceRequestGate = createLatestRequestGate();

  const localSearchWorkflow = createLocalSearchWorkflow();

  async function refreshArtistWorkspace(artist, request = artistWorkspaceRequestGate.begin()) {
    const [localPayload, browsePayload] = await Promise.all([
      resolveArtistLocal(artist.id, { signal: request.signal }),
      browseArtistReleaseGroups({
        artistId: artist.id,
        limit: 12,
        releaseGroupStatus: 'website-default',
        signal: request.signal,
      }),
    ]);

    if (!request.isCurrent()) {
      return false;
    }

    localArtist.value = localPayload;
    detectionEventsPageInfo.value = localPayload.detectionEventsPageInfo ?? {
      hasMore: false,
      nextCursor: null,
    };
    providerReleaseGroups.value = browsePayload.browse?.results ?? [];
    return true;
  }

  const releaseWorkflow = createReleaseWorkflow({
    selectedArtist,
    refreshArtistWorkspace: (artist) => refreshArtistWorkspace(artist),
  });

  async function runArtistSearch() {
    const query = searchQuery.value.trim();
    searchError.value = '';
    artistActionError.value = '';

    if (!query) {
      searchResults.value = [];
      return;
    }

    isSearching.value = true;
    try {
      const payload = await searchArtists({ query, limit: 8 });
      searchResults.value = payload.search?.results ?? [];
    } catch (error) {
      searchResults.value = [];
      searchError.value = getErrorMessage(error, 'Artist search failed');
    } finally {
      isSearching.value = false;
    }
  }

  async function loadArtistWorkspace(artist, { resetSelection = true } = {}) {
    const request = artistWorkspaceRequestGate.begin();
    selectedArtist.value = artist;
    artistActionError.value = '';
    queuedRefreshRun.value = null;
    if (resetSelection) {
      releaseWorkflow.resetReleaseSelection();
    }
    isLoadingArtist.value = true;

    try {
      await refreshArtistWorkspace(artist, request);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        localArtist.value = null;
        providerReleaseGroups.value = [];
        artistActionError.value = getErrorMessage(error, 'Loading imported artist failed');
      }
    } finally {
      if (request.isCurrent()) {
        isLoadingArtist.value = false;
      }
    }
  }

  async function importArtist(artist) {
    const request = artistWorkspaceRequestGate.begin();
    selectedArtist.value = artist;
    artistActionError.value = '';
    queuedRefreshRun.value = null;
    releaseWorkflow.resetReleaseSelection();
    isImportingArtist.value = true;

    try {
      await importArtistById(artist.id);
      if (!request.isCurrent()) {
        return;
      }

      await refreshArtistWorkspace(artist, request);
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        artistActionError.value = getErrorMessage(error, 'Artist import failed');
      }
    } finally {
      if (request.isCurrent()) {
        isImportingArtist.value = false;
      }
    }
  }

  async function openLocalArtist(artist) {
    const request = artistWorkspaceRequestGate.begin();
    const initialMusicBrainzArtistId = artist.source?.musicbrainzArtistId ?? null;

    selectedArtist.value = initialMusicBrainzArtistId
      ? { id: initialMusicBrainzArtistId, name: artist.name }
      : null;
    artistActionError.value = '';
    detectionEventsErrorMessage.value = '';
    queuedRefreshRun.value = null;
    releaseWorkflow.resetReleaseSelection();
    isLoadingArtist.value = true;

    try {
      const localPayload = await fetchArtist(artist.id, { signal: request.signal });
      if (!request.isCurrent()) {
        return;
      }

      const musicBrainzArtistId = initialMusicBrainzArtistId
        ?? localPayload.artist?.source?.musicbrainzArtistId
        ?? null;
      const [providerBrowseResult] = musicBrainzArtistId
        ? await Promise.allSettled([
            browseArtistReleaseGroups({
              artistId: musicBrainzArtistId,
              limit: 12,
              releaseGroupStatus: 'website-default',
              signal: request.signal,
            }),
          ])
        : [{ status: 'fulfilled', value: { browse: { results: [] } } }];

      if (!request.isCurrent()) {
        return;
      }

      localArtist.value = localPayload;
      detectionEventsPageInfo.value = localPayload.detectionEventsPageInfo ?? {
        hasMore: false,
        nextCursor: null,
      };
      selectedArtist.value = musicBrainzArtistId
        ? { id: musicBrainzArtistId, name: localPayload.artist?.name ?? artist.name }
        : null;
      providerReleaseGroups.value = providerBrowseResult.status === 'fulfilled'
        ? (providerBrowseResult.value.browse?.results ?? [])
        : [];

      if (providerBrowseResult.status !== 'fulfilled') {
        artistActionError.value = getErrorMessage(
          providerBrowseResult.reason,
          'Local artist opened, but provider release groups could not be loaded',
        );
      }
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        localArtist.value = null;
        detectionEventsPageInfo.value = { hasMore: false, nextCursor: null };
        providerReleaseGroups.value = [];
        artistActionError.value = getErrorMessage(error, 'Opening local artist failed');
      }
    } finally {
      if (request.isCurrent()) {
        isLoadingArtist.value = false;
      }
    }
  }

  async function loadMoreDetectionEvents() {
    if (!localArtist.value?.artist?.id || !detectionEventsPageInfo.value?.hasMore || isLoadingMoreDetectionEvents.value) {
      return;
    }

    isLoadingMoreDetectionEvents.value = true;
    detectionEventsErrorMessage.value = '';

    try {
      const result = await fetchArtistDetectionEvents(localArtist.value.artist.id, {
        before: detectionEventsPageInfo.value.nextCursor,
      });

      localArtist.value = {
        ...localArtist.value,
        detectionEvents: [
          ...(localArtist.value.detectionEvents ?? []),
          ...(result.detectionEvents ?? []),
        ],
      };
      detectionEventsPageInfo.value = result.pageInfo ?? {
        hasMore: false,
        nextCursor: null,
      };
    } catch (error) {
      detectionEventsErrorMessage.value = getErrorMessage(error, 'Loading more detection history failed');
    } finally {
      isLoadingMoreDetectionEvents.value = false;
    }
  }

  async function updateArtistMonitoring(patch) {
    if (!localArtist.value?.artist?.id) {
      return;
    }

    artistActionError.value = '';
    isUpdatingArtistMonitoring.value = true;

    try {
      const updated = await updateArtistMonitoringRequest(localArtist.value.artist.id, patch);
      localArtist.value = {
        ...localArtist.value,
        monitoring: updated.monitoring,
      };
    } catch (error) {
      artistActionError.value = getErrorMessage(error, 'Updating artist monitoring failed');
    } finally {
      isUpdatingArtistMonitoring.value = false;
    }
  }

  async function refreshArtistMetadata() {
    if (!localArtist.value?.artist?.id) {
      return null;
    }

    artistActionError.value = '';
    isRefreshingArtist.value = true;

    try {
      const result = await startMetadataArtistRefreshRequest(localArtist.value.artist.id);
      queuedRefreshRun.value = result.run ?? null;
      return result.run ?? null;
    } catch (error) {
      artistActionError.value = getErrorMessage(error, 'Starting metadata refresh failed');
      return null;
    } finally {
      isRefreshingArtist.value = false;
    }
  }

  return {
    artistActionError,
    detectionEventsErrorMessage,
    detectionEventsPageInfo,
    importArtist,
    isImportingArtist,
    isLoadingArtist,
    isLoadingMoreDetectionEvents,
    isRefreshingArtist,
    isSearching,
    isUpdatingArtistMonitoring,
    localArtist,
    loadMoreDetectionEvents,
    openLocalArtist,
    providerReleaseGroups,
    queuedRefreshRun,
    refreshArtistMetadata,
    runArtistSearch,
    searchError,
    searchQuery,
    searchResults,
    selectedArtist,
    updateArtistMonitoring,
    ...localSearchWorkflow,
    ...releaseWorkflow,
  };
}