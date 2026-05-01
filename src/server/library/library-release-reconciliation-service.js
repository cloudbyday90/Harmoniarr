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
import { createLibraryReleaseReconciliationStore } from './library-release-reconciliation-store.js';

function buildReconciliationStatus({ duplicateTrackCount, expectedTrackCount, matchedTrackCount }) {
  if (duplicateTrackCount > 0) {
    return 'duplicate';
  }

  if (matchedTrackCount >= expectedTrackCount) {
    return 'complete';
  }

  return 'partial';
}

function mapReconciliationRow(row) {
  const expectedTrackCount = Number(row.expected_track_count ?? 0);
  const matchedTrackCount = Number(row.matched_track_count ?? 0);
  const matchedFileCount = Number(row.matched_file_count ?? 0);
  const duplicateTrackCount = Number(row.duplicate_track_count ?? 0);
  const missingTrackCount = Math.max(expectedTrackCount - matchedTrackCount, 0);

  return {
    duplicateTrackCount,
    evidence: {
      strategy: 'matched_track_coverage',
      trackCoverage: expectedTrackCount === 0
        ? 0
        : matchedTrackCount / expectedTrackCount,
    },
    expectedTrackCount,
    matchedFileCount,
    matchedTrackCount,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    missingTrackCount,
    reconciliationStatus: buildReconciliationStatus({
      duplicateTrackCount,
      expectedTrackCount,
      matchedTrackCount,
    }),
  };
}

export function createLibraryReleaseReconciliationService({
  getPoolFn = getPool,
  libraryReleaseReconciliationStore = createLibraryReleaseReconciliationStore(),
} = {}) {
  async function loadLibraryReleaseReconciliations() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH matched_files AS (
          SELECT
            library_file_matches.metadata_release_id,
            library_file_matches.metadata_track_id,
            COUNT(*)::integer AS file_count
          FROM library_file_matches
          JOIN library_files ON library_files.id = library_file_matches.library_file_id
          WHERE library_file_matches.match_status = 'matched'
            AND library_file_matches.metadata_release_id IS NOT NULL
            AND library_file_matches.metadata_track_id IS NOT NULL
            AND library_files.deleted_at IS NULL
            AND library_files.file_state = 'observed'
          GROUP BY library_file_matches.metadata_release_id, library_file_matches.metadata_track_id
        ),
        expected AS (
          SELECT
            metadata_artists.id AS metadata_artist_id,
            metadata_release_groups.id AS metadata_release_group_id,
            metadata_releases.id AS metadata_release_id,
            COUNT(metadata_tracks.id)::integer AS expected_track_count
          FROM metadata_releases
          JOIN metadata_release_groups ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
          JOIN metadata_artists ON metadata_artists.id = metadata_release_groups.metadata_artist_id
          JOIN metadata_media ON metadata_media.metadata_release_id = metadata_releases.id
          JOIN metadata_tracks ON metadata_tracks.metadata_medium_id = metadata_media.id
          WHERE metadata_releases.id IN (
            SELECT DISTINCT metadata_release_id
            FROM matched_files
          )
          GROUP BY metadata_artists.id, metadata_release_groups.id, metadata_releases.id
        ),
        matched AS (
          SELECT
            metadata_release_id,
            COUNT(*)::integer AS matched_track_count,
            COALESCE(SUM(file_count), 0)::integer AS matched_file_count,
            COUNT(*) FILTER (WHERE file_count > 1)::integer AS duplicate_track_count
          FROM matched_files
          GROUP BY metadata_release_id
        )
        SELECT
          expected.metadata_artist_id,
          expected.metadata_release_group_id,
          expected.metadata_release_id,
          expected.expected_track_count,
          matched.matched_track_count,
          matched.matched_file_count,
          matched.duplicate_track_count
        FROM expected
        JOIN matched ON matched.metadata_release_id = expected.metadata_release_id
        ORDER BY expected.metadata_release_id ASC
      `,
    );

    return result.rows.map(mapReconciliationRow);
  }

  async function reconcileLibraryReleases() {
    const reconciliations = await loadLibraryReleaseReconciliations();
    await libraryReleaseReconciliationStore.replaceLibraryReleaseReconciliations({
      reconciliations,
    });
  }

  return {
    reconcileLibraryReleases,
  };
}