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

function mapVisibilityRow(row) {
  if (!row) return null;

  return {
    appUserId: row.app_user_id,
    createdAt: row.created_at ?? null,
    id: row.id,
    metadataReleaseId: row.metadata_release_id,
    reason: row.reason ?? null,
    removedAt: row.removed_at ?? null,
    restoredAt: row.restored_at ?? null,
    updatedAt: row.updated_at ?? null,
    updatedByUserId: row.updated_by_user_id ?? null,
    visibilityState: row.visibility_state,
  };
}

function mapReleaseTargetRow(row) {
  if (!row) return null;

  return {
    artistName: row.artist_name ?? null,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    releaseGroupTitle: row.release_group_title ?? null,
    releaseTitle: row.release_title ?? null,
  };
}

export function createLibraryReleaseVisibilityStore({
  getPoolFn = getPool,
} = {}) {
  async function getLibraryReleaseVisibilityTarget({ metadataReleaseId }) {
    const result = await getPoolFn().query(
      `
        SELECT
          lrr.metadata_artist_id,
          lrr.metadata_release_group_id,
          lrr.metadata_release_id,
          ma.name AS artist_name,
          mrg.title AS release_group_title,
          mr.title AS release_title
        FROM library_release_reconciliations lrr
        JOIN metadata_artists ma ON ma.id = lrr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lrr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
        WHERE lrr.metadata_release_id = $1
        LIMIT 1
      `,
      [metadataReleaseId],
    );

    return mapReleaseTargetRow(result.rows[0]);
  }

  async function setLibraryReleaseVisibility({
    appUserId,
    metadataReleaseId,
    reason = null,
    updatedByUserId = null,
    visibilityState,
  }) {
    const result = await getPoolFn().query(
      `
        INSERT INTO operator_library_release_visibility (
          app_user_id,
          metadata_release_id,
          visibility_state,
          reason,
          removed_at,
          restored_at,
          updated_by_user_id,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          CASE WHEN $3 = 'removed' THEN NOW() ELSE NULL END,
          CASE WHEN $3 = 'visible' THEN NOW() ELSE NULL END,
          $5,
          NOW()
        )
        ON CONFLICT (app_user_id, metadata_release_id) DO UPDATE
        SET visibility_state = EXCLUDED.visibility_state,
            reason = EXCLUDED.reason,
            removed_at = CASE
              WHEN EXCLUDED.visibility_state = 'removed' THEN NOW()
              ELSE operator_library_release_visibility.removed_at
            END,
            restored_at = CASE
              WHEN EXCLUDED.visibility_state = 'visible' THEN NOW()
              ELSE operator_library_release_visibility.restored_at
            END,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = NOW()
        RETURNING
          id,
          app_user_id,
          metadata_release_id,
          visibility_state,
          reason,
          removed_at,
          restored_at,
          updated_by_user_id,
          created_at,
          updated_at
      `,
      [appUserId, metadataReleaseId, visibilityState, reason, updatedByUserId],
    );

    return mapVisibilityRow(result.rows[0]);
  }

  return {
    getLibraryReleaseVisibilityTarget,
    setLibraryReleaseVisibility,
  };
}
