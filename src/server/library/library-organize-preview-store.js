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

function mapPreviewRow(row) {
  return {
    artistName: row.artist_name ?? null,
    canonicalPath: row.canonical_path,
    extension: row.extension ?? '',
    fileState: row.file_state ?? 'observed',
    filename: row.filename,
    id: row.library_file_id,
    libraryRootId: row.library_root_id,
    libraryRootPath: row.library_root_canonical_path,
    matchStatus: row.match_status ?? null,
    matchedBy: row.matched_by ?? null,
    mediumCount: toInteger(row.medium_count),
    mediumPosition: toInteger(row.medium_position),
    metadataReleaseId: row.metadata_release_id ?? null,
    metadataTrackId: row.metadata_track_id ?? null,
    relativePath: row.relative_path,
    releaseDate: row.release_date ?? null,
    releaseGroupTitle: row.release_group_title ?? null,
    releaseTitle: row.release_title ?? null,
    trackPosition: toInteger(row.track_position),
    trackTitle: row.track_title ?? null,
  };
}

export function createLibraryOrganizePreviewStore({
  getPoolFn = getPool,
} = {}) {
  async function listLibraryFilesForOrganizePreview() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          library_files.id AS library_file_id,
          library_files.library_root_id,
          library_files.canonical_path,
          library_files.relative_path,
          library_files.filename,
          library_files.extension,
          library_files.file_state,
          library_roots.canonical_path AS library_root_canonical_path,
          library_file_matches.match_status,
          library_file_matches.matched_by,
          library_file_matches.metadata_release_id,
          library_file_matches.metadata_track_id,
          metadata_artists.name AS artist_name,
          metadata_release_groups.title AS release_group_title,
          metadata_releases.title AS release_title,
          metadata_releases.release_date,
          metadata_releases.medium_count,
          metadata_media.position AS medium_position,
          metadata_tracks.position AS track_position,
          metadata_tracks.title AS track_title
        FROM library_files
        JOIN library_roots
          ON library_roots.id = library_files.library_root_id
        LEFT JOIN library_file_matches
          ON library_file_matches.library_file_id = library_files.id
        LEFT JOIN metadata_releases
          ON metadata_releases.id = library_file_matches.metadata_release_id
        LEFT JOIN metadata_release_groups
          ON metadata_release_groups.id = metadata_releases.metadata_release_group_id
        LEFT JOIN metadata_artists
          ON metadata_artists.id = metadata_release_groups.metadata_artist_id
        LEFT JOIN metadata_tracks
          ON metadata_tracks.id = library_file_matches.metadata_track_id
        LEFT JOIN metadata_media
          ON metadata_media.id = metadata_tracks.metadata_medium_id
        WHERE library_files.deleted_at IS NULL
          AND library_files.file_state = 'observed'
        ORDER BY library_roots.canonical_path ASC,
                 library_files.relative_path ASC,
                 library_files.filename ASC
      `,
    );

    return result.rows.map(mapPreviewRow);
  }

  return {
    listLibraryFilesForOrganizePreview,
  };
}
