/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createApiError } from '../auth.js';
import { createMetadataReadService } from '../metadata/metadata-read-service.js';
import { createOperatorArtistMonitoringStore } from '../metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../metadata/operator-track-override-store.js';
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';
import { createLibraryWantedReleaseProjectionService } from './library-wanted-release-projection-service.js';
import { captureWantedSource } from './library-wanted-release-reconciliation-policy.js';

const invalid = () => createApiError(409, 'library_wanted_projection_invalid', 'Wanted-release source could not be verified');
function capture(value) {
  const result = captureWantedSource(value);
  if (!result) throw invalid();
  return result;
}

export function createLibraryWantedReleaseReader({
  getMetadataArtist = null,
  listOperatorArtistMonitoringSnapshot = null,
  listOperatorReleaseGroupSelections = null,
  listOperatorTrackOverrides = null,
  listLibraryReleaseReconciliationsByMetadataReleaseIds = null,
  libraryWantedReleaseProjectionService = createLibraryWantedReleaseProjectionService(),
} = {}) {
  async function readWantedReleaseProjection({ queryable }) {
    if (typeof queryable?.query !== 'function') throw new TypeError('Wanted projection requires a transaction queryable');
    const metadataReader = createMetadataReadService({ pool: queryable });
    const readArtist = getMetadataArtist ?? metadataReader.getArtistWantedProjection;
    const readMonitoring = listOperatorArtistMonitoringSnapshot
      ?? createOperatorArtistMonitoringStore({ getPoolFn: () => queryable }).listOperatorArtistMonitoringSnapshot;
    const readSelections = listOperatorReleaseGroupSelections
      ?? createOperatorReleaseGroupSelectionStore({ getPoolFn: () => queryable }).listOperatorReleaseGroupSelections;
    const readOverrides = listOperatorTrackOverrides
      ?? createOperatorTrackOverrideStore({ getPoolFn: () => queryable }).listOperatorTrackOverrides;
    const readAvailability = listLibraryReleaseReconciliationsByMetadataReleaseIds
      ?? createLibraryReleaseReconciliationStore({ getPoolFn: () => queryable }).listReconciliationsByMetadataReleaseIds;
    const snapshot = await readMonitoring({ queryable });
    if (!Array.isArray(snapshot)) throw invalid();
    const monitored = capture({ rows: snapshot.filter((row) => row?.isMonitored === true
      && typeof row.appUserId === 'string' && row.appUserId.length > 0
      && typeof row.metadataArtistId === 'string' && row.metadataArtistId.length > 0) }).rows;
    const results = [];
    // A transaction client executes one query at a time; do not reenter its query queue.
    for (const monitoring of monitored) {
      const { appUserId, metadataArtistId } = monitoring;
      let payload;
      try {
        payload = await readArtist({ artistId: metadataArtistId, queryable });
      } catch (error) {
        if (error?.code !== 'metadata_not_found' || error?.status !== 404) throw error;
        results.push({ wantedReleases: [], source: capture({ monitoring, missingMetadataArtist: true }) });
        continue;
      }
      if (!payload || payload.artist?.id !== metadataArtistId
        || !Array.isArray(payload.releaseGroups) || !Array.isArray(payload.releases)) throw invalid();
      const artistPayload = capture({ artistPayload: payload }).artistPayload;
      const selections = capture({ rows: await readSelections({ appUserId, metadataArtistId, queryable }) }).rows;
      const overrides = capture({ rows: await readOverrides({ appUserId, metadataArtistId, queryable }) }).rows;
      if (!Array.isArray(selections) || !Array.isArray(overrides)) throw invalid();
      const inputs = capture({ monitoring, artistPayload, releaseGroupSelections: selections, trackOverrides: overrides });
      const metadataReleaseIds = [...new Set((inputs.artistPayload?.releases ?? []).map((release) => release?.id)
        .filter((id) => typeof id === 'string' && id.length > 0))];
      const availability = metadataReleaseIds.length
        ? await readAvailability({ metadataReleaseIds, queryable }) : [];
      if (!Array.isArray(availability)) throw invalid();
      const source = capture({ ...inputs, libraryReleaseReconciliations: availability });
      const wantedReleases = libraryWantedReleaseProjectionService.projectWantedReleases({ appUserId, ...source });
      results.push({ wantedReleases, source });
    }
    results.sort((a, b) => JSON.stringify([a.source.monitoring.appUserId, a.source.monitoring.metadataArtistId])
      .localeCompare(JSON.stringify([b.source.monitoring.appUserId, b.source.monitoring.metadataArtistId])));
    return { wantedReleases: results.flatMap((result) => result.wantedReleases), source: capture({ artists: results.map((result) => result.source) }) };
  }

  return { readWantedReleaseProjection };
}
