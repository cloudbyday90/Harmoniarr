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

import { normalizeMetadataReleaseDateForDateColumn } from '../metadata/metadata-release-date-normalization.js';
import { createOperatorArtistDesiredStateService } from '../metadata/operator-artist-desired-state-service.js';
import { buildOperatorArtistEffectiveReleaseGroups } from '../metadata/operator-artist-effective-state.js';
import { defaultOperatorArtistMonitoringPolicy } from '../metadata/operator-artist-monitoring-policy.js';

function toCount(value) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function normalizeReconciliationStatus(status) {
  return typeof status === 'string' && status.trim().length > 0
    ? status.trim().toLowerCase()
    : 'missing';
}

function isAcquiredReconciliation(reconciliation) {
  const status = normalizeReconciliationStatus(reconciliation?.reconciliationStatus);
  return status === 'complete' || status === 'duplicate';
}

function buildReconciliationByReleaseId(reconciliations = []) {
  return new Map(
    reconciliations
      .filter((reconciliation) => typeof reconciliation?.metadataReleaseId === 'string'
        && reconciliation.metadataReleaseId.length > 0)
      .map((reconciliation) => [reconciliation.metadataReleaseId, reconciliation]),
  );
}

function buildWantedReleaseEvidence({
  desiredRelease,
  monitoring,
  reconciliation,
}) {
  const reconciliationStatus = normalizeReconciliationStatus(reconciliation?.reconciliationStatus);
  const isExplicitSelection = desiredRelease.isExplicitSelection === true;

  return {
    monitoredReleaseGroupTypes: Array.isArray(monitoring.monitoredReleaseGroupTypes)
      ? monitoring.monitoredReleaseGroupTypes
      : [],
    reconciliationStatus,
    releaseScope: monitoring.releaseScope ?? defaultOperatorArtistMonitoringPolicy.releaseScope,
    selectionSource: isExplicitSelection ? 'manual' : 'policy',
    selectionState: desiredRelease.selectionState,
    strategy: isExplicitSelection
      ? 'explicit_release_gap'
      : reconciliation
        ? 'monitored_release_gap'
        : 'monitored_release_absent',
    wantedAutomationMode: monitoring.wantedAutomationMode
      ?? defaultOperatorArtistMonitoringPolicy.wantedAutomationMode,
  };
}

function toWantedRelease({
  desiredRelease,
  metadataArtistId,
  reconciliation,
  releaseById,
  monitoring,
}) {
  const resolvedRelease = releaseById.get(desiredRelease.metadataReleaseId) ?? null;
  const expectedTrackCount = toCount(reconciliation?.expectedTrackCount) || toCount(resolvedRelease?.trackCount);
  if (expectedTrackCount < 1) {
    return null;
  }

  const matchedTrackCount = Math.min(toCount(reconciliation?.matchedTrackCount), expectedTrackCount);

  return {
    appUserId: null,
    evidence: buildWantedReleaseEvidence({ desiredRelease, monitoring, reconciliation }),
    expectedTrackCount,
    matchedTrackCount,
    metadataArtistId,
    metadataReleaseGroupId: desiredRelease.metadataReleaseGroupId,
    metadataReleaseId: desiredRelease.metadataReleaseId,
    missingTrackCount: Math.max(expectedTrackCount - matchedTrackCount, 0),
    releaseDate: normalizeMetadataReleaseDateForDateColumn(desiredRelease.releaseDate),
    releaseStatus: resolvedRelease?.status ?? null,
    wantedStatus: matchedTrackCount > 0 ? 'partial' : 'missing',
  };
}

function sortWantedReleases(left, right) {
  return [
    'appUserId',
    'metadataArtistId',
    'metadataReleaseGroupId',
    'metadataReleaseId',
  ].map((key) => String(left[key] ?? '').localeCompare(String(right[key] ?? '')))
    .find((comparison) => comparison !== 0) ?? 0;
}

/**
 * Builds the durable wanted-release projection from the same effective state
 * that artist reconciliation uses. A policy selection is included only when
 * it is eligible under the monitoring policy; an explicit operator selection
 * intentionally bypasses those policy gates.
 */
export function buildLibraryWantedReleaseProjection({
  appUserId,
  artistPayload = {},
  libraryReleaseReconciliations = [],
  monitoring = defaultOperatorArtistMonitoringPolicy,
  operatorArtistDesiredStateService = createOperatorArtistDesiredStateService(),
  releaseGroupSelections = [],
  trackOverrides = [],
} = {}) {
  if (typeof appUserId !== 'string' || appUserId.trim().length < 1) {
    return [];
  }

  const resolvedMonitoring = {
    ...defaultOperatorArtistMonitoringPolicy,
    ...(monitoring ?? {}),
  };
  const releaseGroups = Array.isArray(artistPayload.releaseGroups) ? artistPayload.releaseGroups : [];
  const releases = Array.isArray(artistPayload.releases) ? artistPayload.releases : [];
  const reconciliations = Array.isArray(libraryReleaseReconciliations)
    ? libraryReleaseReconciliations
    : [];
  const reconciliationByReleaseId = buildReconciliationByReleaseId(reconciliations);
  const releaseById = new Map(
    releases
      .filter((release) => typeof release?.id === 'string' && release.id.length > 0)
      .map((release) => [release.id, release]),
  );
  const { effectiveReleaseGroups } = buildOperatorArtistEffectiveReleaseGroups({
    monitoredReleaseGroupTypes: resolvedMonitoring.monitoredReleaseGroupTypes,
    releaseGroupSelections: Array.isArray(releaseGroupSelections) ? releaseGroupSelections : [],
    releaseGroups,
    releases,
    trackOverrides: Array.isArray(trackOverrides) ? trackOverrides : [],
  });
  const desiredStatePlan = operatorArtistDesiredStateService.buildDesiredStatePlan({
    metadataArtistId: artistPayload?.artist?.id ?? null,
    monitoring: resolvedMonitoring,
    releaseGroups: effectiveReleaseGroups,
    releaseReconciliationsByReleaseId: reconciliationByReleaseId,
  });

  return desiredStatePlan.desiredReleases
    .filter((desiredRelease) => (
      typeof desiredRelease.metadataReleaseId === 'string'
      && desiredRelease.metadataReleaseId.length > 0
      && !isAcquiredReconciliation(reconciliationByReleaseId.get(desiredRelease.metadataReleaseId))
      && (desiredRelease.isExplicitSelection === true || desiredRelease.eligibleForDownstreamWork === true)
    ))
    .map((desiredRelease) => {
      const wantedRelease = toWantedRelease({
        desiredRelease,
        metadataArtistId: artistPayload?.artist?.id ?? null,
        monitoring: resolvedMonitoring,
        reconciliation: reconciliationByReleaseId.get(desiredRelease.metadataReleaseId),
        releaseById,
      });

      return wantedRelease ? { ...wantedRelease, appUserId: appUserId.trim() } : null;
    })
    .filter(Boolean)
    .sort(sortWantedReleases);
}

export function createLibraryWantedReleaseProjectionService({
  operatorArtistDesiredStateService = createOperatorArtistDesiredStateService(),
} = {}) {
  function projectWantedReleases(input = {}) {
    return buildLibraryWantedReleaseProjection({
      ...input,
      operatorArtistDesiredStateService,
    });
  }

  return {
    projectWantedReleases,
  };
}
