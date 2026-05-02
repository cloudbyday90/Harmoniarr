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

export function createLibraryWantedReleaseStore({
  getPoolFn = getPool,
} = {}) {
  async function listWantedStatusesForReleaseGroups({ metadataReleaseGroupIds } = {}) {
    if (!Array.isArray(metadataReleaseGroupIds) || metadataReleaseGroupIds.length < 1) {
      return [];
    }

    const result = await getPoolFn().query(
      `
        SELECT
          metadata_release_group_id,
          CASE
            WHEN BOOL_OR(wanted_status = 'missing') THEN 'missing'
            WHEN BOOL_OR(wanted_status = 'partial') THEN 'partial'
            ELSE MIN(wanted_status)
          END AS wanted_status
        FROM library_wanted_releases
        WHERE metadata_release_group_id::text = ANY($1::text[])
        GROUP BY metadata_release_group_id
      `,
      [metadataReleaseGroupIds],
    );

    return result.rows.map((row) => ({
      metadataReleaseGroupId: row.metadata_release_group_id,
      wantedStatus: row.wanted_status,
    }));
  }

  async function replaceLibraryWantedReleases({ wantedReleases }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM library_wanted_releases');

      for (const wantedRelease of wantedReleases) {
        await client.query(
          `
            INSERT INTO library_wanted_releases (
              metadata_artist_id,
              metadata_release_group_id,
              metadata_release_id,
              wanted_status,
              expected_track_count,
              matched_track_count,
              missing_track_count,
              release_date,
              release_status,
              evidence,
              last_reconciled_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              $6,
              $7,
              $8,
              $9,
              $10::jsonb,
              NOW(),
              NOW()
            )
          `,
          [
            wantedRelease.metadataArtistId,
            wantedRelease.metadataReleaseGroupId,
            wantedRelease.metadataReleaseId,
            wantedRelease.wantedStatus,
            wantedRelease.expectedTrackCount,
            wantedRelease.matchedTrackCount,
            wantedRelease.missingTrackCount,
            wantedRelease.releaseDate,
            wantedRelease.releaseStatus,
            JSON.stringify(wantedRelease.evidence ?? {}),
          ],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    listWantedStatusesForReleaseGroups,
    replaceLibraryWantedReleases,
  };
}