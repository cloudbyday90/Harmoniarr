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
  async function listLibraryWantedReleases() {
    const result = await getPoolFn().query(
      `
        SELECT
          metadata_artist_id,
          metadata_release_group_id,
          metadata_release_id,
          wanted_status,
          expected_track_count,
          matched_track_count,
          missing_track_count,
          release_date,
          release_status,
          evidence
        FROM library_wanted_releases
        ORDER BY metadata_artist_id ASC, metadata_release_group_id ASC, metadata_release_id ASC
      `,
    );

    return result.rows.map((row) => ({
      evidence: row.evidence ?? {},
      expectedTrackCount: row.expected_track_count,
      matchedTrackCount: row.matched_track_count,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: row.missing_track_count,
      releaseDate: row.release_date ?? null,
      releaseStatus: row.release_status ?? null,
      wantedStatus: row.wanted_status,
    }));
  }

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

  async function listWantedReleasesWithMetadata({ wantedStatus = null, limit = 500 } = {}) {
    const params = [];
    const conditions = [];

    if (wantedStatus === 'missing' || wantedStatus === 'partial') {
      params.push(wantedStatus);
      conditions.push(`lwr.wanted_status = $${params.length}`);
    }

    params.push(Math.min(Math.max(1, Number.parseInt(String(limit ?? 500), 10) || 500), 2000));
    const limitClause = `LIMIT $${params.length}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          lwr.id,
          lwr.wanted_status,
          lwr.expected_track_count,
          lwr.matched_track_count,
          lwr.missing_track_count,
          lwr.release_date,
          lwr.release_status,
          lwr.last_reconciled_at,
          lwr.metadata_artist_id,
          lwr.metadata_release_group_id,
          lwr.metadata_release_id,
          ma.name AS artist_name,
          ma.sort_name AS artist_sort_name,
          mrg.title AS release_group_title,
          mrg.primary_type AS release_group_type,
          mr.title AS release_title,
          mr.disambiguation AS release_disambiguation,
          mr.country AS release_country
        FROM library_wanted_releases lwr
        JOIN metadata_artists ma ON ma.id = lwr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lwr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lwr.metadata_release_id
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
      expectedTrackCount: Number.parseInt(String(row.expected_track_count ?? 0), 10) || 0,
      lastReconciledAt: row.last_reconciled_at ?? null,
      matchedTrackCount: Number.parseInt(String(row.matched_track_count ?? 0), 10) || 0,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: Number.parseInt(String(row.missing_track_count ?? 0), 10) || 0,
      releaseCountry: row.release_country ?? null,
      releaseDate: row.release_date ?? null,
      releaseDisambiguation: row.release_disambiguation ?? null,
      releaseGroupTitle: row.release_group_title,
      releaseGroupType: row.release_group_type ?? null,
      releaseStatus: row.release_status ?? null,
      releaseTitle: row.release_title,
      wantedStatus: row.wanted_status,
    }));
  }

  return {
    listLibraryWantedReleases,
    listWantedReleasesWithMetadata,
    listWantedStatusesForReleaseGroups,
    replaceLibraryWantedReleases,
  };
}