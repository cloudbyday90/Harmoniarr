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

import { createMetadataReadService } from './metadata-read-service.js';
import { defaultOperatorArtistMonitoringPolicy } from './operator-artist-monitoring-policy.js';
import { createLibraryReleaseReconciliationStore } from '../library/library-release-reconciliation-store.js';
import { buildOperatorArtistEffectiveReleaseGroups } from './operator-artist-effective-state.js';
import { createOperatorArtistMonitoringService } from './operator-artist-monitoring-service.js';
import {
  listDesiredReleaseIds,
  summarizeOperatorArtistCoverage,
} from './operator-artist-coverage-summary-service.js';
import { createOperatorArtistReconciliationRunStore } from './operator-artist-reconciliation-run-store.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';

function summarizeSnapshot(snapshot) {
  if (!snapshot) {
    return null;
  }

  return {
    createdAt: snapshot.createdAt ?? null,
    id: snapshot.id,
    snapshotRevision: snapshot.snapshotRevision,
    updatedAt: snapshot.updatedAt ?? null,
  };
}

function buildOverview({
  effectiveReleaseGroups = [],
  orphanedReleaseGroupSelections = [],
  orphanedTrackOverrides = [],
  releaseGroupSelections = [],
  trackOverrides = [],
}) {
  const selectedReleaseGroupCount = effectiveReleaseGroups.filter(
    (releaseGroup) => releaseGroup.operatorState.selectionState === 'selected',
  ).length;
  const partialReleaseGroupCount = effectiveReleaseGroups.filter(
    (releaseGroup) => releaseGroup.operatorState.selectionState === 'partial',
  ).length;
  const unselectedReleaseGroupCount = effectiveReleaseGroups.filter(
    (releaseGroup) => releaseGroup.operatorState.selectionState === 'unselected',
  ).length;
  const manualSelectionCount = releaseGroupSelections.filter(
    (selection) => selection.selectionSource === 'manual',
  ).length;
  const policySelectionCount = effectiveReleaseGroups.filter(
    (releaseGroup) => releaseGroup.operatorState.selectionSource === 'policy',
  ).length;
  const desiredTrackOverrideCount = trackOverrides.filter(
    (trackOverride) => trackOverride.isDesired === true,
  ).length;
  const suppressedTrackOverrideCount = trackOverrides.filter(
    (trackOverride) => trackOverride.isDesired === false,
  ).length;
  const reviewNeededTrackOverrideCount = trackOverrides.filter(
    (trackOverride) => trackOverride.remapStatus === 'review_needed',
  ).length;

  return {
    desiredReleaseGroupCount: selectedReleaseGroupCount + partialReleaseGroupCount,
    desiredTrackOverrideCount,
    hasManualOverrides: manualSelectionCount > 0 || trackOverrides.length > 0,
    manualSelectionCount,
    orphanedReleaseGroupSelectionCount: orphanedReleaseGroupSelections.length,
    orphanedTrackOverrideCount: orphanedTrackOverrides.length,
    partialReleaseGroupCount,
    policySelectionCount,
    releaseGroupCount: effectiveReleaseGroups.length,
    reviewNeededTrackOverrideCount,
    selectedReleaseGroupCount,
    suppressedTrackOverrideCount,
    trackOverrideCount: trackOverrides.length,
    unselectedReleaseGroupCount,
  };
}

export function createOperatorArtistProjectionService({
  getMetadataArtist = null,
  listLibraryReleaseReconciliationsByMetadataReleaseIds = null,
  getOperatorArtistMonitoring = null,
  getLatestOperatorArtistReconciliationSnapshot = null,
  getLatestRunByOperatorArtist = null,
  getPendingRunByOperatorArtist = null,
  getRunningRunByOperatorArtist = null,
  libraryReleaseReconciliationStore = null,
  listOperatorReleaseGroupSelections = null,
  listOperatorTrackOverrides = null,
  metadataReadService = null,
  operatorArtistMonitoringService = null,
  operatorArtistReconciliationRunStore = null,
  operatorArtistReconciliationSnapshotService = null,
  operatorReleaseGroupSelectionStore = null,
  operatorTrackOverrideStore = null,
} = {}) {
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService();
  const resolvedLibraryReleaseReconciliationStore = libraryReleaseReconciliationStore
    ?? createLibraryReleaseReconciliationStore();
  const resolvedOperatorArtistMonitoringService = operatorArtistMonitoringService
    ?? createOperatorArtistMonitoringService();
  const resolvedOperatorArtistReconciliationSnapshotService = operatorArtistReconciliationSnapshotService
    ?? createOperatorArtistReconciliationSnapshotService();
  const resolvedOperatorArtistReconciliationRunStore = operatorArtistReconciliationRunStore
    ?? createOperatorArtistReconciliationRunStore();
  const resolvedOperatorReleaseGroupSelectionStore = operatorReleaseGroupSelectionStore
    ?? createOperatorReleaseGroupSelectionStore();
  const resolvedOperatorTrackOverrideStore = operatorTrackOverrideStore
    ?? createOperatorTrackOverrideStore();

  const readMetadataArtist = getMetadataArtist ?? resolvedMetadataReadService.getArtist;
  const readLibraryReleaseReconciliations = listLibraryReleaseReconciliationsByMetadataReleaseIds
    ?? resolvedLibraryReleaseReconciliationStore.listReconciliationsByMetadataReleaseIds;
  const readOperatorArtistMonitoring = getOperatorArtistMonitoring
    ?? resolvedOperatorArtistMonitoringService.getOperatorArtistMonitoring;
  const readLatestSnapshot = getLatestOperatorArtistReconciliationSnapshot
    ?? resolvedOperatorArtistReconciliationSnapshotService.getLatestOperatorArtistReconciliationSnapshot;
  const readLatestRun = getLatestRunByOperatorArtist
    ?? resolvedOperatorArtistReconciliationRunStore.getLatestRunByOperatorArtist;
  const readPendingRun = getPendingRunByOperatorArtist
    ?? resolvedOperatorArtistReconciliationRunStore.getPendingRunByOperatorArtist;
  const readRunningRun = getRunningRunByOperatorArtist
    ?? resolvedOperatorArtistReconciliationRunStore.getRunningRunByOperatorArtist;
  const readReleaseGroupSelections = listOperatorReleaseGroupSelections
    ?? resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections;
  const readTrackOverrides = listOperatorTrackOverrides
    ?? resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides;

  async function getOperatorArtistProjection({ appUserId, metadataArtistId }) {
    const [
      artistPayload,
      monitoring,
      latestSnapshot,
      latestRun,
      pendingRun,
      runningRun,
      releaseGroupSelections,
      trackOverrides,
    ] = await Promise.all([
      readMetadataArtist({ artistId: metadataArtistId }),
      readOperatorArtistMonitoring({ appUserId, metadataArtistId }),
      readLatestSnapshot({ appUserId, metadataArtistId }),
      readLatestRun({ appUserId, metadataArtistId }),
      readPendingRun({ appUserId, metadataArtistId }),
      readRunningRun({ appUserId, metadataArtistId }),
      readReleaseGroupSelections({ appUserId, metadataArtistId }),
      readTrackOverrides({ appUserId, metadataArtistId }),
    ]);

    const resolvedMonitoring = {
      ...defaultOperatorArtistMonitoringPolicy,
      ...(monitoring ?? {}),
    };
    const artistAliases = Array.isArray(artistPayload.aliases) ? artistPayload.aliases : [];
    const artistReleaseGroups = Array.isArray(artistPayload.releaseGroups) ? artistPayload.releaseGroups : [];
    const artistReleases = Array.isArray(artistPayload.releases) ? artistPayload.releases : [];
    const artistDetectionEvents = Array.isArray(artistPayload.detectionEvents)
      ? artistPayload.detectionEvents
      : [];
    const resolvedReleaseGroupSelections = Array.isArray(releaseGroupSelections)
      ? releaseGroupSelections
      : [];
    const resolvedTrackOverrides = Array.isArray(trackOverrides) ? trackOverrides : [];

    const {
      effectiveReleaseGroups: releaseGroups,
      orphanedReleaseGroupSelections,
      orphanedTrackOverrides,
    } = buildOperatorArtistEffectiveReleaseGroups({
      monitoredReleaseGroupTypes: resolvedMonitoring.monitoredReleaseGroupTypes,
      releaseGroupSelections: resolvedReleaseGroupSelections,
      releaseGroups: artistReleaseGroups,
      releases: artistReleases,
      trackOverrides: resolvedTrackOverrides,
    });
    const desiredReleaseIds = listDesiredReleaseIds(releaseGroups);
    const libraryReleaseReconciliations = desiredReleaseIds.length > 0
      ? await readLibraryReleaseReconciliations({ metadataReleaseIds: desiredReleaseIds })
      : [];

    return {
      aliases: artistAliases,
      artist: artistPayload.artist,
      detectionEvents: artistDetectionEvents,
      detectionEventsPageInfo: artistPayload.detectionEventsPageInfo ?? {
        hasMore: false,
        nextCursor: null,
      },
      operator: {
        monitoring: resolvedMonitoring,
        coverage: summarizeOperatorArtistCoverage({
          effectiveReleaseGroups: releaseGroups,
          libraryReleaseReconciliations,
        }),
        overview: buildOverview({
          effectiveReleaseGroups: releaseGroups,
          orphanedReleaseGroupSelections,
          orphanedTrackOverrides,
          releaseGroupSelections: resolvedReleaseGroupSelections,
          trackOverrides: resolvedTrackOverrides,
        }),
        reconciliation: {
          latestRun,
          latestSnapshot: summarizeSnapshot(latestSnapshot),
          pendingRun,
          runningRun,
          status: runningRun
            ? 'running'
            : pendingRun
              ? 'queued'
              : latestRun?.status ?? 'idle',
        },
        releaseGroupSelections: resolvedReleaseGroupSelections,
        trackOverrides: resolvedTrackOverrides,
      },
      releaseGroups,
      releases: artistReleases,
    };
  }

  return {
    getOperatorArtistProjection,
  };
}
