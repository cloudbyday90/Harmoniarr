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
  buildOperatorArtistManualInclusionDraft,
  getOperatorArtistProjectionSnapshotRevision,
} from './operator-artist-manual-selection-draft.js';

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

export { buildOperatorArtistManualInclusionDraft };

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
    const expectedSnapshotRevision = getOperatorArtistProjectionSnapshotRevision(projection);
    const manualInclusion = {
      metadataArtistId: normalizedMetadataArtistId,
      metadataReleaseGroupId: normalizedMetadataReleaseGroupId,
      metadataReleaseId: normalizedMetadataReleaseId,
      selectionOrigin: 'manual_inclusion',
      selectionState: 'selected',
    };

    if (alreadyIncluded) {
      return {
        alreadyIncluded: true,
        manualInclusion,
        reconciliation: projection?.operator?.reconciliation ?? null,
        snapshot: projection?.operator?.reconciliation?.latestSnapshot ?? null,
        projection,
      };
    }

    const result = await saveArtist({
      appUserId: normalizedAppUserId,
      draft,
      expectedSnapshotRevision,
      metadataArtistId: normalizedMetadataArtistId,
      triggerSource: 'manual_inclusion',
      triggeredByUserId: triggeredByUserId ?? normalizedAppUserId,
    });

    return {
      alreadyIncluded: false,
      manualInclusion,
      reconciliation: result.reconciliation,
      snapshot: result.snapshot,
      projection: result.projection ?? null,
    };
  }

  return {
    includeOperatorArtistReleaseManually,
  };
}
