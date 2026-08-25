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

import { createMetadataReadService } from '../metadata/metadata-read-service.js';
import { createOperatorArtistMonitoringStore } from '../metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../metadata/operator-track-override-store.js';
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';
import { createLibraryWantedReleaseProjectionService } from './library-wanted-release-projection-service.js';
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';

const MAX_ARTIST_PROJECTION_CONCURRENCY = 6;

function isMissingMetadataArtist(error) {
  return error?.code === 'metadata_not_found' && error?.status === 404;
}

function listMetadataReleaseIds(artistPayload = {}) {
  return [
    ...new Set(
      (Array.isArray(artistPayload.releases) ? artistPayload.releases : [])
        .map((release) => release?.id)
        .filter((metadataReleaseId) => typeof metadataReleaseId === 'string' && metadataReleaseId.length > 0),
    ),
  ];
}

async function mapWithConcurrency(values, mapper, concurrency = MAX_ARTIST_PROJECTION_CONCURRENCY) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), values.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }));

  return results;
}

export function createLibraryWantedReleaseService({
  getMetadataArtist = null,
  libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore(),
  libraryWantedReleaseProjectionService = createLibraryWantedReleaseProjectionService(),
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
  listLibraryReleaseReconciliationsByMetadataReleaseIds = null,
  listOperatorArtistMonitoringSnapshot = null,
  listOperatorReleaseGroupSelections = null,
  listOperatorTrackOverrides = null,
  metadataReadService = null,
  operatorArtistMonitoringStore = null,
  operatorReleaseGroupSelectionStore = null,
  operatorTrackOverrideStore = null,
} = {}) {
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService();
  const resolvedOperatorArtistMonitoringStore = operatorArtistMonitoringStore
    ?? createOperatorArtistMonitoringStore();
  const resolvedOperatorReleaseGroupSelectionStore = operatorReleaseGroupSelectionStore
    ?? createOperatorReleaseGroupSelectionStore();
  const resolvedOperatorTrackOverrideStore = operatorTrackOverrideStore
    ?? createOperatorTrackOverrideStore();
  const readMetadataArtist = getMetadataArtist ?? resolvedMetadataReadService.getArtist;
  const readMonitoringSnapshot = listOperatorArtistMonitoringSnapshot
    ?? resolvedOperatorArtistMonitoringStore.listOperatorArtistMonitoringSnapshot;
  const readReleaseSelections = listOperatorReleaseGroupSelections
    ?? resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections;
  const readTrackOverrides = listOperatorTrackOverrides
    ?? resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides;
  const readReconciliations = listLibraryReleaseReconciliationsByMetadataReleaseIds
    ?? libraryReleaseReconciliationStore.listReconciliationsByMetadataReleaseIds;

  async function projectWantedReleasesForArtist(monitoring) {
    const { appUserId, metadataArtistId } = monitoring;

    try {
      const [artistPayload, releaseGroupSelections, trackOverrides] = await Promise.all([
        readMetadataArtist({ artistId: metadataArtistId }),
        readReleaseSelections({ appUserId, metadataArtistId }),
        readTrackOverrides({ appUserId, metadataArtistId }),
      ]);
      const metadataReleaseIds = listMetadataReleaseIds(artistPayload);
      const libraryReleaseReconciliations = metadataReleaseIds.length > 0
        ? await readReconciliations({ metadataReleaseIds })
        : [];

      return libraryWantedReleaseProjectionService.projectWantedReleases({
        appUserId,
        artistPayload,
        libraryReleaseReconciliations,
        monitoring,
        releaseGroupSelections,
        trackOverrides,
      });
    } catch (error) {
      // A metadata refresh can remove an artist after monitoring is read. The
      // projection is rebuilt on the next discovery run, so this race should
      // not fail or leave the complete wanted-releases replacement incomplete.
      if (isMissingMetadataArtist(error)) {
        return [];
      }

      throw error;
    }
  }

  async function loadWantedReleases() {
    const monitoringRows = await readMonitoringSnapshot();
    const monitoredArtists = (Array.isArray(monitoringRows) ? monitoringRows : [])
      .filter((monitoring) => (
        monitoring?.isMonitored === true
        && typeof monitoring.appUserId === 'string'
        && monitoring.appUserId.length > 0
        && typeof monitoring.metadataArtistId === 'string'
        && monitoring.metadataArtistId.length > 0
      ));
    const wantedByArtist = await mapWithConcurrency(monitoredArtists, projectWantedReleasesForArtist);

    return wantedByArtist.flat();
  }

  async function reconcileWantedReleases() {
    const wantedReleases = await loadWantedReleases();
    await libraryWantedReleaseStore.replaceLibraryWantedReleases({ wantedReleases });
  }

  return {
    reconcileWantedReleases,
  };
}
