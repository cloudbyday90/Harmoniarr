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

function normalizeStatus(status) {
  return typeof status === 'string' && status.trim().length > 0
    ? status.trim().toLowerCase()
    : 'missing';
}

function toTimestamp(value) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function newestTimestamp(left, right) {
  return toTimestamp(left) >= toTimestamp(right) ? left : right;
}

export function listDesiredReleaseIds(effectiveReleaseGroups = []) {
  const releaseIds = [];
  const seen = new Set();

  for (const releaseGroup of effectiveReleaseGroups) {
    const selectionState = releaseGroup?.operatorState?.selectionState;
    const releaseId = releaseGroup?.operatorState?.resolvedMetadataReleaseId;
    if ((selectionState !== 'selected' && selectionState !== 'partial') || !releaseId || seen.has(releaseId)) {
      continue;
    }

    seen.add(releaseId);
    releaseIds.push(releaseId);
  }

  return releaseIds;
}

export function summarizeOperatorArtistCoverage({
  effectiveReleaseGroups = [],
  libraryReleaseReconciliations = [],
} = {}) {
  const desiredReleaseIds = listDesiredReleaseIds(effectiveReleaseGroups);
  const reconciliationByReleaseId = new Map(
    libraryReleaseReconciliations.map((reconciliation) => [
      reconciliation.metadataReleaseId,
      reconciliation,
    ]),
  );

  const summary = {
    acquiredReleaseCount: 0,
    desiredReleaseCount: desiredReleaseIds.length,
    duplicateReleaseCount: 0,
    lastReconciledAt: null,
    missingReleaseCount: 0,
    partialReleaseCount: 0,
    unresolvedReleaseCount: 0,
  };

  for (const releaseGroup of effectiveReleaseGroups) {
    const selectionState = releaseGroup?.operatorState?.selectionState;
    if (selectionState !== 'selected' && selectionState !== 'partial') {
      continue;
    }

    const releaseId = releaseGroup?.operatorState?.resolvedMetadataReleaseId;
    if (!releaseId) {
      summary.unresolvedReleaseCount += 1;
      continue;
    }

    const reconciliation = reconciliationByReleaseId.get(releaseId);
    if (!reconciliation) {
      summary.missingReleaseCount += 1;
      continue;
    }

    summary.lastReconciledAt = newestTimestamp(
      summary.lastReconciledAt,
      reconciliation.lastReconciledAt,
    );

    switch (normalizeStatus(reconciliation.reconciliationStatus)) {
      case 'complete':
        summary.acquiredReleaseCount += 1;
        break;
      case 'duplicate':
        summary.acquiredReleaseCount += 1;
        summary.duplicateReleaseCount += 1;
        break;
      case 'partial':
        summary.partialReleaseCount += 1;
        break;
      default:
        summary.missingReleaseCount += 1;
        break;
    }
  }

  return {
    ...summary,
    coverageRatio: summary.desiredReleaseCount > 0
      ? summary.acquiredReleaseCount / summary.desiredReleaseCount
      : 0,
  };
}
