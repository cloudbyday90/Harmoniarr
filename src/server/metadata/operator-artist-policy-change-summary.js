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

const monitoredReleaseGroupTypeField = 'monitoredReleaseGroupTypes';
const reviewStatuses = new Set(['review_needed', 'orphaned']);

const monitoringFields = Object.freeze([
  'acquisitionProfileKey',
  'isMonitored',
  monitoredReleaseGroupTypeField,
  'releaseScope',
  'searchOnAddMode',
  'selectionSourceMode',
  'wantedAutomationMode',
]);

function sortedStrings(values) {
  return Array.isArray(values)
    ? [...values].map((value) => String(value)).sort()
    : [];
}

function normalizeCompareValue(value, field) {
  if (field === monitoredReleaseGroupTypeField) {
    return sortedStrings(value);
  }
  return value ?? null;
}

function valuesAreEqual(left, right, field) {
  const normalizedLeft = normalizeCompareValue(left, field);
  const normalizedRight = normalizeCompareValue(right, field);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function buildTrackOverrideIdentityKey(trackOverride = {}) {
  if (trackOverride.trackMbid) {
    return `track:${trackOverride.metadataReleaseGroupId}:${trackOverride.trackMbid}`;
  }

  return [
    'fallback',
    trackOverride.metadataReleaseGroupId,
    trackOverride.metadataReleaseId ?? '',
    trackOverride.recordingMbid ?? '',
    trackOverride.mediumPosition ?? '',
    trackOverride.trackPosition ?? '',
  ].join(':');
}

function buildReleaseSelectionIdentityKey(selection = {}) {
  return selection.metadataReleaseGroupId ?? '';
}

function indexByKey(items, buildKey) {
  return new Map(
    (Array.isArray(items) ? items : [])
      .map((item) => [buildKey(item), item])
      .filter(([key]) => key.length > 0),
  );
}

function releaseSelectionChanged(previous = {}, next = {}) {
  return previous.selectionState !== next.selectionState
    || (previous.selectionOrigin ?? null) !== (next.selectionOrigin ?? null)
    || previous.selectionSource !== next.selectionSource
    || (previous.resolvedMetadataReleaseId ?? null) !== (next.resolvedMetadataReleaseId ?? null);
}

function trackOverrideChanged(previous = {}, next = {}) {
  return previous.isDesired !== next.isDesired
    || previous.remapStatus !== next.remapStatus
    || (previous.metadataReleaseId ?? null) !== (next.metadataReleaseId ?? null)
    || (previous.recordingMbid ?? null) !== (next.recordingMbid ?? null)
    || (previous.mediumPosition ?? null) !== (next.mediumPosition ?? null)
    || (previous.trackPosition ?? null) !== (next.trackPosition ?? null)
    || (previous.trackTitleSnapshot ?? null) !== (next.trackTitleSnapshot ?? null)
    || (previous.trackLengthMsSnapshot ?? null) !== (next.trackLengthMsSnapshot ?? null);
}

function summarizeMapDiff({ buildKey, changedPredicate, nextItems, previousItems }) {
  const previousByKey = indexByKey(previousItems, buildKey);
  const nextByKey = indexByKey(nextItems, buildKey);
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const [key, nextItem] of nextByKey.entries()) {
    const previousItem = previousByKey.get(key);
    if (!previousItem) {
      added += 1;
    } else if (changedPredicate(previousItem, nextItem)) {
      changed += 1;
    }
  }

  for (const key of previousByKey.keys()) {
    if (!nextByKey.has(key)) {
      removed += 1;
    }
  }

  return {
    added,
    changed,
    removed,
    totalAfter: nextByKey.size,
    totalBefore: previousByKey.size,
  };
}

function summarizeMonitoringChanges({ nextMonitoring = {}, previousMonitoring = {} }) {
  const changedFields = monitoringFields.filter((field) => (
    !valuesAreEqual(previousMonitoring[field], nextMonitoring[field], field)
  ));

  return {
    becameMonitored: previousMonitoring.isMonitored !== true && nextMonitoring.isMonitored === true,
    becameUnmonitored: previousMonitoring.isMonitored === true && nextMonitoring.isMonitored !== true,
    changedFields,
    changedFieldCount: changedFields.length,
  };
}

function summarizeTrackReviewChanges({ nextTrackOverrides = [], previousTrackOverrides = [] }) {
  const previousByKey = indexByKey(previousTrackOverrides, buildTrackOverrideIdentityKey);
  const nextByKey = indexByKey(nextTrackOverrides, buildTrackOverrideIdentityKey);
  let clearedReviewCount = 0;
  let resolvedReviewCount = 0;
  let reviewAddedCount = 0;
  let reviewRemainingCount = 0;

  for (const [key, previousOverride] of previousByKey.entries()) {
    if (!reviewStatuses.has(previousOverride.remapStatus)) {
      continue;
    }

    const nextOverride = nextByKey.get(key);
    if (!nextOverride) {
      clearedReviewCount += 1;
    } else if (nextOverride.remapStatus === 'resolved') {
      resolvedReviewCount += 1;
    }
  }

  for (const [key, nextOverride] of nextByKey.entries()) {
    if (!reviewStatuses.has(nextOverride.remapStatus)) {
      continue;
    }
    reviewRemainingCount += 1;
    const previousOverride = previousByKey.get(key);
    if (!previousOverride || !reviewStatuses.has(previousOverride.remapStatus)) {
      reviewAddedCount += 1;
    }
  }

  return {
    clearedReviewCount,
    resolvedReviewCount,
    reviewAddedCount,
    reviewRemainingCount,
  };
}

export function buildOperatorArtistPolicyChangeSummary({
  metadataArtistId,
  nextMonitoring,
  nextReleaseGroupSelections,
  nextTrackOverrides,
  previousMonitoring,
  previousReleaseGroupSelections,
  previousTrackOverrides,
  reconciliation,
  snapshot,
}) {
  const monitoring = summarizeMonitoringChanges({ nextMonitoring, previousMonitoring });
  const releaseGroups = summarizeMapDiff({
    buildKey: buildReleaseSelectionIdentityKey,
    changedPredicate: releaseSelectionChanged,
    nextItems: nextReleaseGroupSelections,
    previousItems: previousReleaseGroupSelections,
  });
  const trackOverrides = {
    ...summarizeMapDiff({
      buildKey: buildTrackOverrideIdentityKey,
      changedPredicate: trackOverrideChanged,
      nextItems: nextTrackOverrides,
      previousItems: previousTrackOverrides,
    }),
    ...summarizeTrackReviewChanges({ nextTrackOverrides, previousTrackOverrides }),
  };
  const totalChangeCount = monitoring.changedFieldCount
    + releaseGroups.added
    + releaseGroups.changed
    + releaseGroups.removed
    + trackOverrides.added
    + trackOverrides.changed
    + trackOverrides.removed;

  return {
    changes: {
      monitoring,
      releaseGroups,
      trackOverrides,
      totalChangeCount,
    },
    hasChanges: totalChangeCount > 0,
    metadataArtistId,
    presentationType: 'artist_policy_saved',
    reconciliation: {
      coalesced: reconciliation?.coalesced === true,
      queuedBehindRun: reconciliation?.queuedBehindRun === true,
      runId: reconciliation?.run?.id ?? null,
      runStatus: reconciliation?.run?.status ?? null,
    },
    schemaVersion: 1,
    snapshot: {
      id: snapshot?.id ?? null,
      snapshotRevision: snapshot?.snapshotRevision ?? null,
    },
  };
}
