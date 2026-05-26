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

import { createApiError } from '../auth.js';
import { createLibraryDiscoveryRequestStore } from '../library/library-discovery-request-store.js';
import { createLibraryMediaRequestStore } from '../library/library-media-request-store.js';
import { createLibraryReleaseReconciliationStore } from '../library/library-release-reconciliation-store.js';
import { buildOperatorArtistEffectiveReleaseGroups } from './operator-artist-effective-state.js';
import { createOperatorArtistMonitoringService } from './operator-artist-monitoring-service.js';
import { defaultOperatorArtistMonitoringPolicy } from './operator-artist-monitoring-policy.js';
import { createOperatorArtistDesiredStateService } from './operator-artist-desired-state-service.js';
import { createOperatorArtistReconciliationRequestService } from './operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';
import { createMetadataReadService } from './metadata-read-service.js';

function toCount(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function countPlainObjectKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value).length
    : 0;
}

function createSnapshotNotFoundError(snapshotId) {
  return createApiError(
    404,
    'operator_artist_reconciliation_snapshot_not_found',
    `The requested artist reconciliation snapshot could not be found: ${snapshotId}`,
  );
}

function createSnapshotRevisionMismatchError({ expectedSnapshotRevision, snapshotRevision }) {
  return createApiError(
    409,
    'operator_artist_reconciliation_snapshot_revision_mismatch',
    `Artist reconciliation snapshot revision mismatch: expected ${expectedSnapshotRevision}, received ${snapshotRevision}`,
  );
}

export function createOperatorArtistReconciliationExecutionService({
  getMetadataArtist = null,
  getOperatorArtistMonitoring = null,
  getOperatorArtistReconciliationSnapshotById = null,
  listActiveRequestsByMetadataReleaseIds = null,
  listDiscoveryRequestsByMetadataReleaseIds = null,
  listLibraryReleaseReconciliationsByMetadataReleaseIds = null,
  listOperatorReleaseGroupSelections = null,
  listOperatorTrackOverrides = null,
  libraryDiscoveryRequestStore = null,
  libraryMediaRequestStore = null,
  libraryReleaseReconciliationStore = null,
  metadataReadService = null,
  operatorArtistDesiredStateService = null,
  operatorArtistMonitoringService = null,
  operatorArtistReconciliationRequestService = null,
  operatorArtistReconciliationSnapshotService = null,
  operatorReleaseGroupSelectionStore = null,
  operatorTrackOverrideStore = null,
} = {}) {
  const resolvedMetadataReadService = metadataReadService ?? createMetadataReadService();
  const resolvedOperatorArtistMonitoringService = operatorArtistMonitoringService
    ?? createOperatorArtistMonitoringService();
  const resolvedOperatorArtistReconciliationSnapshotService = operatorArtistReconciliationSnapshotService
    ?? createOperatorArtistReconciliationSnapshotService();
  const resolvedOperatorReleaseGroupSelectionStore = operatorReleaseGroupSelectionStore
    ?? createOperatorReleaseGroupSelectionStore();
  const resolvedOperatorTrackOverrideStore = operatorTrackOverrideStore
    ?? createOperatorTrackOverrideStore();
  const resolvedLibraryReleaseReconciliationStore = libraryReleaseReconciliationStore
    ?? createLibraryReleaseReconciliationStore();
  const resolvedLibraryMediaRequestStore = libraryMediaRequestStore
    ?? createLibraryMediaRequestStore();
  const resolvedLibraryDiscoveryRequestStore = libraryDiscoveryRequestStore
    ?? createLibraryDiscoveryRequestStore();
  const resolvedOperatorArtistDesiredStateService = operatorArtistDesiredStateService
    ?? createOperatorArtistDesiredStateService();
  const resolvedOperatorArtistReconciliationRequestService = operatorArtistReconciliationRequestService
    ?? createOperatorArtistReconciliationRequestService();
  const readMetadataArtist = getMetadataArtist ?? resolvedMetadataReadService.getArtist;
  const readOperatorArtistMonitoring = getOperatorArtistMonitoring
    ?? resolvedOperatorArtistMonitoringService.getOperatorArtistMonitoring;
  const readSnapshotById = getOperatorArtistReconciliationSnapshotById
    ?? resolvedOperatorArtistReconciliationSnapshotService.getOperatorArtistReconciliationSnapshotById;
  const readActiveRequests = listActiveRequestsByMetadataReleaseIds
    ?? resolvedLibraryMediaRequestStore.listActiveRequestsByMetadataReleaseIds;
  const readDiscoveryRequests = listDiscoveryRequestsByMetadataReleaseIds
    ?? resolvedLibraryDiscoveryRequestStore.listDiscoveryRequestsByMetadataReleaseIds;
  const readLibraryReleaseReconciliations = listLibraryReleaseReconciliationsByMetadataReleaseIds
    ?? resolvedLibraryReleaseReconciliationStore.listReconciliationsByMetadataReleaseIds;
  const readReleaseSelections = listOperatorReleaseGroupSelections
    ?? resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections;
  const readTrackOverrides = listOperatorTrackOverrides
    ?? resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides;
  const buildDesiredStatePlan = resolvedOperatorArtistDesiredStateService.buildDesiredStatePlan;
  const materializeDesiredReleaseRequests = resolvedOperatorArtistReconciliationRequestService
    .materializeDesiredReleaseRequests;

  async function executeOperatorArtistReconciliation({
    appUserId,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    throwIfCancelled = async () => {},
  } = {}) {
    await throwIfCancelled();

    const [artistPayload, monitoring, snapshot, releaseSelections, trackOverrides] = await Promise.all([
      readMetadataArtist({ artistId: metadataArtistId }),
      readOperatorArtistMonitoring({ appUserId, metadataArtistId }),
      readSnapshotById({ appUserId, metadataArtistId, snapshotId }),
      readReleaseSelections({ appUserId, metadataArtistId }),
      readTrackOverrides({ appUserId, metadataArtistId }),
    ]);

    if (!snapshot) {
      throw createSnapshotNotFoundError(snapshotId);
    }

    if (snapshot.snapshotRevision !== snapshotRevision) {
      throw createSnapshotRevisionMismatchError({
        expectedSnapshotRevision: snapshotRevision,
        snapshotRevision: snapshot.snapshotRevision,
      });
    }

    await throwIfCancelled();

    const resolvedMonitoring = {
      ...defaultOperatorArtistMonitoringPolicy,
      ...(monitoring ?? {}),
    };
    const resolvedReleaseSelections = Array.isArray(releaseSelections) ? releaseSelections : [];
    const resolvedTrackOverrides = Array.isArray(trackOverrides) ? trackOverrides : [];
    const {
      effectiveReleaseGroups,
      orphanedReleaseGroupSelections,
      orphanedTrackOverrides,
    } = buildOperatorArtistEffectiveReleaseGroups({
      monitoredReleaseGroupTypes: resolvedMonitoring.monitoredReleaseGroupTypes,
      releaseGroupSelections: resolvedReleaseSelections,
      releaseGroups: Array.isArray(artistPayload?.releaseGroups) ? artistPayload.releaseGroups : [],
      releases: Array.isArray(artistPayload?.releases) ? artistPayload.releases : [],
      trackOverrides: resolvedTrackOverrides,
    });
    const desiredReleaseIds = [
      ...new Set(
        effectiveReleaseGroups
          .filter((releaseGroup) => (
            releaseGroup?.operatorState?.selectionState === 'selected'
            || releaseGroup?.operatorState?.selectionState === 'partial'
          ))
          .map((releaseGroup) => releaseGroup?.operatorState?.resolvedMetadataReleaseId)
          .filter((metadataReleaseId) => typeof metadataReleaseId === 'string' && metadataReleaseId.length > 0),
      ),
    ];

    const [libraryReleaseReconciliations, activeRequests, discoveryRequests] = await Promise.all([
      readLibraryReleaseReconciliations({ metadataReleaseIds: desiredReleaseIds }),
      readActiveRequests({ metadataReleaseIds: desiredReleaseIds }),
      readDiscoveryRequests({ metadataReleaseIds: desiredReleaseIds }),
    ]);

    const reconciliationByReleaseId = new Map(
      libraryReleaseReconciliations.map((entry) => [entry.metadataReleaseId, entry]),
    );
    const activeRequestByReleaseId = new Map(
      activeRequests.map((entry) => [entry.existingMatch?.releaseId ?? null, entry]).filter(([key]) => key),
    );
    const discoveryRequestByReleaseId = new Map(
      discoveryRequests.map((entry) => [entry.metadataReleaseId, entry]),
    );
    const desiredStatePlan = buildDesiredStatePlan({
      activeRequestsByReleaseId: activeRequestByReleaseId,
      metadataArtistId,
      discoveryRequestsByReleaseId: discoveryRequestByReleaseId,
      monitoring: resolvedMonitoring,
      releaseGroups: effectiveReleaseGroups,
      releaseReconciliationsByReleaseId: reconciliationByReleaseId,
    });
    const materializationResult = await materializeDesiredReleaseRequests({
      appUserId,
      artistName: artistPayload?.artist?.name ?? null,
      desiredReleases: desiredStatePlan.desiredReleases,
      snapshotId: snapshot.id,
      snapshotRevision: snapshot.snapshotRevision,
      throwIfCancelled,
    });

    const selectedReleaseGroupCount = effectiveReleaseGroups.filter(
      (releaseGroup) => releaseGroup.operatorState.selectionState === 'selected',
    ).length;
    const partialReleaseGroupCount = effectiveReleaseGroups.filter(
      (releaseGroup) => releaseGroup.operatorState.selectionState === 'partial',
    ).length;
    const unselectedReleaseGroupCount = effectiveReleaseGroups.filter(
      (releaseGroup) => releaseGroup.operatorState.selectionState === 'unselected',
    ).length;
    const desiredTrackOverrideCount = resolvedTrackOverrides.filter((override) => override.isDesired === true).length;
    const suppressedTrackOverrideCount = resolvedTrackOverrides.filter((override) => override.isDesired === false).length;

    return {
      appUserId,
      activeRequestBlockedCount: desiredStatePlan.summary.activeRequestBlockedCount,
      completedAt: new Date().toISOString(),
      completeBlockedCount: desiredStatePlan.summary.completeBlockedCount,
      cooldownBlockedCount: desiredStatePlan.summary.cooldownBlockedCount,
      currentAndFutureEligibleCount: desiredStatePlan.summary.currentAndFutureEligibleCount,
      desiredReleaseGroupCount: selectedReleaseGroupCount + partialReleaseGroupCount,
      desiredTrackOverrideCount,
      discoveryReconciled: materializationResult.discoveryReconciled,
      downstreamCreatedRequestCount: materializationResult.createdRequestCount,
      downstreamCreatedRequestIds: materializationResult.createdRequestIds,
      downstreamSkippedRequestCount: materializationResult.skippedRequestCount,
      downstreamEligibleReleaseCount: desiredStatePlan.summary.eligibleReleaseCount,
      duplicateBlockedCount: desiredStatePlan.summary.duplicateBlockedCount
        + materializationResult.duplicateSuppressedCount,
      downstreamDuplicateSuppressedCount: materializationResult.duplicateSuppressedCount,
      explicitDesiredReleaseCount: desiredStatePlan.summary.explicitDesiredReleaseCount,
      futureEligibleCount: desiredStatePlan.summary.futureEligibleCount,
      futureScopeBlockedCount: desiredStatePlan.summary.futureScopeBlockedCount,
      manualOnlyBlockedCount: desiredStatePlan.summary.manualOnlyBlockedCount,
      monitoredReleaseGroupTypeCount: toCount(resolvedMonitoring?.monitoredReleaseGroupTypes?.length),
      monitoredReleaseGroupTypes: Array.isArray(resolvedMonitoring?.monitoredReleaseGroupTypes)
        ? [...resolvedMonitoring.monitoredReleaseGroupTypes]
        : [],
      orphanedReleaseGroupSelectionCount: orphanedReleaseGroupSelections.length,
      orphanedTrackOverrideCount: orphanedTrackOverrides.length,
      partialReleaseGroupCount,
      policyDesiredReleaseCount: desiredStatePlan.summary.policyDesiredReleaseCount,
      queuedDiscoveryCount: desiredStatePlan.summary.queuedDiscoveryCount,
      releaseGroupSelectionCount: resolvedReleaseSelections.length,
      selectionSourceMode: resolvedMonitoring?.selectionSourceMode ?? null,
      snapshotId: snapshot.id,
      snapshotPayloadKeyCount: countPlainObjectKeys(snapshot.snapshotPayload),
      snapshotRevision: snapshot.snapshotRevision,
      snapshotSavedAt: snapshot.updatedAt ?? snapshot.createdAt ?? null,
      suppressedTrackOverrideCount,
      trackOnlyBlockedCount: desiredStatePlan.summary.trackOnlyBlockedCount,
      trackOverrideCount: resolvedTrackOverrides.length,
      unselectedReleaseGroupCount,
      unresolvedReleaseCount: desiredStatePlan.summary.unresolvedReleaseCount,
      wantedAutomationMode: resolvedMonitoring?.wantedAutomationMode ?? null,
    };
  }

  return {
    executeOperatorArtistReconciliation,
  };
}
