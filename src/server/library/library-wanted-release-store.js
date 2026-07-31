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
import { createLibraryDiscoveryRequestWantedReleaseLinkStore } from './library-discovery-request-wanted-release-link-store.js';

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

function normalizeMatchRows(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((match) => match && typeof match === 'object')
    .map((match) => ({
      discoveredAt: match.discoveredAt ?? null,
      fileCount: toInteger(match.fileCount),
      formatMatchLabel: match.formatMatchLabel ?? null,
      formatMatchScore: match.formatMatchScore ?? null,
      formats: Array.isArray(match.formats) ? match.formats : [],
      hasFreeUploadSlot: match.hasFreeUploadSlot === true,
      lockedFileCount: toInteger(match.lockedFileCount),
      matchId: match.matchId ?? null,
      queueLength: match.queueLength ?? null,
      score: match.score ?? null,
      scoreBreakdown: match.scoreBreakdown && typeof match.scoreBreakdown === 'object'
        ? match.scoreBreakdown
        : null,
      sourceProvider: match.sourceProvider ?? null,
      status: match.status ?? null,
      totalSizeBytes: match.totalSizeBytes ?? null,
      trackMatchSummary: match.trackMatchSummary && typeof match.trackMatchSummary === 'object'
        ? match.trackMatchSummary
        : null,
      updatedAt: match.updatedAt ?? null,
      uploadSpeed: match.uploadSpeed ?? null,
    }));
}

function normalizeQualityGate(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return {
    blockers: Array.isArray(value.blockers)
      ? value.blockers.map((blocker) => ({
          code: blocker?.code ?? null,
          fileId: blocker?.fileId ?? null,
          filename: blocker?.filename ?? null,
          message: blocker?.message ?? null,
        }))
      : [],
    checkedFileCount: toInteger(value.checkedFileCount),
    message: value.message ?? null,
    profileCode: value.profileCode ?? null,
    status: value.status ?? null,
  };
}

function buildLibraryAddSummary(row) {
  const totalItemCount = toInteger(row.import_apply_item_total_count);
  if (totalItemCount < 1) {
    return null;
  }

  const summary = {
    itemStatusCounts: normalizeStatusCounts(row.import_apply_item_status_counts),
    latestItemStatus: row.import_apply_latest_item_status ?? null,
    latestOutcome: row.import_apply_latest_outcome ?? null,
    latestQualityBlockedMessage: row.import_apply_latest_quality_blocked_message ?? null,
    latestQualityGate: normalizeQualityGate(row.import_apply_latest_quality_gate),
    latestUpdatedAt: row.import_apply_latest_updated_at ?? null,
    qualityBlockedCount: toInteger(row.import_apply_quality_blocked_count),
    totalItemCount,
  };

  if (typeof row.import_apply_latest_add_blocker_code === 'string'
    && row.import_apply_latest_add_blocker_code.length > 0) {
    summary.latestAddBlockerCode = row.import_apply_latest_add_blocker_code;
  }

  return summary;
}

function buildImportReviewSummary(row) {
  const totalCount = toInteger(row.import_candidate_total_count);
  if (totalCount < 1) {
    return null;
  }

  const summary = {
    latestStatus: row.import_candidate_latest_status ?? null,
    latestUpdatedAt: row.import_candidate_latest_updated_at ?? null,
    matches: normalizeMatchRows(row.import_candidate_matches),
    statusCounts: normalizeStatusCounts(row.import_candidate_status_counts),
    totalCount,
  };

  if (typeof row.import_candidate_latest_event_type === 'string'
    && row.import_candidate_latest_event_type.length > 0) {
    summary.latestEventType = row.import_candidate_latest_event_type;
  }

  if (typeof row.import_candidate_latest_add_blocker_code === 'string'
    && row.import_candidate_latest_add_blocker_code.length > 0) {
    summary.latestAddBlockerCode = row.import_candidate_latest_add_blocker_code;
  }

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

  const recoverySelectedCount = toInteger(row.import_candidate_recovery_selected_count);
  if (recoverySelectedCount > 0) {
    summary.recoverySelectedCount = recoverySelectedCount;
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

  const libraryAddSummary = buildLibraryAddSummary(row);
  if (libraryAddSummary) {
    summary.libraryAddSummary = libraryAddSummary;
  }

  return summary;
}

export function createLibraryWantedReleaseStore({
  getPoolFn = getPool,
  libraryDiscoveryRequestWantedReleaseLinkStore = createLibraryDiscoveryRequestWantedReleaseLinkStore(),
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

      const scopedWantedReleases = wantedReleases.filter((wantedRelease) => (
        typeof wantedRelease?.appUserId === 'string'
        && wantedRelease.appUserId.trim()
        && typeof wantedRelease?.metadataReleaseId === 'string'
        && wantedRelease.metadataReleaseId.trim()
      ));
      const appUserIds = scopedWantedReleases
        .map((wantedRelease) => wantedRelease.appUserId)
        .filter((appUserId) => typeof appUserId === 'string' && appUserId.trim());
      const metadataReleaseIds = scopedWantedReleases
        .map((wantedRelease) => wantedRelease.metadataReleaseId)
        .filter((metadataReleaseId) => typeof metadataReleaseId === 'string' && metadataReleaseId.trim());

      if (appUserIds.length > 0) {
        await client.query(
          `
            DELETE FROM library_wanted_releases
            WHERE NOT EXISTS (
              SELECT 1
              FROM UNNEST($1::uuid[], $2::uuid[]) AS current_wanted_releases(app_user_id, metadata_release_id)
              WHERE current_wanted_releases.app_user_id = library_wanted_releases.app_user_id
                AND current_wanted_releases.metadata_release_id = library_wanted_releases.metadata_release_id
            )
          `,
          [appUserIds, metadataReleaseIds],
        );
      } else {
        await client.query('DELETE FROM library_wanted_releases');
      }

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
            ON CONFLICT (app_user_id, metadata_release_id) DO UPDATE
            SET
              metadata_artist_id = EXCLUDED.metadata_artist_id,
              metadata_release_group_id = EXCLUDED.metadata_release_group_id,
              wanted_status = EXCLUDED.wanted_status,
              expected_track_count = EXCLUDED.expected_track_count,
              matched_track_count = EXCLUDED.matched_track_count,
              missing_track_count = EXCLUDED.missing_track_count,
              release_date = EXCLUDED.release_date,
              release_status = EXCLUDED.release_status,
              evidence = EXCLUDED.evidence,
              last_reconciled_at = EXCLUDED.last_reconciled_at,
              updated_at = EXCLUDED.updated_at
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

      await libraryDiscoveryRequestWantedReleaseLinkStore.syncActiveWantedReleaseLinks({ client });

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listWantedReleasesWithMetadata({
    appUserId = null,
    metadataArtistId = null,
    wantedStatus = null,
    limit = 500,
  } = {}) {
    const params = [];
    const conditions = [];

    if (typeof appUserId === 'string' && appUserId.trim().length > 0) {
      params.push(appUserId.trim());
      conditions.push(`lwr.app_user_id = $${params.length}`);
    }

    if (typeof metadataArtistId === 'string' && metadataArtistId.trim().length > 0) {
      params.push(metadataArtistId.trim());
      conditions.push(`lwr.metadata_artist_id = $${params.length}`);
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
          import_review_summary.latest_event_type AS import_candidate_latest_event_type,
          import_review_summary.latest_add_blocker_code AS import_candidate_latest_add_blocker_code,
          import_review_summary.best_composite_score AS import_candidate_best_composite_score,
          import_review_summary.second_best_composite_score AS import_candidate_second_best_composite_score,
          import_review_summary.scored_candidate_count AS import_candidate_scored_count,
          import_review_summary.recovery_selected_count AS import_candidate_recovery_selected_count,
          import_match_drilldown.matches AS import_candidate_matches,
          import_execution_summary.total_item_count AS import_execution_item_total_count,
          import_execution_summary.item_status_counts AS import_execution_item_status_counts,
          import_execution_summary.latest_item_status AS import_execution_latest_item_status,
          import_execution_summary.latest_updated_at AS import_execution_latest_updated_at,
          import_execution_summary.enqueued_transfer_count AS import_execution_enqueued_transfer_count,
          import_execution_summary.failed_filename_count AS import_execution_failed_filename_count,
          import_apply_summary.total_item_count AS import_apply_item_total_count,
          import_apply_summary.item_status_counts AS import_apply_item_status_counts,
          import_apply_summary.latest_item_status AS import_apply_latest_item_status,
          import_apply_summary.latest_add_blocker_code AS import_apply_latest_add_blocker_code,
          import_apply_summary.latest_outcome AS import_apply_latest_outcome,
          import_apply_summary.latest_updated_at AS import_apply_latest_updated_at,
          import_apply_summary.quality_blocked_count AS import_apply_quality_blocked_count,
          import_apply_summary.latest_quality_blocked_message AS import_apply_latest_quality_blocked_message,
          import_apply_summary.latest_quality_gate AS import_apply_latest_quality_gate
        FROM library_wanted_releases lwr
        JOIN metadata_artists ma ON ma.id = lwr.metadata_artist_id
        JOIN metadata_release_groups mrg ON mrg.id = lwr.metadata_release_group_id
        JOIN metadata_releases mr ON mr.id = lwr.metadata_release_id
        LEFT JOIN library_discovery_requests ldr ON ldr.metadata_release_id = lwr.metadata_release_id
        LEFT JOIN LATERAL (
          WITH candidate_rows AS (
            SELECT
              ic.id,
              ic.status,
              ic.selection_reason,
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
              SELECT ice.event_type
              FROM import_candidate_events ice
              JOIN candidate_rows ON candidate_rows.id = ice.import_candidate_id
              ORDER BY ice.occurred_at DESC, ice.created_at DESC, ice.id DESC
              LIMIT 1
            ) AS latest_event_type,
            (
              SELECT NULLIF(ice.details->>'addBlockerCode', '')
              FROM import_candidate_events ice
              JOIN candidate_rows ON candidate_rows.id = ice.import_candidate_id
              WHERE ice.event_type = 'import_candidate_import_blocked'
              ORDER BY ice.occurred_at DESC, ice.created_at DESC, ice.id DESC
              LIMIT 1
            ) AS latest_add_blocker_code,
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
            ) AS scored_candidate_count,
            (
              SELECT COUNT(*)::integer
              FROM candidate_rows
              WHERE candidate_rows.status = 'selected'
                AND candidate_rows.selection_reason = 'recovery_cascade'
            ) AS recovery_selected_count
        ) import_review_summary ON TRUE
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'discoveredAt', match_rows.discovered_at,
                'fileCount', match_rows.file_count,
                'formatMatchLabel', match_rows.format_match_label,
                'formatMatchScore', match_rows.format_match_score,
                'formats', match_rows.formats,
                'hasFreeUploadSlot', match_rows.has_free_upload_slot,
                'lockedFileCount', match_rows.locked_file_count,
                'matchId', match_rows.id,
                'queueLength', match_rows.queue_length,
                'score', match_rows.composite_score,
                'scoreBreakdown', match_rows.score_breakdown,
                'sourceProvider', match_rows.source_provider,
                'status', match_rows.status,
                'totalSizeBytes', match_rows.total_size_bytes,
                'trackMatchSummary', match_rows.track_match_summary,
                'updatedAt', match_rows.updated_at,
                'uploadSpeed', match_rows.upload_speed
              )
              ORDER BY match_rows.composite_score DESC NULLS LAST, match_rows.updated_at DESC
            ),
            '[]'::jsonb
          ) AS matches
          FROM (
            SELECT
              ic.id,
              ic.source_provider,
              ic.status,
              ic.file_count,
              ic.locked_file_count,
              ic.total_size_bytes,
              ic.discovered_at,
              ic.updated_at,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'compositeScore') = 'number'
                  THEN (ic.normalized_payload->>'compositeScore')::numeric
                WHEN jsonb_typeof(ic.normalized_payload->'compositeScore') = 'string'
                  AND (ic.normalized_payload->>'compositeScore') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (ic.normalized_payload->>'compositeScore')::numeric
                ELSE NULL
              END AS composite_score,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'extensions') = 'array'
                  THEN ic.normalized_payload->'extensions'
                ELSE '[]'::jsonb
              END AS formats,
              ic.normalized_payload->>'formatMatchLabel' AS format_match_label,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'formatMatchScore') = 'number'
                  THEN (ic.normalized_payload->>'formatMatchScore')::numeric
                WHEN jsonb_typeof(ic.normalized_payload->'formatMatchScore') = 'string'
                  AND (ic.normalized_payload->>'formatMatchScore') ~ '^-?[0-9]+(\\.[0-9]+)?$'
                  THEN (ic.normalized_payload->>'formatMatchScore')::numeric
                ELSE NULL
              END AS format_match_score,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'hasFreeUploadSlot') = 'boolean'
                  THEN (ic.normalized_payload->>'hasFreeUploadSlot')::boolean
                ELSE FALSE
              END AS has_free_upload_slot,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'queueLength') = 'number'
                  THEN (ic.normalized_payload->>'queueLength')::integer
                WHEN jsonb_typeof(ic.normalized_payload->'queueLength') = 'string'
                  AND (ic.normalized_payload->>'queueLength') ~ '^[0-9]+$'
                  THEN (ic.normalized_payload->>'queueLength')::integer
                ELSE NULL
              END AS queue_length,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'uploadSpeed') = 'number'
                  THEN (ic.normalized_payload->>'uploadSpeed')::bigint
                WHEN jsonb_typeof(ic.normalized_payload->'uploadSpeed') = 'string'
                  AND (ic.normalized_payload->>'uploadSpeed') ~ '^[0-9]+$'
                  THEN (ic.normalized_payload->>'uploadSpeed')::bigint
                ELSE NULL
              END AS upload_speed,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'scoreBreakdown') = 'object'
                  THEN ic.normalized_payload->'scoreBreakdown'
                ELSE NULL
              END AS score_breakdown,
              CASE
                WHEN jsonb_typeof(ic.normalized_payload->'trackMatchSummary') = 'object'
                  THEN ic.normalized_payload->'trackMatchSummary'
                ELSE NULL
              END AS track_match_summary
            FROM import_candidates ic
            WHERE ic.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
            ORDER BY composite_score DESC NULLS LAST, ic.updated_at DESC, ic.id ASC
            LIMIT 5
          ) match_rows
        ) import_match_drilldown ON TRUE
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
        LEFT JOIN LATERAL (
          WITH latest_items AS (
            SELECT DISTINCT ON (iai.import_candidate_id)
              iai.import_candidate_id,
              iai.item_status,
              iai.status_message,
              iai.apply_snapshot,
              iai.updated_at
            FROM import_apply_run_items iai
            JOIN import_candidates ic
              ON ic.id = iai.import_candidate_id
            WHERE ic.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
            ORDER BY iai.import_candidate_id, iai.updated_at DESC, iai.created_at DESC
          )
          SELECT
            COUNT(*)::integer AS total_item_count,
            COALESCE(
              (
                SELECT jsonb_object_agg(status_summary.item_status, status_summary.item_count)
                FROM (
                  SELECT
                    latest_items.item_status,
                    COUNT(*)::integer AS item_count
                  FROM latest_items
                  GROUP BY latest_items.item_status
                ) status_summary
              ),
              '{}'::jsonb
            ) AS item_status_counts,
            (
              SELECT latest_items.item_status
              FROM latest_items
              ORDER BY latest_items.updated_at DESC, latest_items.item_status ASC
              LIMIT 1
            ) AS latest_item_status,
            (
              SELECT CASE
                WHEN latest_items.apply_snapshot #>> '{apply,outcome}' = 'quality_blocked'
                  THEN 'media_verification'
                WHEN NULLIF(latest_items.apply_snapshot #>> '{apply,addBlockerCode}', '') IS NOT NULL
                  THEN latest_items.apply_snapshot #>> '{apply,addBlockerCode}'
                WHEN latest_items.item_status = 'apply_failed'
                  THEN 'add_failed'
                WHEN latest_items.item_status = 'blocked'
                  THEN 'unsafe_add_plan'
                ELSE NULL
              END
              FROM latest_items
              ORDER BY latest_items.updated_at DESC, latest_items.item_status ASC
              LIMIT 1
            ) AS latest_add_blocker_code,
            (
              SELECT latest_items.apply_snapshot #>> '{apply,outcome}'
              FROM latest_items
              ORDER BY latest_items.updated_at DESC, latest_items.item_status ASC
              LIMIT 1
            ) AS latest_outcome,
            MAX(latest_items.updated_at) AS latest_updated_at,
            COUNT(*) FILTER (
              WHERE latest_items.apply_snapshot #>> '{apply,outcome}' = 'quality_blocked'
            )::integer AS quality_blocked_count,
            (
              SELECT latest_items.status_message
              FROM latest_items
              WHERE latest_items.apply_snapshot #>> '{apply,outcome}' = 'quality_blocked'
              ORDER BY latest_items.updated_at DESC, latest_items.item_status ASC
              LIMIT 1
            ) AS latest_quality_blocked_message,
            (
              SELECT latest_items.apply_snapshot #> '{apply,qualityGate}'
              FROM latest_items
              WHERE latest_items.apply_snapshot #>> '{apply,outcome}' = 'quality_blocked'
              ORDER BY latest_items.updated_at DESC, latest_items.item_status ASC
              LIMIT 1
            ) AS latest_quality_gate
          FROM latest_items
        ) import_apply_summary ON TRUE
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
