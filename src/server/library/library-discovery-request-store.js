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

function mapDiscoveryDispatchRow(row) {
  if (!row) {
    return null;
  }

  return {
    artistName: row.artist_name ?? null,
    evidence: row.evidence ?? {},
    lastSearchAt: row.last_search_at ?? null,
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    nextSearchAfter: row.next_search_after ?? null,
    releaseDate: row.release_date ?? null,
    releaseGroupTitle: row.release_group_title ?? null,
    releaseTitle: row.release_title ?? null,
    requestStatus: row.request_status ?? null,
    searchMode: row.search_mode ?? null,
    wantedStatus: row.wanted_status ?? null,
  };
}

export function createLibraryDiscoveryRequestStore({
  getPoolFn = getPool,
} = {}) {
  async function claimNextReadyAutomaticDiscoveryRequest({
    dispatchedAt,
    nextSearchAfter,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH candidate AS (
          SELECT
            library_discovery_requests.id,
            library_discovery_requests.metadata_artist_id,
            library_discovery_requests.metadata_release_group_id,
            library_discovery_requests.metadata_release_id,
            library_discovery_requests.wanted_status,
            library_discovery_requests.search_mode,
            library_discovery_requests.request_status,
            library_discovery_requests.release_date,
            library_discovery_requests.evidence,
            metadata_artists.name AS artist_name,
            metadata_release_groups.title AS release_group_title,
            metadata_releases.title AS release_title
          FROM library_discovery_requests
          JOIN metadata_artists
            ON metadata_artists.id = library_discovery_requests.metadata_artist_id
          JOIN metadata_release_groups
            ON metadata_release_groups.id = library_discovery_requests.metadata_release_group_id
          JOIN metadata_releases
            ON metadata_releases.id = library_discovery_requests.metadata_release_id
          WHERE library_discovery_requests.search_mode = 'automatic'
            AND library_discovery_requests.request_status = 'ready'
            AND COALESCE(library_discovery_requests.next_search_after, $1::timestamptz) <= $1::timestamptz
          ORDER BY
            library_discovery_requests.next_search_after ASC NULLS FIRST,
            library_discovery_requests.release_date ASC NULLS LAST,
            library_discovery_requests.metadata_release_id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        ),
        claimed AS (
          UPDATE library_discovery_requests
          SET
            last_search_at = $1,
            next_search_after = $2,
            request_status = 'cooldown',
            blocked_reason = 'automatic_cooldown',
            evidence = COALESCE(candidate.evidence, '{}'::jsonb) || jsonb_build_object(
              'dispatchStrategy', 'slskd_search_dispatch',
              'lastDispatchAttemptedAt', $1
            ),
            updated_at = NOW()
          FROM candidate
          WHERE library_discovery_requests.id = candidate.id
          RETURNING library_discovery_requests.*
        )
        SELECT
          claimed.metadata_artist_id,
          claimed.metadata_release_group_id,
          claimed.metadata_release_id,
          claimed.wanted_status,
          claimed.search_mode,
          claimed.request_status,
          claimed.release_date,
          claimed.last_search_at,
          claimed.next_search_after,
          claimed.evidence,
          candidate.artist_name,
          candidate.release_group_title,
          candidate.release_title
        FROM claimed
        JOIN candidate
          ON candidate.id = claimed.id
      `,
      [dispatchedAt, nextSearchAfter],
    );

    return mapDiscoveryDispatchRow(result.rows[0]);
  }

  async function recordDiscoverySearchFailure({
    errorCode,
    errorMessage,
    metadataReleaseId,
    searchQuery,
  }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE library_discovery_requests
        SET
          evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
            'dispatchStrategy', 'slskd_search_dispatch',
            'lastDispatchFailure', jsonb_build_object(
              'code', $1,
              'message', $2
            ),
            'lastSearchQuery', $3
          ),
          updated_at = NOW()
        WHERE metadata_release_id = $4
      `,
      [errorCode, errorMessage, searchQuery, metadataReleaseId],
    );
  }

  async function recordDiscoverySearchSuccess({
    candidateCount,
    fileCount,
    metadataReleaseId,
    searchId,
    searchQuery,
  }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE library_discovery_requests
        SET
          evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
            'dispatchStrategy', 'slskd_search_dispatch',
            'lastDispatchFailure', NULL,
            'lastSearchId', $1,
            'lastSearchQuery', $2,
            'lastSearchResult', jsonb_build_object(
              'candidateCount', $3,
              'fileCount', $4,
              'sourceProvider', 'slskd'
            )
          ),
          updated_at = NOW()
        WHERE metadata_release_id = $5
      `,
      [searchId, searchQuery, candidateCount, fileCount, metadataReleaseId],
    );
  }

  async function replaceLibraryDiscoveryRequests({ discoveryRequests }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM library_discovery_requests');

      for (const discoveryRequest of discoveryRequests) {
        await client.query(
          `
            INSERT INTO library_discovery_requests (
              metadata_artist_id,
              metadata_release_group_id,
              metadata_release_id,
              wanted_status,
              search_mode,
              request_status,
              blocked_reason,
              release_date,
              last_search_at,
              next_search_after,
              manual_requested_at,
              evidence,
              last_evaluated_at,
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
              $12::jsonb,
              NOW(),
              NOW()
            )
          `,
          [
            discoveryRequest.metadataArtistId,
            discoveryRequest.metadataReleaseGroupId,
            discoveryRequest.metadataReleaseId,
            discoveryRequest.wantedStatus,
            discoveryRequest.searchMode,
            discoveryRequest.requestStatus,
            discoveryRequest.blockedReason,
            discoveryRequest.releaseDate,
            discoveryRequest.lastSearchAt,
            discoveryRequest.nextSearchAfter,
            discoveryRequest.manualRequestedAt,
            JSON.stringify(discoveryRequest.evidence ?? {}),
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

  return {
    claimNextReadyAutomaticDiscoveryRequest,
    recordDiscoverySearchFailure,
    recordDiscoverySearchSuccess,
    replaceLibraryDiscoveryRequests,
  };
}