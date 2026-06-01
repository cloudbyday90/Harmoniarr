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

function normalizeMatch(match) {
  return {
    confidence: match.confidence,
    evidence: match.evidence ?? null,
    libraryFileId: match.libraryFileId,
    matchStatus: match.matchStatus,
    matchedBy: match.matchedBy,
    metadataArtistId: match.metadataArtistId ?? null,
    metadataMediumId: match.metadataMediumId ?? null,
    metadataRecordingId: match.metadataRecordingId ?? null,
    metadataReleaseGroupId: match.metadataReleaseGroupId ?? null,
    metadataReleaseId: match.metadataReleaseId ?? null,
    metadataTrackId: match.metadataTrackId ?? null,
  };
}

function dedupeMatchesByLibraryFileId(matches) {
  const matchMap = new Map();

  for (const match of matches) {
    const normalizedMatch = normalizeMatch(match);
    if (matchMap.has(normalizedMatch.libraryFileId)) {
      matchMap.delete(normalizedMatch.libraryFileId);
    }

    matchMap.set(normalizedMatch.libraryFileId, normalizedMatch);
  }

  return [...matchMap.values()];
}

function buildBatchValues(matches) {
  return [
    matches.map((match) => match.libraryFileId),
    matches.map((match) => match.metadataArtistId),
    matches.map((match) => match.metadataReleaseGroupId),
    matches.map((match) => match.metadataReleaseId),
    matches.map((match) => match.metadataMediumId),
    matches.map((match) => match.metadataTrackId),
    matches.map((match) => match.metadataRecordingId),
    matches.map((match) => match.matchStatus),
    matches.map((match) => match.confidence),
    matches.map((match) => match.matchedBy),
    matches.map((match) => (match.evidence ? JSON.stringify(match.evidence) : null)),
  ];
}

export function createLibraryFileMatchStore({
  getPoolFn = getPool,
} = {}) {
  async function writeLibraryFileMatchBatch({ matches }) {
    const normalizedMatches = dedupeMatchesByLibraryFileId(Array.isArray(matches) ? matches : []);
    if (normalizedMatches.length === 0) {
      return;
    }

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
        SELECT
          t.library_file_id,
          t.metadata_artist_id,
          t.metadata_release_group_id,
          t.metadata_release_id,
          t.metadata_medium_id,
          t.metadata_track_id,
          t.metadata_recording_id,
          t.match_status,
          t.confidence,
          t.matched_by,
          t.evidence,
          NOW(),
          NOW()
        FROM UNNEST(
          $1::uuid[],
          $2::uuid[],
          $3::uuid[],
          $4::uuid[],
          $5::uuid[],
          $6::uuid[],
          $7::uuid[],
          $8::text[],
          $9::text[],
          $10::text[],
          $11::jsonb[]
        ) AS t(
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
          evidence
        )
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
      buildBatchValues(normalizedMatches),
    );
  }

  async function writeLibraryFileMatch(match) {
    await writeLibraryFileMatchBatch({ matches: [match] });
  }

  return {
    writeLibraryFileMatch,
    writeLibraryFileMatchBatch,
  };
}
