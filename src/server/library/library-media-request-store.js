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

function mapMediaRequestRow(row) {
  if (!row) {
    return null;
  }

  const matchedReleaseId = row.matched_metadata_release_id ?? null;
  const matchedReleaseGroupId = row.matched_metadata_release_group_id ?? row.matched_release_group_id ?? null;

  return {
    id: row.id,
    requestKind: row.request_kind,
    requestState: row.request_state,
    artistName: row.artist_name ?? null,
    releaseTitle: row.release_title ?? null,
    trackTitle: row.track_title ?? null,
    sourceProvider: row.source_provider ?? null,
    sourceUrl: row.source_url ?? null,
    normalizedQuery: row.normalized_query,
    notes: row.notes ?? null,
    evidence: row.evidence ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    musicbrainzReleaseId: row.musicbrainz_release_id ?? null,
    linkedRequestId: row.linked_request_id ?? null,
    expectedReleaseDate: row.expected_release_date ?? null,
    fanOutParentId: row.fan_out_parent_id ?? null,
    fanOutChildCount: Number.parseInt(String(row.fan_out_child_count ?? 0), 10) || 0,
    requestedByUser: {
      id: row.requested_by_user_id,
      role: row.requested_by_role ?? null,
      username: row.requested_by_username ?? null,
    },
    requestedForUser: {
      id: row.requested_for_user_id,
      role: row.requested_for_role ?? null,
      username: row.requested_for_username ?? null,
    },
    existingMatch: matchedReleaseId || matchedReleaseGroupId
      ? {
          artistName: row.matched_artist_name ?? null,
          musicbrainzReleaseId: row.matched_musicbrainz_release_id ?? null,
          releaseGroupId: matchedReleaseGroupId,
          releaseGroupTitle: row.matched_release_group_title ?? null,
          releaseId: matchedReleaseId,
          releaseTitle: row.matched_release_title ?? null,
        }
      : null,
  };
}

function mapSummaryCounts(row) {
  return {
    alreadyExists: Number.parseInt(String(row.already_exists_count ?? 0), 10) || 0,
    needsFetch: Number.parseInt(String(row.needs_fetch_count ?? 0), 10) || 0,
    needsReview: Number.parseInt(String(row.needs_review_count ?? 0), 10) || 0,
    totalRequests: Number.parseInt(String(row.total_request_count ?? 0), 10) || 0,
  };
}

function buildVisibilityFilter({ requestedForUserId }) {
  if (!requestedForUserId) {
    return {
      params: [],
      sql: '',
    };
  }

  return {
    params: [requestedForUserId],
    sql: 'WHERE media_requests.requested_for_user_id = $1',
  };
}

const baseSelect = `
  SELECT
    media_requests.id,
    media_requests.requested_by_user_id,
    media_requests.requested_for_user_id,
    media_requests.request_kind,
    media_requests.request_state,
    media_requests.artist_name,
    media_requests.release_title,
    media_requests.track_title,
    media_requests.source_url,
    media_requests.source_provider,
    media_requests.normalized_query,
    media_requests.matched_metadata_release_group_id,
    media_requests.matched_metadata_release_id,
    media_requests.notes,
    media_requests.evidence,
    media_requests.created_at,
    media_requests.updated_at,
    media_requests.musicbrainz_release_id,
    media_requests.linked_request_id,
    media_requests.expected_release_date,
    media_requests.fan_out_parent_id,
    media_requests.fan_out_child_count,
    request_users.username AS requested_by_username,
    request_users.role AS requested_by_role,
    target_users.username AS requested_for_username,
    target_users.role AS requested_for_role,
    matched_release_groups.id AS matched_release_group_id,
    matched_release_groups.title AS matched_release_group_title,
    matched_releases.title AS matched_release_title,
    matched_releases.musicbrainz_release_id AS matched_musicbrainz_release_id,
    matched_artists.name AS matched_artist_name
  FROM media_requests
  JOIN app_users AS request_users
    ON request_users.id = media_requests.requested_by_user_id
  JOIN app_users AS target_users
    ON target_users.id = media_requests.requested_for_user_id
  LEFT JOIN metadata_releases AS matched_releases
    ON matched_releases.id = media_requests.matched_metadata_release_id
  LEFT JOIN metadata_release_groups AS matched_release_groups
    ON matched_release_groups.id = COALESCE(
      media_requests.matched_metadata_release_group_id,
      matched_releases.metadata_release_group_id
    )
  LEFT JOIN metadata_artists AS matched_artists
    ON matched_artists.id = matched_release_groups.metadata_artist_id
`;

export function createLibraryMediaRequestStore({
  getPoolFn = getPool,
} = {}) {
  async function createMediaRequest({
    artistName,
    evidence,
    expectedReleaseDate = null,
    linkedRequestId = null,
    matchedMetadataReleaseGroupId,
    matchedMetadataReleaseId,
    musicbrainzReleaseId = null,
    normalizedQuery,
    notes,
    releaseTitle,
    requestKind,
    requestState,
    requestedByUserId,
    requestedForUserId,
    sourceProvider,
    sourceUrl,
    trackTitle,
    fanOutParentId = null,
    fanOutChildCount = 0,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO media_requests (
          requested_by_user_id,
          requested_for_user_id,
          request_kind,
          request_state,
          artist_name,
          release_title,
          track_title,
          source_url,
          source_provider,
          normalized_query,
          matched_metadata_release_group_id,
          matched_metadata_release_id,
          notes,
          evidence,
          musicbrainz_release_id,
          linked_request_id,
          expected_release_date,
          fan_out_parent_id,
          fan_out_child_count,
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
          $10,
          $11,
          $12,
          $13,
          $14::jsonb,
          $15,
          $16,
          $17,
          $18,
          $19,
          NOW()
        )
        RETURNING id
      `,
      [
        requestedByUserId,
        requestedForUserId,
        requestKind,
        requestState,
        artistName,
        releaseTitle,
        trackTitle,
        sourceUrl,
        sourceProvider,
        normalizedQuery,
        matchedMetadataReleaseGroupId,
        matchedMetadataReleaseId,
        notes,
        JSON.stringify(evidence ?? {}),
        musicbrainzReleaseId,
        linkedRequestId,
        expectedReleaseDate ?? null,
        fanOutParentId,
        fanOutChildCount,
      ],
    );

    const mediaRequestId = result.rows[0]?.id ?? null;
    return getMediaRequestById({ mediaRequestId });
  }

  async function listMediaRequests({ requestedForUserId = null } = {}) {
    const pool = getPoolFn();
    const filter = buildVisibilityFilter({ requestedForUserId });
    const result = await pool.query(
      `
        ${baseSelect}
        ${filter.sql}
        ORDER BY media_requests.created_at DESC, media_requests.id DESC
      `,
      filter.params,
    );

    return result.rows.map(mapMediaRequestRow);
  }

  async function getMediaRequestCounts({ requestedForUserId = null } = {}) {
    const pool = getPoolFn();
    const filter = buildVisibilityFilter({ requestedForUserId });
    const result = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE media_requests.request_state = 'already_exists')::integer AS already_exists_count,
          COUNT(*) FILTER (WHERE media_requests.request_state = 'needs_fetch')::integer AS needs_fetch_count,
          COUNT(*) FILTER (WHERE media_requests.request_state = 'needs_review')::integer AS needs_review_count,
          COUNT(*)::integer AS total_request_count
        FROM media_requests
        ${filter.sql}
      `,
      filter.params,
    );

    return mapSummaryCounts(result.rows[0] ?? {});
  }

  async function getMediaRequestById({ mediaRequestId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        ${baseSelect}
        WHERE media_requests.id = $1
        LIMIT 1
      `,
      [mediaRequestId],
    );

    return mapMediaRequestRow(result.rows[0]);
  }

  async function mergeMediaRequestEvidence({ evidencePatch, mediaRequestId }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE media_requests
        SET evidence = COALESCE(evidence, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [mediaRequestId, JSON.stringify(evidencePatch ?? {})],
    );
  }

  async function findActiveDuplicateRequest({ musicbrainzReleaseId = null, artistName = null, releaseTitle = null, excludeRequestedForUserId = null }) {
    const pool = getPoolFn();

    if (musicbrainzReleaseId) {
      const result = await pool.query(
        `
          ${baseSelect}
          WHERE media_requests.musicbrainz_release_id = $1
            AND media_requests.request_state NOT IN ('cancelled', 'failed')
            AND ($2::uuid IS NULL OR media_requests.requested_for_user_id != $2)
          ORDER BY media_requests.created_at ASC
          LIMIT 1
        `,
        [musicbrainzReleaseId, excludeRequestedForUserId ?? null],
      );

      if (result.rows.length > 0) {
        return mapMediaRequestRow(result.rows[0]);
      }
    }

    if (artistName && releaseTitle) {
      const result = await pool.query(
        `
          ${baseSelect}
          WHERE media_requests.musicbrainz_release_id IS NULL
            AND lower(trim(media_requests.artist_name)) = lower(trim($1))
            AND lower(trim(media_requests.release_title)) = lower(trim($2))
            AND media_requests.request_state NOT IN ('cancelled', 'failed')
            AND ($3::uuid IS NULL OR media_requests.requested_for_user_id != $3)
          ORDER BY media_requests.created_at ASC
          LIMIT 1
        `,
        [artistName, releaseTitle, excludeRequestedForUserId ?? null],
      );

      if (result.rows.length > 0) {
        return mapMediaRequestRow(result.rows[0]);
      }
    }

    return null;
  }

  async function createFanOutChildRequests({ parentRequest, targetUserIds, linkedRequestId = null }) {
    if (!Array.isArray(targetUserIds) || targetUserIds.length === 0) {
      return [];
    }

    const pool = getPoolFn();
    const values = [];
    const params = [];
    let paramIdx = 1;

    for (const targetUserId of targetUserIds) {
      const offset = (paramIdx - 1) * 19;
      values.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}::jsonb, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19})`,
      );
      params.push(
        parentRequest.requestedByUser.id,
        targetUserId,
        parentRequest.requestKind,
        parentRequest.requestState,
        parentRequest.artistName,
        parentRequest.releaseTitle,
        parentRequest.trackTitle,
        parentRequest.sourceUrl,
        parentRequest.sourceProvider,
        parentRequest.normalizedQuery,
        parentRequest.existingMatch?.releaseGroupId ?? null,
        parentRequest.existingMatch?.releaseId ?? null,
        parentRequest.notes,
        JSON.stringify(parentRequest.evidence ?? {}),
        parentRequest.musicbrainzReleaseId,
        linkedRequestId ?? parentRequest.linkedRequestId,
        parentRequest.expectedReleaseDate,
        parentRequest.id,
        0,
      );
      paramIdx += 1;
    }

    const result = await pool.query(
      `
        INSERT INTO media_requests (
          requested_by_user_id,
          requested_for_user_id,
          request_kind,
          request_state,
          artist_name,
          release_title,
          track_title,
          source_url,
          source_provider,
          normalized_query,
          matched_metadata_release_group_id,
          matched_metadata_release_id,
          notes,
          evidence,
          musicbrainz_release_id,
          linked_request_id,
          expected_release_date,
          fan_out_parent_id,
          fan_out_child_count,
          updated_at
        )
        VALUES ${values.join(', ')}
        RETURNING id
      `,
      params,
    );

    const childIds = result.rows.map((row) => row.id);
    const children = [];
    for (const childId of childIds) {
      const child = await getMediaRequestById({ mediaRequestId: childId });
      if (child) {
        children.push(child);
      }
    }

    return children;
  }

  async function updateFanOutChildCount({ mediaRequestId, childCount }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE media_requests
        SET fan_out_child_count = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [mediaRequestId, childCount],
    );
  }

  return {
    createFanOutChildRequests,
    createMediaRequest,
    findActiveDuplicateRequest,
    getMediaRequestById,
    getMediaRequestCounts,
    listMediaRequests,
    mergeMediaRequestEvidence,
    updateFanOutChildCount,
  };
}