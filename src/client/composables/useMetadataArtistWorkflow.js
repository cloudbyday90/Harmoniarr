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
} from '../lib/metadata-api.js';
import { useMetadataLocalSearchWorkflow } from './useMetadataLocalSearchWorkflow.js';
import { useMetadataReleaseWorkflow } from './useMetadataReleaseWorkflow.js';
import { useMetadataDetectionHistory } from './useMetadataDetectionHistory.js';

export function useMetadataArtistWorkflow({
  canManageMetadata = () => false,
  browseArtistReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  fetchArtist = fetchMetadataArtist,
  fetchArtistDetectionEvents = defaultFetchMetadataArtistDetectionEvents,
  importArtistById = importMusicBrainzArtist,
  resolveArtistLocal = resolveMusicBrainzArtistLocal,
  searchArtists = searchMusicBrainzArtists,
  startMetadataArtistRefreshRequest = defaultStartMetadataArtistRefresh,
  createLocalSearchWorkflow = useMetadataLocalSearchWorkflow,
  createReleaseWorkflow = useMetadataReleaseWorkflow,
} = {}) {
  const searchQuery = ref('');
  const searchResults = ref([]);
  const selectedArtist = ref(null);
  const localArtist = ref(null);
  const providerReleaseGroups = ref([]);
  const searchError = ref('');
  const artistActionError = ref('');
  const queuedRefreshRun = ref(null);
  const isSearching = ref(false);
  const isImportingArtist = ref(false);
  const isLoadingArtist = ref(false);
  const isRefreshingArtist = ref(false);
  const artistWorkspaceRequestGate = createLatestRequestGate();
  const detectionHistory = useMetadataDetectionHistory({
    localArtist,
    captureWorkspace: () => artistWorkspaceRequestGate.capture(),
    fetchDetectionEvents: fetchArtistDetectionEvents,
  });
  const { detectionEventsPageInfo, detectionEventsErrorMessage, detectionEventsStatusMessage, isLoadingMoreDetectionEvents, loadMoreDetectionEvents } = detectionHistory;

  const localSearchWorkflow = createLocalSearchWorkflow();

  function beginArtistWorkspace() {
    detectionHistory.reset();
    isImportingArtist.value = false;
    isRefreshingArtist.value = false;
    isLoadingArtist.value = false;
    return artistWorkspaceRequestGate.begin();
  }

  async function refreshArtistWorkspace(artist, request, { isCurrent = () => true } = {}) {
    if (!request.isCurrent() || !isCurrent()) return false;
    const [localPayload, browsePayload] = await Promise.all([
      resolveArtistLocal(artist.id, { signal: request.signal }),
      browseArtistReleaseGroups({
        artistId: artist.id,
        limit: 12,
        releaseGroupStatus: 'website-default',
        signal: request.signal,
      }),
    ]);

    if (!request.isCurrent() || !isCurrent()) {
      return false;
    }

    localArtist.value = localPayload;
    detectionHistory.reset(localPayload.detectionEventsPageInfo);
    providerReleaseGroups.value = browsePayload.browse?.results ?? [];
    return true;
  }

  const releaseWorkflow = createReleaseWorkflow({
    canManageMetadata,
    selectedArtist,
    refreshArtistWorkspace: (artist, options) => refreshArtistWorkspace(artist, artistWorkspaceRequestGate.capture(), options),
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

  async function importArtist(artist) {
    const request = beginArtistWorkspace();
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
    const request = beginArtistWorkspace();
    const initialMusicBrainzArtistId = artist.source?.musicbrainzArtistId ?? null;

    selectedArtist.value = initialMusicBrainzArtistId
      ? { id: initialMusicBrainzArtistId, name: artist.name }
      : null;
    artistActionError.value = '';
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
      detectionHistory.reset(localPayload.detectionEventsPageInfo);
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
        detectionHistory.reset();
        providerReleaseGroups.value = [];
        artistActionError.value = getErrorMessage(error, 'Opening local artist failed');
      }
    } finally {
      if (request.isCurrent()) {
        isLoadingArtist.value = false;
      }
    }
  }

  async function refreshArtistMetadata() {
    if (canManageMetadata() !== true) {
      artistActionError.value = 'Administrator access is required to refresh metadata.';
      return null;
    }
    if (!localArtist.value?.artist?.id || isRefreshingArtist.value) {
      return null;
    }

    const request = artistWorkspaceRequestGate.capture();
    const artistId = localArtist.value.artist.id;
    artistActionError.value = '';
    isRefreshingArtist.value = true;

    try {
      const result = await startMetadataArtistRefreshRequest(artistId);
      if (!request.isCurrent()) return null;
      queuedRefreshRun.value = result.run ?? null;
      return result.run ?? null;
    } catch (error) {
      if (request.isCurrent()) artistActionError.value = getErrorMessage(error, 'Starting metadata refresh failed');
      return null;
    } finally {
      if (request.isCurrent()) isRefreshingArtist.value = false;
    }
  }

  return {
    artistActionError,
    detectionEventsErrorMessage,
    detectionEventsPageInfo,
    detectionEventsStatusMessage,
    importArtist,
    isImportingArtist,
    isLoadingArtist,
    isLoadingMoreDetectionEvents,
    isRefreshingArtist,
    isSearching,
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
    ...localSearchWorkflow,
    ...releaseWorkflow,
  };
}
