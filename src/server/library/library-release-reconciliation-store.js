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

  async function listLibraryReleasesWithMetadata({ reconciliationStatus = null, limit = 500 } = {}) {
    const params = [];
    const conditions = [];

    const validStatuses = ['complete', 'partial', 'duplicate'];
    if (validStatuses.includes(reconciliationStatus)) {
      params.push(reconciliationStatus);
      conditions.push(`lrr.reconciliation_status = $${params.length}`);
    }

    params.push(Math.min(Math.max(1, Number.parseInt(String(limit ?? 500), 10) || 500), 2000));
    const limitClause = `LIMIT $${params.length}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          lrr.id,
          lrr.reconciliation_status,
          lrr.expected_track_count,
          lrr.matched_track_count,
          lrr.missing_track_count,
          lrr.matched_file_count,
          lrr.duplicate_track_count,
          lrr.last_reconciled_at,
          lrr.metadata_artist_id,
          lrr.metadata_release_group_id,
          lrr.metadata_release_id,
          ma.name AS artist_name,
          ma.sort_name AS artist_sort_name,
          mrg.title AS release_group_title,
          mrg.primary_type AS release_group_type,
          mrg.musicbrainz_release_group_id AS musicbrainz_release_group_id,
          mr.title AS release_title,
          mr.disambiguation AS release_disambiguation,
          mr.country AS release_country,
          mr.status AS release_status,
          mr.release_date AS release_date,
          mr.musicbrainz_release_id AS musicbrainz_release_id
        FROM library_release_reconciliations lrr
        JOIN metadata_artists ma ON ma.id = lrr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lrr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lrr.metadata_release_id
        ${whereClause}
        ORDER BY ma.sort_name ASC NULLS LAST, ma.name ASC, mrg.first_release_date ASC NULLS LAST, mr.release_date ASC NULLS LAST
        ${limitClause}
      `,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      artistName: row.artist_name,
      artistSortName: row.artist_sort_name ?? row.artist_name,
      duplicateTrackCount: Number.parseInt(String(row.duplicate_track_count ?? 0), 10) || 0,
      expectedTrackCount: Number.parseInt(String(row.expected_track_count ?? 0), 10) || 0,
      lastReconciledAt: row.last_reconciled_at ?? null,
      matchedFileCount: Number.parseInt(String(row.matched_file_count ?? 0), 10) || 0,
      matchedTrackCount: Number.parseInt(String(row.matched_track_count ?? 0), 10) || 0,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: Number.parseInt(String(row.missing_track_count ?? 0), 10) || 0,
      musicbrainzReleaseGroupId: row.musicbrainz_release_group_id ?? null,
      musicbrainzReleaseId: row.musicbrainz_release_id ?? null,
      reconciliationStatus: row.reconciliation_status,
      releaseCountry: row.release_country ?? null,
      releaseDate: row.release_date ?? null,
      releaseDisambiguation: row.release_disambiguation ?? null,
      releaseGroupTitle: row.release_group_title,
      releaseGroupType: row.release_group_type ?? null,
      releaseStatus: row.release_status ?? null,
      releaseTitle: row.release_title,
    }));
  }

  return {
    listLibraryReleasesWithMetadata,
    replaceLibraryReleaseReconciliations,
  };
}