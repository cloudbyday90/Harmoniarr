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
import { createLibraryWantedReleaseStore } from './library-wanted-release-store.js';

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function mapWantedRow(row) {
  const expectedTrackCount = toInteger(row.expected_track_count);
  const matchedTrackCount = toInteger(row.matched_track_count);
  const missingTrackCount = Math.max(expectedTrackCount - matchedTrackCount, 0);

  return {
    evidence: {
      monitoredReleaseGroupTypes: row.monitored_release_group_types ?? ['album', 'ep'],
      reconciliationStatus: row.reconciliation_status ?? 'missing',
      strategy: row.reconciliation_status ? 'monitored_release_gap' : 'monitored_release_absent',
    },
    expectedTrackCount,
    matchedTrackCount,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    missingTrackCount,
    releaseDate: row.release_date ?? null,
    releaseStatus: row.release_status ?? null,
    wantedStatus: matchedTrackCount > 0 ? 'partial' : 'missing',
  };
}

export function createLibraryWantedReleaseService({
  getPoolFn = getPool,
  libraryWantedReleaseStore = createLibraryWantedReleaseStore(),
} = {}) {
  async function loadWantedReleases() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          metadata_release_groups.metadata_artist_id,
          metadata_release_groups.id AS metadata_release_group_id,
          metadata_releases.id AS metadata_release_id,
          metadata_releases.release_date,
          metadata_releases.status AS release_status,
          metadata_artist_monitoring.monitored_release_group_types,
          COUNT(metadata_tracks.id)::integer AS expected_track_count,
          COALESCE(library_release_reconciliations.matched_track_count, 0)::integer AS matched_track_count,
          library_release_reconciliations.reconciliation_status
        FROM metadata_artist_monitoring
        JOIN metadata_release_groups
          ON metadata_release_groups.metadata_artist_id = metadata_artist_monitoring.metadata_artist_id
        JOIN metadata_releases
          ON metadata_releases.metadata_release_group_id = metadata_release_groups.id
        JOIN metadata_media
          ON metadata_media.metadata_release_id = metadata_releases.id
        JOIN metadata_tracks
          ON metadata_tracks.metadata_medium_id = metadata_media.id
        LEFT JOIN library_release_reconciliations
          ON library_release_reconciliations.metadata_release_id = metadata_releases.id
        WHERE metadata_artist_monitoring.is_monitored = TRUE
          AND LOWER(TRIM(COALESCE(metadata_release_groups.primary_type, ''))) = ANY (
            ARRAY(
              SELECT LOWER(type_entry)
              FROM unnest(metadata_artist_monitoring.monitored_release_group_types) AS type_entry
            )
          )
          AND COALESCE(metadata_releases.status, 'Official') = 'Official'
          AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'complete'
          AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'duplicate'
        GROUP BY
          metadata_release_groups.metadata_artist_id,
          metadata_release_groups.id,
          metadata_releases.id,
          metadata_releases.release_date,
          metadata_releases.status,
          metadata_artist_monitoring.monitored_release_group_types,
          library_release_reconciliations.matched_track_count,
          library_release_reconciliations.reconciliation_status
        ORDER BY metadata_releases.release_date NULLS LAST, metadata_releases.id ASC
      `,
    );

    return result.rows.map(mapWantedRow);
  }

  async function reconcileWantedReleases() {
    const wantedReleases = await loadWantedReleases();
    await libraryWantedReleaseStore.replaceLibraryWantedReleases({ wantedReleases });
  }

  return {
    reconcileWantedReleases,
  };
}