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
import { buildImportCandidateSelectionReadiness } from '../import-candidates/import-candidate-selection-readiness.js';
import { normalizeMetadataReleaseDateForDateColumn } from '../metadata/metadata-release-date-normalization.js';

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function normalizeStatusCounts(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([status, count]) => [status, toInteger(count)])
      .filter(([, count]) => count > 0),
  );
}

function buildImportReviewSummary(row) {
  const totalCount = toInteger(row.import_candidate_total_count);
  if (totalCount < 1) {
    return null;
  }

  const summary = {
    latestStatus: row.import_candidate_latest_status ?? null,
    latestUpdatedAt: row.import_candidate_latest_updated_at ?? null,
    statusCounts: normalizeStatusCounts(row.import_candidate_status_counts),
    totalCount,
  };

  const selectionReadiness = buildImportCandidateSelectionReadiness({
    bestCompositeScore: row.import_candidate_best_composite_score,
    scoredCandidateCount: row.import_candidate_scored_count,
    secondBestCompositeScore: row.import_candidate_second_best_composite_score,
    statusCounts: summary.statusCounts,
    totalCount,
  });
  if (selectionReadiness) {
    summary.selectionReadiness = selectionReadiness;
  }

  const executionItemCount = toInteger(row.import_execution_item_total_count);
  if (executionItemCount > 0) {
    summary.downloadExecutionSummary = {
      enqueuedTransferCount: toInteger(row.import_execution_enqueued_transfer_count),
      failedFilenameCount: toInteger(row.import_execution_failed_filename_count),
      itemStatusCounts: normalizeStatusCounts(row.import_execution_item_status_counts),
      latestItemStatus: row.import_execution_latest_item_status ?? null,
      latestUpdatedAt: row.import_execution_latest_updated_at ?? null,
      totalItemCount: executionItemCount,
    };
  }

  return summary;
}

export function createLibraryWantedReleaseStore({
  getPoolFn = getPool,
} = {}) {
  async function listLibraryWantedReleases({ appUserId = null } = {}) {
    const params = [];
    const conditions = [];

    if (typeof appUserId === 'string' && appUserId.trim().length > 0) {
      params.push(appUserId.trim());
      conditions.push(`app_user_id = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          app_user_id,
          metadata_artist_id,
          metadata_release_group_id,
          metadata_release_id,
          wanted_status,
          expected_track_count,
          matched_track_count,
          missing_track_count,
          release_date,
          release_status,
          evidence
        FROM library_wanted_releases
        ${whereClause}
        ORDER BY app_user_id ASC, metadata_artist_id ASC, metadata_release_group_id ASC, metadata_release_id ASC
      `,
      params,
    );

    return result.rows.map((row) => ({
      appUserId: row.app_user_id,
      evidence: row.evidence ?? {},
      expectedTrackCount: row.expected_track_count,
      matchedTrackCount: row.matched_track_count,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: row.missing_track_count,
      releaseDate: row.release_date ?? null,
      releaseStatus: row.release_status ?? null,
      wantedStatus: row.wanted_status,
    }));
  }

  async function listWantedStatusesForReleaseGroups({ appUserId = null, metadataReleaseGroupIds } = {}) {
    if (!Array.isArray(metadataReleaseGroupIds) || metadataReleaseGroupIds.length < 1) {
      return [];
    }

    const params = [metadataReleaseGroupIds];
    const conditions = ['metadata_release_group_id::text = ANY($1::text[])'];

    if (typeof appUserId === 'string' && appUserId.trim().length > 0) {
      params.push(appUserId.trim());
      conditions.push(`app_user_id = $${params.length}`);
    }

    const result = await getPoolFn().query(
      `
        SELECT
          metadata_release_group_id,
          CASE
            WHEN BOOL_OR(wanted_status = 'missing') THEN 'missing'
            WHEN BOOL_OR(wanted_status = 'partial') THEN 'partial'
            ELSE MIN(wanted_status)
          END AS wanted_status
        FROM library_wanted_releases
        WHERE ${conditions.join(' AND ')}
        GROUP BY metadata_release_group_id
      `,
      params,
    );

    return result.rows.map((row) => ({
      metadataReleaseGroupId: row.metadata_release_group_id,
      wantedStatus: row.wanted_status,
    }));
  }

  async function replaceLibraryWantedReleases({ wantedReleases }) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM library_wanted_releases');

      for (const wantedRelease of wantedReleases) {
        await client.query(
          `
            INSERT INTO library_wanted_releases (
              app_user_id,
              metadata_artist_id,
              metadata_release_group_id,
              metadata_release_id,
              wanted_status,
              expected_track_count,
              matched_track_count,
              missing_track_count,
              release_date,
              release_status,
              evidence,
              last_reconciled_at,
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
              $11::jsonb,
              NOW(),
              NOW()
            )
          `,
          [
            wantedRelease.appUserId,
            wantedRelease.metadataArtistId,
            wantedRelease.metadataReleaseGroupId,
            wantedRelease.metadataReleaseId,
            wantedRelease.wantedStatus,
            wantedRelease.expectedTrackCount,
            wantedRelease.matchedTrackCount,
            wantedRelease.missingTrackCount,
            normalizeMetadataReleaseDateForDateColumn(wantedRelease.releaseDate),
            wantedRelease.releaseStatus,
            JSON.stringify(wantedRelease.evidence ?? {}),
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

  async function listWantedReleasesWithMetadata({ appUserId = null, wantedStatus = null, limit = 500 } = {}) {
    const params = [];
    const conditions = [];

    if (typeof appUserId === 'string' && appUserId.trim().length > 0) {
      params.push(appUserId.trim());
      conditions.push(`lwr.app_user_id = $${params.length}`);
    }

    if (wantedStatus === 'missing' || wantedStatus === 'partial') {
      params.push(wantedStatus);
      conditions.push(`lwr.wanted_status = $${params.length}`);
    }

    params.push(Math.min(Math.max(1, Number.parseInt(String(limit ?? 500), 10) || 500), 2000));
    const limitClause = `LIMIT $${params.length}`;

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await getPoolFn().query(
      `
        SELECT
          lwr.id,
          lwr.wanted_status,
          lwr.expected_track_count,
          lwr.matched_track_count,
          lwr.missing_track_count,
          lwr.release_date,
          lwr.release_status,
          lwr.last_reconciled_at,
          lwr.app_user_id,
          lwr.metadata_artist_id,
          lwr.metadata_release_group_id,
          lwr.metadata_release_id,
          ma.name AS artist_name,
          ma.sort_name AS artist_sort_name,
          mrg.title AS release_group_title,
          mrg.primary_type AS release_group_type,
          mrg.musicbrainz_release_group_id AS musicbrainz_release_group_id,
          mr.title AS release_title,
          mr.disambiguation AS release_disambiguation,
          mr.country AS release_country,
          mr.musicbrainz_release_id AS musicbrainz_release_id,
          ldr.request_status AS discovery_request_status,
          ldr.blocked_reason AS discovery_blocked_reason,
          ldr.last_search_at AS discovery_last_search_at,
          ldr.next_search_after AS discovery_next_search_after,
          ldr.search_attempt_count AS discovery_search_attempt_count,
          ldr.research_attempt_count AS discovery_research_attempt_count,
          ldr.evidence AS discovery_evidence,
          import_review_summary.total_count AS import_candidate_total_count,
          import_review_summary.status_counts AS import_candidate_status_counts,
          import_review_summary.latest_status AS import_candidate_latest_status,
          import_review_summary.latest_updated_at AS import_candidate_latest_updated_at,
          import_review_summary.best_composite_score AS import_candidate_best_composite_score,
          import_review_summary.second_best_composite_score AS import_candidate_second_best_composite_score,
          import_review_summary.scored_candidate_count AS import_candidate_scored_count,
          import_execution_summary.total_item_count AS import_execution_item_total_count,
          import_execution_summary.item_status_counts AS import_execution_item_status_counts,
          import_execution_summary.latest_item_status AS import_execution_latest_item_status,
          import_execution_summary.latest_updated_at AS import_execution_latest_updated_at,
          import_execution_summary.enqueued_transfer_count AS import_execution_enqueued_transfer_count,
          import_execution_summary.failed_filename_count AS import_execution_failed_filename_count
        FROM library_wanted_releases lwr
        JOIN metadata_artists ma ON ma.id = lwr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lwr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lwr.metadata_release_id
        LEFT JOIN library_discovery_requests ldr ON ldr.metadata_release_id = lwr.metadata_release_id
        LEFT JOIN LATERAL (
          WITH candidate_rows AS (
            SELECT
              ic.status,
              ic.updated_at,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'compositeScore') = 'number'
                  THEN (ic.normalized_payload->>'compositeScore')::numeric
                WHEN jsonb_typeof(ic.normalized_payload->'compositeScore') = 'string'
                  AND (ic.normalized_payload->>'compositeScore') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (ic.normalized_payload->>'compositeScore')::numeric
                ELSE NULL
              END AS composite_score
            FROM import_candidates ic
            WHERE ic.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
          )
          SELECT
            (SELECT COUNT(*)::integer FROM candidate_rows) AS total_count,
            (
              SELECT COALESCE(jsonb_object_agg(status_summary.status, status_summary.status_count), '{}'::jsonb)
              FROM (
                SELECT
                  candidate_rows.status,
                  COUNT(*)::integer AS status_count
                FROM candidate_rows
                GROUP BY candidate_rows.status
              ) status_summary
            ) AS status_counts,
            (
              SELECT candidate_rows.status
              FROM candidate_rows
              ORDER BY candidate_rows.updated_at DESC, candidate_rows.status ASC
              LIMIT 1
            ) AS latest_status,
            (SELECT MAX(candidate_rows.updated_at) FROM candidate_rows) AS latest_updated_at,
            (
              SELECT candidate_rows.composite_score
              FROM candidate_rows
              WHERE candidate_rows.composite_score IS NOT NULL
              ORDER BY candidate_rows.composite_score DESC NULLS LAST
              LIMIT 1
            ) AS best_composite_score,
            (
              SELECT ranked_scores.composite_score
              FROM (
                SELECT
                  candidate_rows.composite_score,
                  ROW_NUMBER() OVER (ORDER BY candidate_rows.composite_score DESC NULLS LAST) AS score_rank
                FROM candidate_rows
                WHERE candidate_rows.composite_score IS NOT NULL
              ) ranked_scores
              WHERE ranked_scores.score_rank = 2
            ) AS second_best_composite_score,
            (
              SELECT COUNT(candidate_rows.composite_score)::integer
              FROM candidate_rows
            ) AS scored_candidate_count
        ) import_review_summary ON TRUE
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*)::integer AS total_item_count,
            COALESCE(jsonb_object_agg(item_summary.item_status, item_summary.item_count), '{}'::jsonb) AS item_status_counts,
            (ARRAY_AGG(item_summary.item_status ORDER BY item_summary.latest_updated_at DESC, item_summary.item_status ASC))[1] AS latest_item_status,
            MAX(item_summary.latest_updated_at) AS latest_updated_at,
            COALESCE(SUM(item_summary.enqueued_transfer_count), 0)::integer AS enqueued_transfer_count,
            COALESCE(SUM(item_summary.failed_filename_count), 0)::integer AS failed_filename_count
          FROM (
            SELECT
              latest_item.item_status,
              COUNT(*)::integer AS item_count,
              MAX(latest_item.updated_at) AS latest_updated_at,
              COALESCE(SUM(
                CASE
                  WHEN jsonb_typeof(latest_item.planning_snapshot #> '{execution,enqueuedTransfers}') = 'array'
                    THEN jsonb_array_length(latest_item.planning_snapshot #> '{execution,enqueuedTransfers}')
                  ELSE 0
                END
              ), 0)::integer AS enqueued_transfer_count,
              COALESCE(SUM(
                CASE
                  WHEN jsonb_typeof(latest_item.planning_snapshot #> '{execution,failedFilenames}') = 'array'
                    THEN jsonb_array_length(latest_item.planning_snapshot #> '{execution,failedFilenames}')
                  ELSE 0
                END
              ), 0)::integer AS failed_filename_count
            FROM (
              SELECT DISTINCT ON (iei.import_candidate_id)
                iei.import_candidate_id,
                iei.item_status,
                iei.planning_snapshot,
                iei.updated_at
              FROM import_execution_run_items iei
              JOIN import_candidates ic
                ON ic.id = iei.import_candidate_id
              WHERE ic.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
              ORDER BY iei.import_candidate_id, iei.updated_at DESC, iei.created_at DESC
            ) latest_item
            GROUP BY latest_item.item_status
          ) item_summary
        ) import_execution_summary ON TRUE
        ${whereClause}
        ORDER BY ma.sort_name ASC NULLS LAST, ma.name ASC, mrg.first_release_date ASC NULLS LAST, mr.release_date ASC NULLS LAST
        ${limitClause}
      `,
      params,
    );

    return result.rows.map((row) => ({
      id: row.id,
      appUserId: row.app_user_id,
      artistName: row.artist_name,
      artistSortName: row.artist_sort_name ?? row.artist_name,
      discoveryRequest: row.discovery_request_status
        ? {
            blockedReason: row.discovery_blocked_reason ?? null,
            evidence: row.discovery_evidence ?? {},
            importReviewSummary: buildImportReviewSummary(row),
            lastSearchAt: row.discovery_last_search_at ?? null,
            nextSearchAfter: row.discovery_next_search_after ?? null,
            requestStatus: row.discovery_request_status,
            researchAttemptCount: Number.parseInt(String(row.discovery_research_attempt_count ?? 0), 10) || 0,
            searchAttemptCount: Number.parseInt(String(row.discovery_search_attempt_count ?? 0), 10) || 0,
          }
        : null,
      expectedTrackCount: Number.parseInt(String(row.expected_track_count ?? 0), 10) || 0,
      lastReconciledAt: row.last_reconciled_at ?? null,
      matchedTrackCount: Number.parseInt(String(row.matched_track_count ?? 0), 10) || 0,
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      missingTrackCount: Number.parseInt(String(row.missing_track_count ?? 0), 10) || 0,
      musicbrainzReleaseGroupId: row.musicbrainz_release_group_id ?? null,
      musicbrainzReleaseId: row.musicbrainz_release_id ?? null,
      releaseCountry: row.release_country ?? null,
      releaseDate: row.release_date ?? null,
      releaseDisambiguation: row.release_disambiguation ?? null,
      releaseGroupTitle: row.release_group_title,
      releaseGroupType: row.release_group_type ?? null,
      releaseStatus: row.release_status ?? null,
      releaseTitle: row.release_title,
      wantedStatus: row.wanted_status,
    }));
  }

  return {
    listLibraryWantedReleases,
    listWantedReleasesWithMetadata,
    listWantedStatusesForReleaseGroups,
    replaceLibraryWantedReleases,
  };
}
