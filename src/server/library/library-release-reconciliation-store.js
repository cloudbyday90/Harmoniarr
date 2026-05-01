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

export function createLibraryReleaseReconciliationStore({
  getPoolFn = getPool,
} = {}) {
  async function replaceLibraryReleaseReconciliations({ reconciliations }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (reconciliations.length === 0) {
        await client.query('DELETE FROM library_release_reconciliations');
      } else {
        await client.query(
          `
            DELETE FROM library_release_reconciliations
            WHERE NOT (metadata_release_id = ANY($1::uuid[]))
          `,
          [reconciliations.map((reconciliation) => reconciliation.metadataReleaseId)],
        );
      }

      for (const reconciliation of reconciliations) {
        await client.query(
          `
            INSERT INTO library_release_reconciliations (
              metadata_artist_id,
              metadata_release_group_id,
              metadata_release_id,
              reconciliation_status,
              expected_track_count,
              matched_track_count,
              missing_track_count,
              matched_file_count,
              duplicate_track_count,
              evidence,
              last_reconciled_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW(), NOW())
            ON CONFLICT (metadata_release_id) DO UPDATE
            SET metadata_artist_id = EXCLUDED.metadata_artist_id,
                metadata_release_group_id = EXCLUDED.metadata_release_group_id,
                reconciliation_status = EXCLUDED.reconciliation_status,
                expected_track_count = EXCLUDED.expected_track_count,
                matched_track_count = EXCLUDED.matched_track_count,
                missing_track_count = EXCLUDED.missing_track_count,
                matched_file_count = EXCLUDED.matched_file_count,
                duplicate_track_count = EXCLUDED.duplicate_track_count,
                evidence = EXCLUDED.evidence,
                last_reconciled_at = NOW(),
                updated_at = NOW()
          `,
          [
            reconciliation.metadataArtistId,
            reconciliation.metadataReleaseGroupId,
            reconciliation.metadataReleaseId,
            reconciliation.reconciliationStatus,
            reconciliation.expectedTrackCount,
            reconciliation.matchedTrackCount,
            reconciliation.missingTrackCount,
            reconciliation.matchedFileCount,
            reconciliation.duplicateTrackCount,
            reconciliation.evidence ? JSON.stringify(reconciliation.evidence) : null,
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
    replaceLibraryReleaseReconciliations,
  };
}