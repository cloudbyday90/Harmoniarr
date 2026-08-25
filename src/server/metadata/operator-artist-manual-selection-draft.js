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

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function createSelectionConflictError(code, message) {
  const error = new Error(message);
  error.status = 409;
  error.code = code;
  return error;
}

function copyReleaseGroupSelections(selections = []) {
  return selections.map((selection) => ({
    metadataReleaseGroupId: selection.metadataReleaseGroupId,
    resolvedMetadataReleaseId: selection.resolvedMetadataReleaseId ?? null,
    selectionOrigin: selection.selectionOrigin ?? null,
    selectionSource: selection.selectionSource ?? 'manual',
    selectionState: selection.selectionState ?? 'selected',
  }));
}

function copyTrackOverrides(trackOverrides = []) {
  return trackOverrides.map((trackOverride) => ({
    isDesired: trackOverride.isDesired === true,
    mediumPosition: trackOverride.mediumPosition ?? null,
    metadataReleaseGroupId: trackOverride.metadataReleaseGroupId,
    metadataReleaseId: trackOverride.metadataReleaseId ?? null,
    recordingMbid: trackOverride.recordingMbid ?? null,
    remapStatus: trackOverride.remapStatus ?? 'resolved',
    trackLengthMsSnapshot: trackOverride.trackLengthMsSnapshot ?? null,
    trackMbid: trackOverride.trackMbid ?? null,
    trackPosition: trackOverride.trackPosition ?? null,
    trackTitleSnapshot: trackOverride.trackTitleSnapshot ?? null,
  }));
}

function getManualSelectionContext({
  metadataReleaseGroupId,
  metadataReleaseId,
  projection,
  unavailableCode = 'manual_selection_unavailable',
}) {
  const monitoring = projection?.operator?.monitoring;
  if (monitoring?.isMonitored !== true) {
    throw createSelectionConflictError(
      unavailableCode,
      'Manual selection is available only for a monitored artist',
    );
  }

  const releaseGroup = (projection.releaseGroups ?? [])
    .find((candidate) => candidate?.id === metadataReleaseGroupId);
  if (!releaseGroup) {
    throw createMetadataNotFoundError('release group', metadataReleaseGroupId);
  }

  const resolvedRelease = (projection.releases ?? [])
    .find((candidate) => candidate?.id === metadataReleaseId);
  if (!resolvedRelease || resolvedRelease.releaseGroupId !== metadataReleaseGroupId) {
    throw createSelectionConflictError(
      unavailableCode,
      'This edition is no longer available for the selected release group. Refresh Artist Detail and try again.',
    );
  }

  return {
    monitoring,
    operatorState: releaseGroup.operatorState ?? {},
    releaseGroup,
    resolvedRelease,
  };
}

function buildManualSelectedDraft({
  metadataReleaseGroupId,
  metadataReleaseId,
  monitoring,
  projection,
  selectionOrigin,
}) {
  const existingSelections = copyReleaseGroupSelections(
    Array.isArray(projection?.operator?.releaseGroupSelections)
      ? projection.operator.releaseGroupSelections
      : [],
  ).filter((selection) => selection.metadataReleaseGroupId !== metadataReleaseGroupId);

  existingSelections.push({
    metadataReleaseGroupId,
    resolvedMetadataReleaseId: metadataReleaseId,
    selectionOrigin,
    selectionSource: 'manual',
    selectionState: 'selected',
  });

  return {
    monitoring: {
      ...monitoring,
      isMonitored: true,
      selectionSourceMode: 'policy_plus_overrides',
    },
    releaseGroupSelections: existingSelections,
    trackOverrides: copyTrackOverrides(
      Array.isArray(projection?.operator?.trackOverrides)
        ? projection.operator.trackOverrides
        : [],
    ),
  };
}

function hasReleaseGroupTrackOverrides(projection, metadataReleaseGroupId) {
  return Array.isArray(projection?.operator?.trackOverrides)
    && projection.operator.trackOverrides.some(
      (trackOverride) => trackOverride?.metadataReleaseGroupId === metadataReleaseGroupId,
    );
}

/**
 * Returns the snapshot revision visible in a user-scoped operator projection.
 * Zero is the durable empty-history value used for a monitored artist before
 * its first snapshot exists.
 */
export function getOperatorArtistProjectionSnapshotRevision(projection) {
  const snapshotRevision = projection?.operator?.reconciliation?.latestSnapshot?.snapshotRevision;
  return Number.isSafeInteger(snapshotRevision) && snapshotRevision >= 0
    ? snapshotRevision
    : 0;
}

/**
 * Builds the narrow Missing Music command draft. It may only make the current
 * policy-selected release a manual inclusion; it cannot choose another edition.
 */
export function buildOperatorArtistManualInclusionDraft({
  metadataReleaseGroupId,
  metadataReleaseId,
  projection,
}) {
  const {
    monitoring,
    operatorState,
  } = getManualSelectionContext({
    metadataReleaseGroupId,
    metadataReleaseId,
    projection,
    unavailableCode: 'manual_inclusion_unavailable',
  });
  const currentResolvedReleaseId = operatorState.resolvedMetadataReleaseId ?? null;

  if (operatorState.selectionSource === 'manual' || operatorState.isExplicitSelection === true) {
    if (
      operatorState.selectionState === 'selected'
      && currentResolvedReleaseId === metadataReleaseId
    ) {
      return { alreadyIncluded: true, draft: null };
    }

    throw createSelectionConflictError(
      'manual_inclusion_unavailable',
      'This release group already has a different manual selection. Edit it from Artist Detail.',
    );
  }

  if (
    operatorState.selectionSource !== 'policy'
    || operatorState.selectionState !== 'selected'
    || currentResolvedReleaseId !== metadataReleaseId
  ) {
    throw createSelectionConflictError(
      'manual_inclusion_unavailable',
      'This release is no longer selected by policy. Refresh Missing Music and try again.',
    );
  }

  return {
    alreadyIncluded: false,
    draft: buildManualSelectedDraft({
      metadataReleaseGroupId,
      metadataReleaseId,
      monitoring,
      projection,
      selectionOrigin: 'manual_inclusion',
    }),
  };
}

/**
 * Builds the Artist Detail command draft for a specific valid local edition.
 * Partial selections and track overrides are intentionally excluded because
 * their track mapping must be reviewed before an edition can change.
 */
export function buildOperatorArtistManualEditionSelectionDraft({
  metadataReleaseGroupId,
  metadataReleaseId,
  projection,
}) {
  const {
    monitoring,
    operatorState,
  } = getManualSelectionContext({
    metadataReleaseGroupId,
    metadataReleaseId,
    projection,
    unavailableCode: 'manual_edition_selection_unavailable',
  });
  const currentResolvedReleaseId = operatorState.resolvedMetadataReleaseId ?? null;

  if (
    operatorState.selectionSource === 'manual'
    && operatorState.selectionState === 'selected'
    && currentResolvedReleaseId === metadataReleaseId
  ) {
    return { alreadySelected: true, draft: null };
  }

  if (
    operatorState.selectionState === 'partial'
    || hasReleaseGroupTrackOverrides(projection, metadataReleaseGroupId)
  ) {
    throw createSelectionConflictError(
      'manual_edition_selection_requires_track_review',
      'Review this release group\'s track overrides in Artist Policy before choosing another edition.',
    );
  }

  return {
    alreadySelected: false,
    draft: buildManualSelectedDraft({
      metadataReleaseGroupId,
      metadataReleaseId,
      monitoring,
      projection,
      selectionOrigin: 'manual_edition',
    }),
  };
}
