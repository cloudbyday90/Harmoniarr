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
import { createOperatorArtistMonitoringService } from './operator-artist-monitoring-service.js';
import { createOperatorArtistReconciliationSnapshotService } from './operator-artist-reconciliation-snapshot-service.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from './operator-track-override-store.js';

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
  getOperatorArtistMonitoring = null,
  getOperatorArtistReconciliationSnapshotById = null,
  listOperatorReleaseGroupSelections = null,
  listOperatorTrackOverrides = null,
  operatorArtistMonitoringService = null,
  operatorArtistReconciliationSnapshotService = null,
  operatorReleaseGroupSelectionStore = null,
  operatorTrackOverrideStore = null,
} = {}) {
  const resolvedOperatorArtistMonitoringService = operatorArtistMonitoringService
    ?? createOperatorArtistMonitoringService();
  const resolvedOperatorArtistReconciliationSnapshotService = operatorArtistReconciliationSnapshotService
    ?? createOperatorArtistReconciliationSnapshotService();
  const resolvedOperatorReleaseGroupSelectionStore = operatorReleaseGroupSelectionStore
    ?? createOperatorReleaseGroupSelectionStore();
  const resolvedOperatorTrackOverrideStore = operatorTrackOverrideStore
    ?? createOperatorTrackOverrideStore();
  const readOperatorArtistMonitoring = getOperatorArtistMonitoring
    ?? resolvedOperatorArtistMonitoringService.getOperatorArtistMonitoring;
  const readSnapshotById = getOperatorArtistReconciliationSnapshotById
    ?? resolvedOperatorArtistReconciliationSnapshotService.getOperatorArtistReconciliationSnapshotById;
  const readReleaseSelections = listOperatorReleaseGroupSelections
    ?? resolvedOperatorReleaseGroupSelectionStore.listOperatorReleaseGroupSelections;
  const readTrackOverrides = listOperatorTrackOverrides
    ?? resolvedOperatorTrackOverrideStore.listOperatorTrackOverrides;

  async function executeOperatorArtistReconciliation({
    appUserId,
    metadataArtistId,
    snapshotId,
    snapshotRevision,
    throwIfCancelled = async () => {},
  } = {}) {
    await throwIfCancelled();

    const [monitoring, snapshot, releaseSelections, trackOverrides] = await Promise.all([
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

    const selectedReleaseGroupCount = releaseSelections.filter((selection) => selection.selectionState === 'selected').length;
    const partialReleaseGroupCount = releaseSelections.filter((selection) => selection.selectionState === 'partial').length;
    const unselectedReleaseGroupCount = releaseSelections.filter((selection) => selection.selectionState === 'unselected').length;
    const desiredTrackOverrideCount = trackOverrides.filter((override) => override.isDesired === true).length;
    const suppressedTrackOverrideCount = trackOverrides.filter((override) => override.isDesired === false).length;

    return {
      appUserId,
      completedAt: new Date().toISOString(),
      desiredReleaseGroupCount: selectedReleaseGroupCount + partialReleaseGroupCount,
      desiredTrackOverrideCount,
      monitoredReleaseGroupTypeCount: toCount(monitoring?.monitoredReleaseGroupTypes?.length),
      monitoredReleaseGroupTypes: Array.isArray(monitoring?.monitoredReleaseGroupTypes)
        ? [...monitoring.monitoredReleaseGroupTypes]
        : [],
      partialReleaseGroupCount,
      releaseGroupSelectionCount: releaseSelections.length,
      selectionSourceMode: monitoring?.selectionSourceMode ?? null,
      snapshotId: snapshot.id,
      snapshotPayloadKeyCount: countPlainObjectKeys(snapshot.snapshotPayload),
      snapshotRevision: snapshot.snapshotRevision,
      snapshotSavedAt: snapshot.updatedAt ?? snapshot.createdAt ?? null,
      suppressedTrackOverrideCount,
      trackOverrideCount: trackOverrides.length,
      unselectedReleaseGroupCount,
      wantedAutomationMode: monitoring?.wantedAutomationMode ?? null,
    };
  }

  return {
    executeOperatorArtistReconciliation,
  };
}
