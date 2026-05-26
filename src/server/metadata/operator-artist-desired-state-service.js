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

import { defaultOperatorArtistMonitoringPolicy } from './operator-artist-monitoring-policy.js';

function parseReleaseDateInstant(releaseDate) {
  if (typeof releaseDate !== 'string' || releaseDate.trim().length === 0) {
    return null;
  }

  const candidate = releaseDate.includes('T')
    ? new Date(releaseDate)
    : new Date(`${releaseDate}T00:00:00.000Z`);

  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function isReleaseInFuture(releaseDate, now) {
  const releaseInstant = parseReleaseDateInstant(releaseDate);
  if (!releaseInstant) {
    return false;
  }

  return releaseInstant.getTime() > now.getTime();
}

function incrementCount(summary, field) {
  summary[field] += 1;
}

export function createOperatorArtistDesiredStateService({
  getNow = () => new Date(),
} = {}) {
  function buildDesiredStatePlan({
    activeRequestsByReleaseId = new Map(),
    metadataArtistId = null,
    discoveryRequestsByReleaseId = new Map(),
    monitoring = defaultOperatorArtistMonitoringPolicy,
    releaseGroups = [],
    releaseReconciliationsByReleaseId = new Map(),
  } = {}) {
    const now = getNow();
    const summary = {
      activeRequestBlockedCount: 0,
      completeBlockedCount: 0,
      cooldownBlockedCount: 0,
      currentAndFutureEligibleCount: 0,
      desiredReleaseCount: 0,
      duplicateBlockedCount: 0,
      eligibleReleaseCount: 0,
      explicitDesiredReleaseCount: 0,
      futureEligibleCount: 0,
      futureScopeBlockedCount: 0,
      manualOnlyBlockedCount: 0,
      partialDesiredReleaseCount: 0,
      policyDesiredReleaseCount: 0,
      queuedDiscoveryCount: 0,
      trackOnlyBlockedCount: 0,
      unresolvedReleaseCount: 0,
    };

    const desiredReleases = [];

    for (const releaseGroup of releaseGroups) {
      const operatorState = releaseGroup?.operatorState ?? {};
      const selectionState = operatorState.selectionState ?? 'unselected';
      if (selectionState !== 'selected' && selectionState !== 'partial') {
        continue;
      }

      summary.desiredReleaseCount += 1;
      if (selectionState === 'partial') {
        incrementCount(summary, 'partialDesiredReleaseCount');
      }

      const isExplicitSelection = operatorState.isExplicitSelection === true
        || (operatorState.trackOverrideSummary?.totalCount ?? 0) > 0;
      if (isExplicitSelection) {
        incrementCount(summary, 'explicitDesiredReleaseCount');
      } else {
        incrementCount(summary, 'policyDesiredReleaseCount');
      }

      const resolvedRelease = operatorState.resolvedRelease ?? null;
      if (!resolvedRelease?.id) {
        incrementCount(summary, 'unresolvedReleaseCount');
        desiredReleases.push({
          blockReason: 'resolved_release_missing',
          discoveryRequest: null,
          eligibleForDownstreamWork: false,
          isExplicitSelection,
          metadataArtistId,
          metadataReleaseGroupId: releaseGroup.id,
          metadataReleaseId: operatorState.resolvedMetadataReleaseId ?? null,
          musicbrainzReleaseId: null,
          reconciliationStatus: null,
          releaseDate: null,
          releaseGroupTitle: releaseGroup.title ?? null,
          releaseTitle: resolvedRelease?.title ?? null,
          selectionState,
        });
        continue;
      }

      const metadataReleaseId = resolvedRelease.id;
      const reconciliation = releaseReconciliationsByReleaseId.get(metadataReleaseId) ?? null;
      const activeRequest = activeRequestsByReleaseId.get(metadataReleaseId) ?? null;
      const discoveryRequest = discoveryRequestsByReleaseId.get(metadataReleaseId) ?? null;
      const releaseDate = resolvedRelease.releaseDate ?? null;
      const releaseIsInFuture = isReleaseInFuture(releaseDate, now);

      let blockReason = null;

      if (reconciliation?.reconciliationStatus === 'complete') {
        incrementCount(summary, 'completeBlockedCount');
        blockReason = 'already_complete';
      } else if (reconciliation?.reconciliationStatus === 'duplicate') {
        incrementCount(summary, 'duplicateBlockedCount');
        blockReason = 'already_duplicate';
      } else if (activeRequest) {
        incrementCount(summary, 'activeRequestBlockedCount');
        blockReason = 'active_request_exists';
      } else if (discoveryRequest?.requestStatus === 'cooldown') {
        incrementCount(summary, 'cooldownBlockedCount');
        blockReason = 'cooldown_active';
      } else if (discoveryRequest?.requestStatus === 'ready' || discoveryRequest?.requestStatus === 'blocked') {
        incrementCount(summary, 'queuedDiscoveryCount');
        blockReason = 'discovery_request_exists';
      } else if (!isExplicitSelection && monitoring.releaseScope === 'track_only') {
        incrementCount(summary, 'trackOnlyBlockedCount');
        blockReason = 'track_only_scope';
      } else if (!isExplicitSelection && monitoring.wantedAutomationMode === 'manual_only') {
        incrementCount(summary, 'manualOnlyBlockedCount');
        blockReason = 'manual_only';
      } else if (!isExplicitSelection) {
        if (monitoring.releaseScope === 'future_only' && !releaseIsInFuture) {
          incrementCount(summary, 'futureScopeBlockedCount');
          blockReason = 'future_scope_only';
        } else if (monitoring.wantedAutomationMode === 'future_matching' && !releaseIsInFuture) {
          incrementCount(summary, 'futureScopeBlockedCount');
          blockReason = 'future_automation_only';
        }
      }

      if (blockReason === null) {
        incrementCount(summary, 'eligibleReleaseCount');
        if (releaseIsInFuture) {
          incrementCount(summary, 'futureEligibleCount');
        } else {
          incrementCount(summary, 'currentAndFutureEligibleCount');
        }
      }

      desiredReleases.push({
        activeRequest,
        blockReason,
        discoveryRequest,
        eligibleForDownstreamWork: blockReason === null,
        isExplicitSelection,
        metadataArtistId,
        metadataReleaseGroupId: releaseGroup.id,
        metadataReleaseId,
        musicbrainzReleaseId: resolvedRelease.musicbrainzReleaseId ?? null,
        reconciliationStatus: reconciliation?.reconciliationStatus ?? null,
        releaseDate,
        releaseGroupTitle: releaseGroup.title ?? null,
        releaseTitle: resolvedRelease.title ?? null,
        selectionState,
      });
    }

    return {
      desiredReleases,
      summary,
    };
  }

  return {
    buildDesiredStatePlan,
  };
}
