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

export function createLibraryFileMatchStore({
  getPoolFn = getPool,
} = {}) {
  async function writeLibraryFileMatch({
    confidence,
    evidence = null,
    libraryFileId,
    matchStatus,
    matchedBy,
    metadataArtistId = null,
    metadataMediumId = null,
    metadataRecordingId = null,
    metadataReleaseGroupId = null,
    metadataReleaseId = null,
    metadataTrackId = null,
  }) {
    const pool = getPoolFn();
    await pool.query(
      `
        INSERT INTO library_file_matches (
          library_file_id,
          metadata_artist_id,
          metadata_release_group_id,
          metadata_release_id,
          metadata_medium_id,
          metadata_track_id,
          metadata_recording_id,
          match_status,
          confidence,
          matched_by,
          evidence,
          matched_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NOW(), NOW())
        ON CONFLICT (library_file_id) DO UPDATE
        SET metadata_artist_id = EXCLUDED.metadata_artist_id,
            metadata_release_group_id = EXCLUDED.metadata_release_group_id,
            metadata_release_id = EXCLUDED.metadata_release_id,
            metadata_medium_id = EXCLUDED.metadata_medium_id,
            metadata_track_id = EXCLUDED.metadata_track_id,
            metadata_recording_id = EXCLUDED.metadata_recording_id,
            match_status = EXCLUDED.match_status,
            confidence = EXCLUDED.confidence,
            matched_by = EXCLUDED.matched_by,
            evidence = EXCLUDED.evidence,
            matched_at = NOW(),
            updated_at = NOW()
      `,
      [
        libraryFileId,
        metadataArtistId,
        metadataReleaseGroupId,
        metadataReleaseId,
        metadataMediumId,
        metadataTrackId,
        metadataRecordingId,
        matchStatus,
        confidence,
        matchedBy,
        evidence ? JSON.stringify(evidence) : null,
      ],
    );
  }

  return {
    writeLibraryFileMatch,
  };
}