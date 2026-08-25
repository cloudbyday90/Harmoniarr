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

import { createOperatorArtistProjectionService } from './operator-artist-projection-service.js';
import { createOperatorArtistSaveService } from './operator-artist-save-service.js';

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function createSelectionConflictError(message) {
  const error = new Error(message);
  error.status = 409;
  error.code = 'manual_inclusion_unavailable';
  return error;
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'validation_error';
  return error;
}

function normalizeRequiredIdentifier(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${field} is required`);
  }

  return value.trim();
}

function copyReleaseGroupSelections(selections = []) {
  return selections.map((selection) => ({
    metadataReleaseGroupId: selection.metadataReleaseGroupId,
    resolvedMetadataReleaseId: selection.resolvedMetadataReleaseId ?? null,
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

/**
 * Builds the full artist draft used by the canonical save service. The command
 * is deliberately limited to making an existing policy-selected release a
 * manual inclusion; it cannot select another artist's release or overwrite a
 * partial/manual choice.
 */
export function buildOperatorArtistManualInclusionDraft({
  metadataReleaseGroupId,
  metadataReleaseId,
  projection,
}) {
  const monitoring = projection?.operator?.monitoring;
  if (monitoring?.isMonitored !== true) {
    throw createSelectionConflictError('Manual inclusion is available only for a monitored artist');
  }

  const releaseGroup = (projection.releaseGroups ?? [])
    .find((candidate) => candidate?.id === metadataReleaseGroupId);
  if (!releaseGroup) {
    throw createMetadataNotFoundError('release group', metadataReleaseGroupId);
  }

  const operatorState = releaseGroup.operatorState ?? {};
  const currentResolvedReleaseId = operatorState.resolvedMetadataReleaseId ?? null;
  if (operatorState.selectionSource === 'manual' || operatorState.isExplicitSelection === true) {
    if (
      operatorState.selectionState === 'selected'
      && currentResolvedReleaseId === metadataReleaseId
    ) {
      return { alreadyIncluded: true, draft: null };
    }

    throw createSelectionConflictError(
      'This release group already has a different manual selection. Edit it from the artist detail page.',
    );
  }

  if (
    operatorState.selectionSource !== 'policy'
    || operatorState.selectionState !== 'selected'
    || currentResolvedReleaseId !== metadataReleaseId
  ) {
    throw createSelectionConflictError(
      'This release is no longer selected by policy. Refresh Missing Music and try again.',
    );
  }

  const resolvedRelease = (projection.releases ?? [])
    .find((candidate) => candidate?.id === metadataReleaseId);
  if (!resolvedRelease || resolvedRelease.releaseGroupId !== metadataReleaseGroupId) {
    throw createSelectionConflictError(
      'This release is no longer available for the selected release group. Refresh Missing Music and try again.',
    );
  }

  const existingSelections = copyReleaseGroupSelections(
    Array.isArray(projection?.operator?.releaseGroupSelections)
      ? projection.operator.releaseGroupSelections
      : [],
  ).filter((selection) => selection.metadataReleaseGroupId !== metadataReleaseGroupId);

  existingSelections.push({
    metadataReleaseGroupId,
    resolvedMetadataReleaseId: metadataReleaseId,
    selectionSource: 'manual',
    selectionState: 'selected',
  });

  return {
    alreadyIncluded: false,
    draft: {
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
    },
  };
}

/**
 * Saves a narrow manual-inclusion command through the canonical artist save
 * workflow. This ensures the change is snapshot-backed and reconciliation is
 * queued alongside the durable selection update.
 */
export function createOperatorArtistManualInclusionService({
  getOperatorArtistProjection = null,
  operatorArtistProjectionService = null,
  operatorArtistSaveService = null,
  saveOperatorArtist = null,
} = {}) {
  const resolvedProjectionService = operatorArtistProjectionService
    ?? createOperatorArtistProjectionService();
  const readOperatorArtistProjection = getOperatorArtistProjection
    ?? resolvedProjectionService.getOperatorArtistProjection;
  const resolvedSaveService = operatorArtistSaveService ?? createOperatorArtistSaveService();
  const saveArtist = saveOperatorArtist ?? resolvedSaveService.saveOperatorArtist;

  async function includeOperatorArtistReleaseManually({
    appUserId,
    metadataArtistId,
    metadataReleaseGroupId,
    metadataReleaseId,
    triggeredByUserId = null,
  }) {
    const normalizedAppUserId = normalizeRequiredIdentifier(appUserId, 'appUserId');
    const normalizedMetadataArtistId = normalizeRequiredIdentifier(metadataArtistId, 'metadataArtistId');
    const normalizedMetadataReleaseGroupId = normalizeRequiredIdentifier(
      metadataReleaseGroupId,
      'metadataReleaseGroupId',
    );
    const normalizedMetadataReleaseId = normalizeRequiredIdentifier(
      metadataReleaseId,
      'metadataReleaseId',
    );
    const projection = await readOperatorArtistProjection({
      appUserId: normalizedAppUserId,
      metadataArtistId: normalizedMetadataArtistId,
    });
    const { alreadyIncluded, draft } = buildOperatorArtistManualInclusionDraft({
      metadataReleaseGroupId: normalizedMetadataReleaseGroupId,
      metadataReleaseId: normalizedMetadataReleaseId,
      projection,
    });
    const manualInclusion = {
      metadataArtistId: normalizedMetadataArtistId,
      metadataReleaseGroupId: normalizedMetadataReleaseGroupId,
      metadataReleaseId: normalizedMetadataReleaseId,
      selectionState: 'selected',
    };

    if (alreadyIncluded) {
      return {
        alreadyIncluded: true,
        manualInclusion,
        reconciliation: projection?.operator?.reconciliation ?? null,
        snapshot: projection?.operator?.reconciliation?.latestSnapshot ?? null,
      };
    }

    const result = await saveArtist({
      appUserId: normalizedAppUserId,
      draft,
      metadataArtistId: normalizedMetadataArtistId,
      triggerSource: 'manual_inclusion',
      triggeredByUserId: triggeredByUserId ?? normalizedAppUserId,
    });

    return {
      alreadyIncluded: false,
      manualInclusion,
      reconciliation: result.reconciliation,
      snapshot: result.snapshot,
    };
  }

  return {
    includeOperatorArtistReleaseManually,
  };
}
