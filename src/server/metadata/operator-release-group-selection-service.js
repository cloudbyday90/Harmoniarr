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

import { getPool } from '../database.js';
import {
  defaultOperatorReleaseGroupSelectionPolicy,
  operatorReleaseGroupSelectionSources,
  operatorReleaseGroupSelectionStates,
} from './operator-release-group-selection-policy.js';
import { createOperatorReleaseGroupSelectionStore } from './operator-release-group-selection-store.js';

function createMetadataNotFoundError(entityType, entityId) {
  const error = new Error(`Metadata ${entityType} was not found: ${entityId}`);
  error.status = 404;
  error.code = 'metadata_not_found';
  return error;
}

function createUserNotFoundError(userId) {
  const error = new Error(`App user was not found: ${userId}`);
  error.status = 404;
  error.code = 'app_user_not_found';
  return error;
}

function createValidationError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 'validation_error';
  return error;
}

function normalizeEnumValue({ allowedValues, fallback, field, value }) {
  const resolved = typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : fallback;

  if (!allowedValues.includes(resolved)) {
    throw createValidationError(`Unsupported ${field}: ${resolved}`);
  }

  return resolved;
}

export function normalizeOperatorReleaseGroupSelectionPatch(patch = {}) {
  const {
    resolvedMetadataReleaseId = defaultOperatorReleaseGroupSelectionPolicy.resolvedMetadataReleaseId,
    selectionSource = defaultOperatorReleaseGroupSelectionPolicy.selectionSource,
    selectionState = defaultOperatorReleaseGroupSelectionPolicy.selectionState,
  } = patch;

  return {
    resolvedMetadataReleaseId: resolvedMetadataReleaseId ?? null,
    selectionSource: normalizeEnumValue({
      allowedValues: operatorReleaseGroupSelectionSources,
      fallback: defaultOperatorReleaseGroupSelectionPolicy.selectionSource,
      field: 'selection source',
      value: selectionSource,
    }),
    selectionState: normalizeEnumValue({
      allowedValues: operatorReleaseGroupSelectionStates,
      fallback: defaultOperatorReleaseGroupSelectionPolicy.selectionState,
      field: 'selection state',
      value: selectionState,
    }),
  };
}

export function createOperatorReleaseGroupSelectionService({
  getPoolFn = getPool,
  operatorReleaseGroupSelectionStore = createOperatorReleaseGroupSelectionStore(),
} = {}) {
  async function ensureUserExists(appUserId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM app_users WHERE id = $1 LIMIT 1',
      [appUserId],
    );

    if (result.rows.length === 0) {
      throw createUserNotFoundError(appUserId);
    }
  }

  async function getReleaseGroupContext(metadataReleaseGroupId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id, metadata_artist_id
        FROM metadata_release_groups
        WHERE id = $1
        LIMIT 1
      `,
      [metadataReleaseGroupId],
    );

    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('release group', metadataReleaseGroupId);
    }

    return {
      metadataArtistId: result.rows[0].metadata_artist_id,
      metadataReleaseGroupId: result.rows[0].id,
    };
  }

  async function ensureArtistExists(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      'SELECT id FROM metadata_artists WHERE id = $1 LIMIT 1',
      [metadataArtistId],
    );

    if (result.rows.length === 0) {
      throw createMetadataNotFoundError('artist', metadataArtistId);
    }
  }

  async function ensureResolvedReleaseBelongsToGroup({
    metadataReleaseGroupId,
    resolvedMetadataReleaseId,
  }) {
    if (!resolvedMetadataReleaseId) {
      return;
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT id
        FROM metadata_releases
        WHERE id = $1
          AND metadata_release_group_id = $2
        LIMIT 1
      `,
      [resolvedMetadataReleaseId, metadataReleaseGroupId],
    );

    if (result.rows.length === 0) {
      throw createValidationError(
        `Resolved release ${resolvedMetadataReleaseId} does not belong to release group ${metadataReleaseGroupId}`,
      );
    }
  }

  async function getOperatorReleaseGroupSelection({
    appUserId,
    metadataArtistId,
    metadataReleaseGroupId,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    const context = await getReleaseGroupContext(metadataReleaseGroupId);
    if (context.metadataArtistId !== metadataArtistId) {
      throw createValidationError(
        `Release group ${metadataReleaseGroupId} does not belong to artist ${metadataArtistId}`,
      );
    }

    return operatorReleaseGroupSelectionStore.getOperatorReleaseGroupSelection({
      appUserId,
      metadataReleaseGroupId,
    });
  }

  async function updateOperatorReleaseGroupSelection({
    appUserId,
    metadataArtistId,
    metadataReleaseGroupId,
    patch,
  }) {
    await Promise.all([
      ensureUserExists(appUserId),
      ensureArtistExists(metadataArtistId),
    ]);

    const context = await getReleaseGroupContext(metadataReleaseGroupId);
    if (context.metadataArtistId !== metadataArtistId) {
      throw createValidationError(
        `Release group ${metadataReleaseGroupId} does not belong to artist ${metadataArtistId}`,
      );
    }

    const normalizedPatch = normalizeOperatorReleaseGroupSelectionPatch(patch ?? {});
    await ensureResolvedReleaseBelongsToGroup({
      metadataReleaseGroupId,
      resolvedMetadataReleaseId: normalizedPatch.resolvedMetadataReleaseId,
    });

    await operatorReleaseGroupSelectionStore.upsertOperatorReleaseGroupSelection({
      ...normalizedPatch,
      appUserId,
      metadataArtistId,
      metadataReleaseGroupId,
    });

    return {
      appUserId,
      metadataArtistId,
      metadataReleaseGroupId,
      selection: normalizedPatch,
    };
  }

  return {
    getOperatorReleaseGroupSelection,
    updateOperatorReleaseGroupSelection,
  };
}
