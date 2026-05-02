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

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function mapReleaseAvailability(row) {
  if (!row) {
    return null;
  }

  return {
    artistName: row.artist_name,
    expectedTrackCount: toInteger(row.expected_track_count),
    matchedTrackCount: toInteger(row.matched_track_count),
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    reconciliationStatus: row.reconciliation_status ?? 'missing',
    releaseDate: row.release_date ?? null,
    releaseTitle: row.release_title,
  };
}

export function createLibraryReleaseAvailabilityStore({
  getPoolFn = getPool,
} = {}) {
  async function getReleaseAvailability({ metadataReleaseId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          metadata_release_groups.metadata_artist_id,
          metadata_releases.metadata_release_group_id,
          metadata_releases.id AS metadata_release_id,
          metadata_releases.title AS release_title,
          metadata_releases.release_date,
          metadata_artists.name AS artist_name,
          COALESCE(library_release_reconciliations.reconciliation_status, 'missing') AS reconciliation_status,
          COALESCE(library_release_reconciliations.expected_track_count, 0)::integer AS expected_track_count,
          COALESCE(library_release_reconciliations.matched_track_count, 0)::integer AS matched_track_count
        FROM metadata_releases
        JOIN metadata_release_groups
          ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
        JOIN metadata_artists
          ON metadata_artists.id = metadata_release_groups.metadata_artist_id
        LEFT JOIN library_release_reconciliations
          ON library_release_reconciliations.metadata_release_id = metadata_releases.id
        WHERE metadata_releases.id = $1
      `,
      [metadataReleaseId],
    );

    return mapReleaseAvailability(result.rows[0]);
  }

  return {
    getReleaseAvailability,
  };
}