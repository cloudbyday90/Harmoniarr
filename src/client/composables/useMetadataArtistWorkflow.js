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
import { getErrorMessage } from '../lib/error-utils.js';
import {
  browseMusicBrainzArtistReleaseGroups,
  fetchMetadataArtist,
  importMusicBrainzArtist,
  resolveMusicBrainzArtistLocal,
  searchMusicBrainzArtists,
  updateMetadataArtistMonitoring as defaultUpdateMetadataArtistMonitoring,
} from '../lib/metadata-api.js';
import { useMetadataLocalSearchWorkflow } from './useMetadataLocalSearchWorkflow.js';
import { useMetadataReleaseWorkflow } from './useMetadataReleaseWorkflow.js';

export function useMetadataArtistWorkflow({
  browseArtistReleaseGroups = browseMusicBrainzArtistReleaseGroups,
  fetchArtist = fetchMetadataArtist,
  importArtistById = importMusicBrainzArtist,
  resolveArtistLocal = resolveMusicBrainzArtistLocal,
  searchArtists = searchMusicBrainzArtists,
  updateArtistMonitoringRequest = defaultUpdateMetadataArtistMonitoring,
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
  const isSearching = ref(false);
  const isImportingArtist = ref(false);
  const isLoadingArtist = ref(false);
  const isUpdatingArtistMonitoring = ref(false);

  const localSearchWorkflow = createLocalSearchWorkflow();

  async function refreshArtistWorkspace(artist) {
    const [localPayload, browsePayload] = await Promise.all([
      resolveArtistLocal(artist.id),
      browseArtistReleaseGroups({
        artistId: artist.id,
        limit: 12,
        releaseGroupStatus: 'website-default',
      }),
    ]);

    localArtist.value = localPayload;
    providerReleaseGroups.value = browsePayload.browse?.results ?? [];
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
    selectedArtist.value = artist;
    artistActionError.value = '';
    if (resetSelection) {
      releaseWorkflow.resetReleaseSelection();
    }
    isLoadingArtist.value = true;

    try {
      await refreshArtistWorkspace(artist);
    } catch (error) {
      localArtist.value = null;
      providerReleaseGroups.value = [];
      artistActionError.value = getErrorMessage(error, 'Loading imported artist failed');
    } finally {
      isLoadingArtist.value = false;
    }
  }

  async function importArtist(artist) {
    selectedArtist.value = artist;
    artistActionError.value = '';
    releaseWorkflow.resetReleaseSelection();
    isImportingArtist.value = true;

    try {
      await importArtistById(artist.id);
      await loadArtistWorkspace(artist);
    } catch (error) {
      artistActionError.value = getErrorMessage(error, 'Artist import failed');
    } finally {
      isImportingArtist.value = false;
    }
  }

  async function openLocalArtist(artist) {
    const musicBrainzArtistId = artist.source?.musicbrainzArtistId ?? null;

    selectedArtist.value = musicBrainzArtistId
      ? { id: musicBrainzArtistId, name: artist.name }
      : null;
    artistActionError.value = '';
    releaseWorkflow.resetReleaseSelection();
    isLoadingArtist.value = true;

    try {
      const [localPayload, providerBrowseResult] = await Promise.allSettled([
        fetchArtist(artist.id),
        musicBrainzArtistId
          ? browseArtistReleaseGroups({
              artistId: musicBrainzArtistId,
              limit: 12,
              releaseGroupStatus: 'website-default',
            })
          : Promise.resolve({ browse: { results: [] } }),
      ]);

      if (localPayload.status !== 'fulfilled') {
        throw localPayload.reason;
      }

      localArtist.value = localPayload.value;
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
      localArtist.value = null;
      providerReleaseGroups.value = [];
      artistActionError.value = getErrorMessage(error, 'Opening local artist failed');
    } finally {
      isLoadingArtist.value = false;
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

  return {
    artistActionError,
    importArtist,
    isImportingArtist,
    isLoadingArtist,
    isSearching,
    isUpdatingArtistMonitoring,
    localArtist,
    openLocalArtist,
    providerReleaseGroups,
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