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
  fetchMetadataRelease,
  fetchMetadataReleaseGroup,
  fetchMusicBrainzReleaseGroupReleases,
  importMusicBrainzRelease,
  importMusicBrainzReleaseGroup,
  resolveMusicBrainzReleaseGroupLocal,
  resolveMusicBrainzReleaseLocal,
} from '../lib/metadata-api.js';

export function useMetadataReleaseWorkflow({
  selectedArtist,
  refreshArtistWorkspace,
  fetchRelease = fetchMetadataRelease,
  fetchReleaseGroup = fetchMetadataReleaseGroup,
  fetchReleaseGroupReleases = fetchMusicBrainzReleaseGroupReleases,
  importReleaseById = importMusicBrainzRelease,
  importReleaseGroupById = importMusicBrainzReleaseGroup,
  resolveReleaseGroupLocal = resolveMusicBrainzReleaseGroupLocal,
  resolveReleaseLocal = resolveMusicBrainzReleaseLocal,
} = {}) {
  const providerReleases = ref([]);
  const localReleaseGroup = ref(null);
  const localRelease = ref(null);
  const releaseGroupActionError = ref('');
  const releaseActionError = ref('');
  const isImportingReleaseGroup = ref(false);
  const isLoadingReleaseGroup = ref(false);
  const isOpeningLocalReleaseGroup = ref(false);
  const isImportingRelease = ref(false);
  const isOpeningLocalRelease = ref(false);
  const releaseSelectionRequestGate = createLatestRequestGate();

  function resetReleaseSelection() {
    releaseSelectionRequestGate.invalidate();
    providerReleases.value = [];
    localReleaseGroup.value = null;
    localRelease.value = null;
    releaseGroupActionError.value = '';
    releaseActionError.value = '';
  }

  async function loadReleaseGroupWorkspace(releaseGroup, { preserveRelease = false } = {}) {
    const request = releaseSelectionRequestGate.begin();
    releaseGroupActionError.value = '';
    if (!preserveRelease) {
      localRelease.value = null;
      releaseActionError.value = '';
    }
    isLoadingReleaseGroup.value = true;

    try {
      const [localPayload, providerPayload] = await Promise.all([
        resolveReleaseGroupLocal(releaseGroup.id, { signal: request.signal }),
        fetchReleaseGroupReleases(releaseGroup.id, { signal: request.signal }),
      ]);

      if (!request.isCurrent()) {
        return;
      }

      localReleaseGroup.value = localPayload;
      providerReleases.value = providerPayload.releases?.results ?? [];
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        localReleaseGroup.value = null;
        providerReleases.value = [];
        releaseGroupActionError.value = getErrorMessage(error, 'Loading release group failed');
      }
    } finally {
      if (request.isCurrent()) {
        isLoadingReleaseGroup.value = false;
      }
    }
  }

  async function importReleaseGroup(releaseGroup) {
    releaseGroupActionError.value = '';
    isImportingReleaseGroup.value = true;

    try {
      await importReleaseGroupById(releaseGroup.id);
      await Promise.all([
        selectedArtist.value
          ? refreshArtistWorkspace(selectedArtist.value)
          : Promise.resolve(),
        loadReleaseGroupWorkspace(releaseGroup),
      ]);
    } catch (error) {
      releaseGroupActionError.value = getErrorMessage(error, 'Release group import failed');
    } finally {
      isImportingReleaseGroup.value = false;
    }
  }

  async function openLocalReleaseGroup(releaseGroup) {
    const request = releaseSelectionRequestGate.begin();
    releaseGroupActionError.value = '';
    releaseActionError.value = '';
    localRelease.value = null;
    isOpeningLocalReleaseGroup.value = true;

    try {
      const releaseGroupPayload = await fetchReleaseGroup(releaseGroup.id, { signal: request.signal });
      if (!request.isCurrent()) {
        return;
      }

      localReleaseGroup.value = releaseGroupPayload;
      providerReleases.value = [];
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        releaseGroupActionError.value = getErrorMessage(error, 'Opening local release group failed');
      }
    } finally {
      if (request.isCurrent()) {
        isOpeningLocalReleaseGroup.value = false;
      }
    }
  }

  async function importRelease(release) {
    releaseActionError.value = '';
    isImportingRelease.value = true;

    try {
      await importReleaseById(release.id);
      localRelease.value = await resolveReleaseLocal(release.id);

      const activeReleaseGroupId = localReleaseGroup.value?.releaseGroup?.source?.musicbrainzReleaseGroupId;
      await Promise.all([
        selectedArtist.value
          ? refreshArtistWorkspace(selectedArtist.value)
          : Promise.resolve(),
        activeReleaseGroupId
          ? loadReleaseGroupWorkspace({ id: activeReleaseGroupId }, { preserveRelease: true })
          : Promise.resolve(),
      ]);
    } catch (error) {
      releaseActionError.value = getErrorMessage(error, 'Release import failed');
    } finally {
      isImportingRelease.value = false;
    }
  }

  async function openLocalRelease(release) {
    const request = releaseSelectionRequestGate.begin();
    releaseActionError.value = '';
    isOpeningLocalRelease.value = true;

    try {
      const [releasePayload, releaseGroupPayload] = await Promise.all([
        fetchRelease(release.id, { signal: request.signal }),
        fetchReleaseGroup(release.releaseGroupId, { signal: request.signal }),
      ]);

      if (!request.isCurrent()) {
        return;
      }

      localRelease.value = releasePayload;
      localReleaseGroup.value = releaseGroupPayload;
      providerReleases.value = [];
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      if (request.isCurrent()) {
        releaseActionError.value = getErrorMessage(error, 'Opening local release failed');
      }
    } finally {
      if (request.isCurrent()) {
        isOpeningLocalRelease.value = false;
      }
    }
  }

  return {
    importRelease,
    importReleaseGroup,
    isImportingRelease,
    isImportingReleaseGroup,
    isLoadingReleaseGroup,
    isOpeningLocalReleaseGroup,
    isOpeningLocalRelease,
    loadReleaseGroupWorkspace,
    localRelease,
    localReleaseGroup,
    openLocalReleaseGroup,
    openLocalRelease,
    providerReleases,
    releaseActionError,
    releaseGroupActionError,
    resetReleaseSelection,
  };
}