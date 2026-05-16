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
import { getPool } from '../database.js';
import {
  listArtworkAssignments,
  refreshArtworkAssetAssignmentState,
  upsertArtworkAssignment,
  deleteStaleArtworkAssignments,
} from './artwork-repository.js';

function normalizeRequiredString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', `${fieldName} must be a non-empty string`);
  }

  return value.trim();
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeAssignmentInput({
  artworkAssetId,
  artworkRole,
  observedAt = null,
  ownerId,
  ownerType,
  priority = 0,
  sourceProvider = null,
  sourceReference = null,
}) {
  const normalizedArtworkAssetId = normalizeRequiredString(artworkAssetId, 'artworkAssetId');
  const normalizedArtworkRole = normalizeRequiredString(artworkRole, 'artworkRole');
  const normalizedOwnerId = normalizeRequiredString(ownerId, 'ownerId');
  const normalizedOwnerType = normalizeRequiredString(ownerType, 'ownerType');

  if (!Number.isInteger(priority) || priority < 0 || priority > 100000) {
    throw createApiError(400, 'validation_error', 'priority must be an integer between 0 and 100000');
  }

  return {
    artworkAssetId: normalizedArtworkAssetId,
    artworkRole: normalizedArtworkRole,
    observedAt,
    ownerId: normalizedOwnerId,
    ownerType: normalizedOwnerType,
    priority,
    sourceProvider: normalizeOptionalString(sourceProvider),
    sourceReference: normalizeOptionalString(sourceReference),
  };
}

function compareAssignmentCandidates(left, right) {
  if ((left.priority ?? 100) !== (right.priority ?? 100)) {
    return (left.priority ?? 100) - (right.priority ?? 100);
  }

  const leftCreatedAt = left.createdAt ?? '';
  const rightCreatedAt = right.createdAt ?? '';
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return String(left.id ?? '').localeCompare(String(right.id ?? ''));
}

async function demotePreferredAssignments({ artworkRole, ownerId, ownerType, exceptArtworkAssetId = null }, client) {
  const values = [ownerType, ownerId, artworkRole];
  let filterSql = '';

  if (exceptArtworkAssetId) {
    values.push(exceptArtworkAssetId);
    filterSql = ' AND artwork_asset_id <> $4';
  }

  await client.query(
    `
      UPDATE artwork_assignments
      SET is_preferred = FALSE,
          updated_at = NOW()
      WHERE owner_type = $1
        AND owner_id = $2
        AND artwork_role = $3
        AND is_preferred = TRUE${filterSql}
    `,
    values,
  );
}

async function promoteAssignment({ artworkAssetId, artworkRole, ownerId, ownerType }, client) {
  await client.query(
    `
      UPDATE artwork_assignments
      SET is_preferred = TRUE,
          updated_at = NOW()
      WHERE owner_type = $1
        AND owner_id = $2
        AND artwork_role = $3
        AND artwork_asset_id = $4
    `,
    [ownerType, ownerId, artworkRole, artworkAssetId],
  );
}

function collectArtworkAssetIds(...values) {
  return [...new Set(values.flatMap((value) => {
    if (Array.isArray(value)) {
      return value;
    }

    return typeof value === 'string' ? [value] : [];
  }).filter((artworkAssetId) => typeof artworkAssetId === 'string' && artworkAssetId.trim().length > 0))];
}

export function createArtworkAssignmentService({
  getPoolFn = getPool,
  listArtworkAssignmentsFn = listArtworkAssignments,
  refreshArtworkAssetAssignmentStateFn = refreshArtworkAssetAssignmentState,
  upsertArtworkAssignmentFn = upsertArtworkAssignment,
  deleteStaleArtworkAssignmentsFn = deleteStaleArtworkAssignments,
} = {}) {
  async function assignPreferredArtwork({
    artworkAssetId,
    artworkRole,
    observedAt = null,
    ownerId,
    ownerType,
    priority = 0,
    sourceProvider = null,
    sourceReference = null,
  }) {
    const normalized = normalizeAssignmentInput({
      artworkAssetId,
      artworkRole,
      observedAt,
      ownerId,
      ownerType,
      priority,
      sourceProvider,
      sourceReference,
    });

    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await demotePreferredAssignments({
        artworkRole: normalized.artworkRole,
        exceptArtworkAssetId: normalized.artworkAssetId,
        ownerId: normalized.ownerId,
        ownerType: normalized.ownerType,
      }, client);

      const assignment = await upsertArtworkAssignmentFn({
        artworkAssetId: normalized.artworkAssetId,
        artworkRole: normalized.artworkRole,
        isPreferred: true,
        observedAt: normalized.observedAt,
        ownerId: normalized.ownerId,
        ownerType: normalized.ownerType,
        priority: normalized.priority,
        sourceProvider: normalized.sourceProvider,
        sourceReference: normalized.sourceReference,
      }, client);
      await refreshArtworkAssetAssignmentStateFn([normalized.artworkAssetId], client);

      await client.query('COMMIT');
      return assignment;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function reconcilePreferredArtwork({
    artworkAssetId,
    artworkRole,
    observedAt = null,
    ownerId,
    ownerType,
    priority = 0,
    sourceProvider = null,
    sourceReference = null,
  }) {
    const normalized = normalizeAssignmentInput({
      artworkAssetId,
      artworkRole,
      observedAt,
      ownerId,
      ownerType,
      priority,
      sourceProvider,
      sourceReference,
    });
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (normalized.sourceProvider) {
        const deletedSourceAssignments = await client.query(
          `
            DELETE FROM artwork_assignments
            WHERE owner_type = $1
              AND owner_id = $2
              AND artwork_role = $3
              AND source_provider = $4
              AND artwork_asset_id <> $5
          `,
          [
            normalized.ownerType,
            normalized.ownerId,
            normalized.artworkRole,
            normalized.sourceProvider,
            normalized.artworkAssetId,
          ],
        );

        const deletedArtworkAssetIds = deletedSourceAssignments.rows?.map((row) => row.artwork_asset_id) ?? [];
        if (deletedArtworkAssetIds.length > 0) {
          deletedSourceAssignments.deletedArtworkAssetIds = deletedArtworkAssetIds;
        }
      }

      const roleAssignments = (await listArtworkAssignmentsFn({
        ownerId: normalized.ownerId,
        ownerType: normalized.ownerType,
      }, client)).filter((assignment) => assignment.artworkRole === normalized.artworkRole);
      const preferredAssignment = roleAssignments.find((assignment) => assignment.isPreferred) ?? null;
      const shouldPromoteIncoming = !preferredAssignment
        || preferredAssignment.artworkAssetId === normalized.artworkAssetId
        || normalized.priority < preferredAssignment.priority
        || (
          normalized.priority === preferredAssignment.priority
          && normalized.sourceProvider
          && preferredAssignment.sourceProvider === normalized.sourceProvider
        );

      if (shouldPromoteIncoming) {
        await demotePreferredAssignments({
          artworkRole: normalized.artworkRole,
          exceptArtworkAssetId: normalized.artworkAssetId,
          ownerId: normalized.ownerId,
          ownerType: normalized.ownerType,
        }, client);
      }

      const assignment = await upsertArtworkAssignmentFn({
        artworkAssetId: normalized.artworkAssetId,
        artworkRole: normalized.artworkRole,
        isPreferred: shouldPromoteIncoming,
        observedAt: normalized.observedAt,
        ownerId: normalized.ownerId,
        ownerType: normalized.ownerType,
        priority: normalized.priority,
        sourceProvider: normalized.sourceProvider,
        sourceReference: normalized.sourceReference,
      }, client);
      await refreshArtworkAssetAssignmentStateFn([normalized.artworkAssetId], client);

      await client.query('COMMIT');
      return {
        assignment,
        promotedToPreferred: shouldPromoteIncoming,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function clearArtworkSource({
    artworkRole,
    ownerId,
    ownerType,
    sourceProvider,
  }) {
    const normalizedArtworkRole = normalizeRequiredString(artworkRole, 'artworkRole');
    const normalizedOwnerId = normalizeRequiredString(ownerId, 'ownerId');
    const normalizedOwnerType = normalizeRequiredString(ownerType, 'ownerType');
    const normalizedSourceProvider = normalizeRequiredString(sourceProvider, 'sourceProvider');
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const deleteResult = await client.query(
        `
          DELETE FROM artwork_assignments
          WHERE owner_type = $1
            AND owner_id = $2
            AND artwork_role = $3
            AND source_provider = $4
          RETURNING artwork_asset_id
        `,
        [normalizedOwnerType, normalizedOwnerId, normalizedArtworkRole, normalizedSourceProvider],
      );

      const remainingAssignments = (await listArtworkAssignmentsFn({
        ownerId: normalizedOwnerId,
        ownerType: normalizedOwnerType,
      }, client)).filter((assignment) => assignment.artworkRole === normalizedArtworkRole);

      await demotePreferredAssignments({
        artworkRole: normalizedArtworkRole,
        ownerId: normalizedOwnerId,
        ownerType: normalizedOwnerType,
      }, client);

      const nextPreferredAssignment = [...remainingAssignments]
        .sort(compareAssignmentCandidates)[0] ?? null;
      if (nextPreferredAssignment) {
        await promoteAssignment({
          artworkAssetId: nextPreferredAssignment.artworkAssetId,
          artworkRole: normalizedArtworkRole,
          ownerId: normalizedOwnerId,
          ownerType: normalizedOwnerType,
        }, client);
      }

      await refreshArtworkAssetAssignmentStateFn(
        collectArtworkAssetIds(deleteResult.rows?.map((row) => row.artwork_asset_id) ?? []),
        client,
      );

      await client.query('COMMIT');
      return {
        clearedCount: deleteResult.rowCount ?? 0,
        promotedArtworkAssetId: nextPreferredAssignment?.artworkAssetId ?? null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function removeStaleAssignments({
    artworkAssetId,
    artworkRole,
    ownerId,
    ownerType,
  }) {
    const normalizedArtworkAssetId = normalizeRequiredString(artworkAssetId, 'artworkAssetId');
    const normalizedArtworkRole = normalizeRequiredString(artworkRole, 'artworkRole');
    const normalizedOwnerId = normalizeRequiredString(ownerId, 'ownerId');
    const normalizedOwnerType = normalizeRequiredString(ownerType, 'ownerType');
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const removedAssetIds = await deleteStaleArtworkAssignmentsFn({
        artworkRole: normalizedArtworkRole,
        exceptArtworkAssetId: normalizedArtworkAssetId,
        ownerId: normalizedOwnerId,
        ownerType: normalizedOwnerType,
      }, client);

      const affectedAssetIds = collectArtworkAssetIds(removedAssetIds, normalizedArtworkAssetId);
      if (affectedAssetIds.length > 0) {
        await refreshArtworkAssetAssignmentStateFn(affectedAssetIds, client);
      }

      await client.query('COMMIT');
      return { removedCount: removedAssetIds.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    assignPreferredArtwork,
    clearArtworkSource,
    reconcilePreferredArtwork,
    removeStaleAssignments,
  };
}