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
import {
  buildOperatorArtistManualEditionSelectionDraft,
  getOperatorArtistProjectionSnapshotRevision,
} from './operator-artist-manual-selection-draft.js';

function createSelectionConflictError(message) {
  const error = new Error(message);
  error.status = 409;
  error.code = 'manual_edition_selection_stale';
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

function normalizeExpectedSnapshotRevision(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw createValidationError('expectedSnapshotRevision must be a non-negative integer');
  }

  return value;
}

/**
 * Saves one operator-specific edition choice through the canonical artist save
 * workflow. The browser identifies an edition; this command derives the full
 * draft from the authoritative projection and compares its snapshot revision.
 */
export function createOperatorArtistManualEditionSelectionService({
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

  async function selectOperatorArtistReleaseEditionManually({
    appUserId,
    expectedSnapshotRevision,
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
    const normalizedExpectedSnapshotRevision = normalizeExpectedSnapshotRevision(
      expectedSnapshotRevision,
    );
    const projection = await readOperatorArtistProjection({
      appUserId: normalizedAppUserId,
      metadataArtistId: normalizedMetadataArtistId,
    });
    const currentSnapshotRevision = getOperatorArtistProjectionSnapshotRevision(projection);

    if (normalizedExpectedSnapshotRevision !== currentSnapshotRevision) {
      throw createSelectionConflictError(
        'Artist Policy changed since this edition was loaded. Refresh Artist Detail and review the current selection.',
      );
    }

    const { alreadySelected, draft } = buildOperatorArtistManualEditionSelectionDraft({
      metadataReleaseGroupId: normalizedMetadataReleaseGroupId,
      metadataReleaseId: normalizedMetadataReleaseId,
      projection,
    });
    const manualEditionSelection = {
      metadataArtistId: normalizedMetadataArtistId,
      metadataReleaseGroupId: normalizedMetadataReleaseGroupId,
      metadataReleaseId: normalizedMetadataReleaseId,
      selectionSource: 'manual',
      selectionState: 'selected',
    };

    if (alreadySelected) {
      return {
        alreadySelected: true,
        manualEditionSelection,
        projection,
        reconciliation: projection?.operator?.reconciliation ?? null,
        snapshot: projection?.operator?.reconciliation?.latestSnapshot ?? null,
      };
    }

    const result = await saveArtist({
      appUserId: normalizedAppUserId,
      draft,
      expectedSnapshotRevision: normalizedExpectedSnapshotRevision,
      metadataArtistId: normalizedMetadataArtistId,
      triggerSource: 'manual_edition_selection',
      triggeredByUserId: triggeredByUserId ?? normalizedAppUserId,
    });

    return {
      alreadySelected: false,
      manualEditionSelection,
      projection: result.projection ?? null,
      reconciliation: result.reconciliation,
      snapshot: result.snapshot,
    };
  }

  return {
    selectOperatorArtistReleaseEditionManually,
  };
}

export { buildOperatorArtistManualEditionSelectionDraft };
