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
    researchAttemptCount: Number.parseInt(String(row.research_attempt_count ?? 0), 10) || 0,
    releaseDate: row.release_date ?? null,
    releaseGroupTitle: row.release_group_title ?? null,
    releaseTitle: row.release_title ?? null,
    requestStatus: row.request_status ?? null,
    searchAttemptCount: Number.parseInt(String(row.search_attempt_count ?? 0), 10) || 0,
    searchMode: row.search_mode ?? null,
    wantedStatus: row.wanted_status ?? null,
  };
}

function mapDiscoveryRequestStateRow(row) {
  if (!row) {
    return null;
  }

  return {
    artistName: row.artist_name ?? null,
    blockedReason: row.blocked_reason ?? null,
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
    researchAttemptCount: Number.parseInt(String(row.research_attempt_count ?? 0), 10) || 0,
    searchAttemptCount: Number.parseInt(String(row.search_attempt_count ?? 0), 10) || 0,
    searchMode: row.search_mode ?? null,
    wantedStatus: row.wanted_status ?? null,
  };
}

export function createLibraryDiscoveryRequestStore({
  getPoolFn = getPool,
} = {}) {
  async function listDiscoveryRequestsByMetadataReleaseIds({ metadataReleaseIds } = {}) {
    if (!Array.isArray(metadataReleaseIds) || metadataReleaseIds.length < 1) {
      return [];
    }

    const result = await getPoolFn().query(
      `
        SELECT
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
          search_attempt_count,
          research_attempt_count,
          evidence
        FROM library_discovery_requests
        WHERE metadata_release_id = ANY($1::uuid[])
        ORDER BY metadata_release_id ASC
      `,
      [metadataReleaseIds],
    );

    return result.rows.map((row) => ({
      blockedReason: row.blocked_reason ?? null,
      evidence: row.evidence ?? {},
      lastSearchAt: row.last_search_at ?? null,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      nextSearchAfter: row.next_search_after ?? null,
      researchAttemptCount: Number.parseInt(String(row.research_attempt_count ?? 0), 10) || 0,
      releaseDate: row.release_date ?? null,
      requestStatus: row.request_status ?? null,
      searchAttemptCount: Number.parseInt(String(row.search_attempt_count ?? 0), 10) || 0,
      searchMode: row.search_mode ?? null,
      wantedStatus: row.wanted_status ?? null,
    }));
  }

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
            library_discovery_requests.search_attempt_count,
            library_discovery_requests.research_attempt_count,
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
          claimed.search_attempt_count,
          claimed.research_attempt_count,
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
              'code', $1::text,
              'message', $2::text
            ),
            'lastSearchQuery', $3::text
          ),
          updated_at = NOW()
        WHERE metadata_release_id = $4
      `,
      [errorCode, errorMessage, searchQuery, metadataReleaseId],
    );
  }

  async function recordDiscoverySearchSuccess({
    autoSelection = null,
    candidateCount,
    fileCount,
    ingestionDiagnostics = null,
    metadataReleaseId,
    nextSearchAfter = undefined,
    searchId,
    searchAttemptCount = undefined,
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
            'lastSearchId', $1::text,
            'lastSearchQuery', $2::text,
            'lastSearchResult', jsonb_strip_nulls(jsonb_build_object(
              'candidateCount', $3::integer,
              'autoSelection', $9::jsonb,
              'fileCount', $4::integer,
              'ingestionDiagnostics', $8::jsonb,
              'sourceProvider', 'slskd'
            )),
            'lastSearchAttemptCount', COALESCE($6::integer, search_attempt_count)
          ),
          next_search_after = COALESCE($7::timestamptz, next_search_after),
          search_attempt_count = COALESCE($6::integer, search_attempt_count),
          updated_at = NOW()
        WHERE metadata_release_id = $5
      `,
      [
        searchId,
        searchQuery,
        candidateCount,
        fileCount,
        metadataReleaseId,
        searchAttemptCount,
        nextSearchAfter,
        ingestionDiagnostics ? JSON.stringify(ingestionDiagnostics) : null,
        autoSelection ? JSON.stringify(autoSelection) : null,
      ],
    );
  }

  async function scheduleDownloadRecoveryRediscovery({
    failureReason = null,
    maxResearchAttemptCount,
    metadataReleaseId,
    nextSearchAfter,
    searchAttemptCount,
    sourceOperationRunId = null,
    sourceSearchId = null,
    triggeredByFailedCandidateId,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        UPDATE library_discovery_requests
        SET
          request_status = 'ready',
          blocked_reason = NULL,
          next_search_after = $2::timestamptz,
          search_attempt_count = $3::integer,
          research_attempt_count = research_attempt_count + 1,
          evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
            'downloadRecoveryRediscovery',
            jsonb_build_object(
              'failureReason', $6::text,
              'nextSearchAfter', $2::timestamptz,
              'researchAttemptCount', research_attempt_count + 1,
              'searchAttemptCount', $3::integer,
              'sourceOperationRunId', $7::text,
              'sourceSearchId', $8::text,
              'triggeredByFailedCandidateId', $5::text
            )
          ),
          updated_at = NOW()
        WHERE metadata_release_id = $1
          AND search_mode = 'automatic'
          AND research_attempt_count < $4::integer
          AND NOT (
            request_status = 'ready'
            AND next_search_after IS NOT NULL
            AND next_search_after > NOW()
            AND evidence ? 'downloadRecoveryRediscovery'
          )
        RETURNING
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
          search_attempt_count,
          research_attempt_count,
          evidence
      `,
      [
        metadataReleaseId,
        nextSearchAfter,
        searchAttemptCount,
        maxResearchAttemptCount,
        triggeredByFailedCandidateId,
        failureReason,
        sourceOperationRunId,
        sourceSearchId,
      ],
    );

    return mapDiscoveryRequestStateRow(result.rows[0]);
  }

  async function getDownloadRecoveryRediscoveryState({ metadataReleaseId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          library_discovery_requests.metadata_artist_id,
          library_discovery_requests.metadata_release_group_id,
          library_discovery_requests.metadata_release_id,
          library_discovery_requests.wanted_status,
          library_discovery_requests.search_mode,
          library_discovery_requests.request_status,
          library_discovery_requests.blocked_reason,
          library_discovery_requests.release_date,
          library_discovery_requests.last_search_at,
          library_discovery_requests.next_search_after,
          library_discovery_requests.search_attempt_count,
          library_discovery_requests.research_attempt_count,
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
        WHERE library_discovery_requests.metadata_release_id = $1
        LIMIT 1
      `,
      [metadataReleaseId],
    );

    return mapDiscoveryRequestStateRow(result.rows[0]);
  }

  async function markDownloadRecoveryRediscoveryExhausted({
    failureReason = null,
    maxResearchAttemptCount,
    metadataReleaseId,
    sourceOperationRunId = null,
    sourceSearchId = null,
    triggeredByFailedCandidateId,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH exhausted AS (
          UPDATE library_discovery_requests
          SET
            request_status = 'blocked',
            blocked_reason = 'download_recovery_exhausted',
            next_search_after = NULL,
            evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
              'downloadRecoveryExhausted',
              jsonb_build_object(
                'failureReason', $4::text,
                'maxResearchAttemptCount', $2::integer,
                'researchAttemptCount', research_attempt_count,
                'sourceOperationRunId', $5::text,
                'sourceSearchId', $6::text,
                'triggeredByFailedCandidateId', $3::text
              )
            ),
            updated_at = NOW()
          WHERE metadata_release_id = $1
            AND search_mode = 'automatic'
            AND research_attempt_count >= $2::integer
            AND NOT (
              request_status = 'ready'
              AND next_search_after IS NOT NULL
              AND next_search_after > NOW()
              AND evidence ? 'downloadRecoveryRediscovery'
            )
          RETURNING *
        )
        SELECT
          exhausted.metadata_artist_id,
          exhausted.metadata_release_group_id,
          exhausted.metadata_release_id,
          exhausted.wanted_status,
          exhausted.search_mode,
          exhausted.request_status,
          exhausted.blocked_reason,
          exhausted.release_date,
          exhausted.last_search_at,
          exhausted.next_search_after,
          exhausted.search_attempt_count,
          exhausted.research_attempt_count,
          exhausted.evidence,
          metadata_artists.name AS artist_name,
          metadata_release_groups.title AS release_group_title,
          metadata_releases.title AS release_title
        FROM exhausted
        JOIN metadata_artists
          ON metadata_artists.id = exhausted.metadata_artist_id
        JOIN metadata_release_groups
          ON metadata_release_groups.id = exhausted.metadata_release_group_id
        JOIN metadata_releases
          ON metadata_releases.id = exhausted.metadata_release_id
      `,
      [
        metadataReleaseId,
        maxResearchAttemptCount,
        triggeredByFailedCandidateId,
        failureReason,
        sourceOperationRunId,
        sourceSearchId,
      ],
    );

    return mapDiscoveryRequestStateRow(result.rows[0]);
  }

  async function resetDownloadRecoveryExhaustion({
    metadataReleaseId,
    resetAt,
    resetByUserId = null,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        WITH reset AS (
          UPDATE library_discovery_requests
          SET
            search_mode = 'automatic',
            request_status = 'ready',
            blocked_reason = NULL,
            last_search_at = NULL,
            next_search_after = $2::timestamptz,
            manual_requested_at = NULL,
            search_attempt_count = 0,
            research_attempt_count = 0,
            evidence = (
              COALESCE(evidence, '{}'::jsonb)
                - 'downloadRecoveryExhausted'
                - 'downloadRecoveryRediscovery'
            ) || jsonb_build_object(
              'manualDownloadRecoveryRetry',
              jsonb_build_object(
                'priorBlockedReason', blocked_reason,
                'priorResearchAttemptCount', research_attempt_count,
                'priorSearchAttemptCount', search_attempt_count,
                'resetAt', $2::timestamptz,
                'resetByUserId', $3::text
              )
            ),
            updated_at = NOW()
          WHERE metadata_release_id = $1
            AND search_mode = 'automatic'
            AND request_status = 'blocked'
            AND blocked_reason = 'download_recovery_exhausted'
          RETURNING *
        )
        SELECT
          reset.metadata_artist_id,
          reset.metadata_release_group_id,
          reset.metadata_release_id,
          reset.wanted_status,
          reset.search_mode,
          reset.request_status,
          reset.blocked_reason,
          reset.release_date,
          reset.last_search_at,
          reset.next_search_after,
          reset.search_attempt_count,
          reset.research_attempt_count,
          reset.evidence,
          metadata_artists.name AS artist_name,
          metadata_release_groups.title AS release_group_title,
          metadata_releases.title AS release_title
        FROM reset
        JOIN metadata_artists
          ON metadata_artists.id = reset.metadata_artist_id
        JOIN metadata_release_groups
          ON metadata_release_groups.id = reset.metadata_release_group_id
        JOIN metadata_releases
          ON metadata_releases.id = reset.metadata_release_id
      `,
      [metadataReleaseId, resetAt, resetByUserId],
    );

    return mapDiscoveryRequestStateRow(result.rows[0]);
  }

  async function markDiscoveryRequestExhausted({
    metadataReleaseId,
    reasonCode = 'discovery_search_attempts_exhausted',
    searchAttemptCount,
    searchQuery,
  }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE library_discovery_requests
        SET
          request_status = 'blocked',
          blocked_reason = 'search_attempts_exhausted',
          next_search_after = NULL,
          search_attempt_count = GREATEST(search_attempt_count, COALESCE($3::integer, search_attempt_count)),
          evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object(
            'dispatchStrategy', 'slskd_search_dispatch',
            'lastDispatchFailure', NULL,
            'lastSearchQuery', $2::text,
            'searchExhausted', jsonb_build_object(
              'reasonCode', $4::text,
              'searchAttemptCount', GREATEST(search_attempt_count, COALESCE($3::integer, search_attempt_count))
            )
          ),
          updated_at = NOW()
        WHERE metadata_release_id = $1
      `,
      [metadataReleaseId, searchQuery, searchAttemptCount, reasonCode],
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
              search_attempt_count,
              research_attempt_count,
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
              $12,
              $13,
              $14::jsonb,
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
            discoveryRequest.searchAttemptCount ?? 0,
            discoveryRequest.researchAttemptCount ?? 0,
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
    getDownloadRecoveryRediscoveryState,
    listDiscoveryRequestsByMetadataReleaseIds,
    markDownloadRecoveryRediscoveryExhausted,
    markDiscoveryRequestExhausted,
    recordDiscoverySearchFailure,
    recordDiscoverySearchSuccess,
    resetDownloadRecoveryExhaustion,
    scheduleDownloadRecoveryRediscovery,
    replaceLibraryDiscoveryRequests,
  };
}
