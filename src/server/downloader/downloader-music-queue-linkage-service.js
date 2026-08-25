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

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeCandidateIds(candidateIds) {
  if (!Array.isArray(candidateIds)) {
    return [];
  }

  return [...new Set(candidateIds.map(normalizeString).filter(Boolean))];
}

function buildMusicQueueReleaseLinkage(row) {
  return {
    artistName: row.artist_name ?? null,
    releaseTitle: row.release_title ?? row.release_group_title ?? null,
    wantedReleaseId: row.wanted_release_id,
    wantedStatus: row.wanted_status ?? null,
  };
}

/**
 * Resolves a downloader candidate's persisted Music Queue context for one
 * authenticated operator. The candidate IDs in `musicQueue` are treated as a
 * durable association only after the matching wanted release is scoped by the
 * current app user.
 */
export function createDownloaderMusicQueueLinkageService({
  getPoolFn = getPool,
} = {}) {
  async function buildCandidateMusicQueueReleaseLinkage({
    appUserId = null,
    candidateIds = [],
  } = {}) {
    const normalizedAppUserId = normalizeString(appUserId);
    const normalizedCandidateIds = normalizeCandidateIds(candidateIds);
    if (!normalizedAppUserId || normalizedCandidateIds.length < 1) {
      return new Map();
    }

    const result = await getPoolFn().query(
      `
        WITH requested_candidates AS (
          SELECT DISTINCT candidate_id
          FROM jsonb_to_recordset($1::jsonb) AS candidates(candidate_id text)
        ),
        candidate_release_ids AS (
          SELECT
            import_candidates.id AS import_candidate_id,
            context.wanted_release_id
          FROM requested_candidates
          JOIN import_candidates
            ON import_candidates.id::text = requested_candidates.candidate_id
          CROSS JOIN LATERAL (
            SELECT NULLIF(import_candidates.normalized_payload #>> '{musicQueue,wantedReleaseId}', '') AS wanted_release_id
            UNION
            SELECT jsonb_array_elements_text(
              CASE
                WHEN jsonb_typeof(import_candidates.normalized_payload #> '{musicQueue,wantedReleaseIds}') = 'array'
                  THEN import_candidates.normalized_payload #> '{musicQueue,wantedReleaseIds}'
                ELSE '[]'::jsonb
              END
            )
          ) AS context
          WHERE context.wanted_release_id IS NOT NULL
        )
        SELECT DISTINCT ON (candidate_release_ids.import_candidate_id)
          candidate_release_ids.import_candidate_id,
          library_wanted_releases.id AS wanted_release_id,
          library_wanted_releases.wanted_status,
          metadata_artists.name AS artist_name,
          metadata_release_groups.title AS release_group_title,
          metadata_releases.title AS release_title
        FROM candidate_release_ids
        JOIN library_wanted_releases
          ON library_wanted_releases.id::text = candidate_release_ids.wanted_release_id
          AND library_wanted_releases.app_user_id = $2::uuid
        JOIN metadata_artists ON metadata_artists.id = library_wanted_releases.metadata_artist_id
        JOIN metadata_release_groups ON metadata_release_groups.id = library_wanted_releases.metadata_release_group_id
        JOIN metadata_releases ON metadata_releases.id = library_wanted_releases.metadata_release_id
        ORDER BY candidate_release_ids.import_candidate_id, library_wanted_releases.id ASC
      `,
      [JSON.stringify(normalizedCandidateIds.map((candidateId) => ({ candidate_id: candidateId }))), normalizedAppUserId],
    );

    return new Map(result.rows.map((row) => [
      row.import_candidate_id,
      buildMusicQueueReleaseLinkage(row),
    ]));
  }

  return {
    buildCandidateMusicQueueReleaseLinkage,
  };
}
