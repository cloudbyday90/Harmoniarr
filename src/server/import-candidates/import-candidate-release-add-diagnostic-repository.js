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

function mapScopedRelease(row) {
  if (!row) {
    return null;
  }

  return {
    artistName: row.artist_name,
    id: row.id,
    releaseTitle: row.release_title,
  };
}

function mapApplyOutcome(row) {
  return {
    applySnapshot: row.apply_snapshot ?? {},
    importCandidateId: row.import_candidate_id,
    itemStatus: row.item_status,
    updatedAt: row.updated_at,
  };
}

export function createImportCandidateReleaseAddDiagnosticRepository({
  getPoolFn = getPool,
} = {}) {
  async function getScopedWantedRelease({ appUserId, wantedReleaseId }, queryable) {
    const db = queryable ?? getPoolFn();
    const result = await db.query(
      `
        SELECT
          lwr.id,
          ma.name AS artist_name,
          mr.title AS release_title
        FROM library_wanted_releases lwr
        JOIN metadata_artists ma ON ma.id = lwr.metadata_artist_id
        JOIN metadata_releases mr ON mr.id = lwr.metadata_release_id
        WHERE lwr.id = $1::uuid
          AND lwr.app_user_id = $2::uuid
        LIMIT 1
      `,
      [wantedReleaseId, appUserId],
    );

    return mapScopedRelease(result.rows[0]);
  }

  async function listLatestReleaseAddOutcomes({ limit, wantedReleaseId }, queryable) {
    const db = queryable ?? getPoolFn();
    const result = await db.query(
      `
        WITH latest_candidate_outcomes AS (
          SELECT DISTINCT ON (apply_items.import_candidate_id)
            apply_items.import_candidate_id,
            apply_items.item_status,
            apply_items.apply_snapshot,
            apply_items.updated_at,
            apply_items.created_at,
            apply_items.id
          FROM import_apply_run_items apply_items
          JOIN import_candidates candidates
            ON candidates.id = apply_items.import_candidate_id
          WHERE (
            COALESCE(
              apply_items.apply_snapshot #>> '{candidate,musicQueueContext,wantedReleaseId}',
              candidates.normalized_payload #>> '{musicQueueContext,wantedReleaseId}',
              ''
            ) = $1
            OR (
              jsonb_typeof(apply_items.apply_snapshot #> '{candidate,musicQueueContext,wantedReleaseIds}') = 'array'
              AND apply_items.apply_snapshot #> '{candidate,musicQueueContext,wantedReleaseIds}' ? $1
            )
            OR (
              jsonb_typeof(candidates.normalized_payload #> '{musicQueueContext,wantedReleaseIds}') = 'array'
              AND candidates.normalized_payload #> '{musicQueueContext,wantedReleaseIds}' ? $1
            )
          )
          ORDER BY
            apply_items.import_candidate_id,
            apply_items.updated_at DESC,
            apply_items.created_at DESC,
            apply_items.id DESC
        )
        SELECT
          import_candidate_id,
          item_status,
          apply_snapshot,
          updated_at
        FROM latest_candidate_outcomes
        ORDER BY updated_at DESC, import_candidate_id ASC
        LIMIT $2
      `,
      [wantedReleaseId, limit],
    );

    return result.rows.map(mapApplyOutcome);
  }

  return {
    getScopedWantedRelease,
    listLatestReleaseAddOutcomes,
  };
}
