/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// These fragments use the owning wanted release (lwr), current discovery (ldr), and candidate aliases.
export const RELEASE_SAFE_ADD_OWNED_CANDIDATE_SQL = `(candidate.normalized_payload #>> '{musicQueue,wantedReleaseId}' = lwr.id::text
    OR COALESCE(candidate.normalized_payload #> '{musicQueue,wantedReleaseIds}', '[]'::jsonb) ? lwr.id::text
    OR candidate.normalized_payload #>> '{musicQueueContext,wantedReleaseId}' = lwr.id::text
    OR COALESCE(candidate.normalized_payload #> '{musicQueueContext,wantedReleaseIds}', '[]'::jsonb) ? lwr.id::text)`;

export const RELEASE_SAFE_ADD_CONFLICT_SQL = `EXISTS (SELECT 1 FROM import_candidates other WHERE other.id <> candidate.id
      AND other.status IN ('selected', 'downloading', 'import_pending')
      AND (other.source_search_id = candidate.source_search_id
        OR other.normalized_payload #>> '{discoveryScope,metadataReleaseId}' = lwr.metadata_release_id::text
        OR other.normalized_payload #>> '{requestOwnership,metadataReleaseId}' = lwr.metadata_release_id::text))
      OR EXISTS (SELECT 1 FROM library_discovery_request_wanted_release_links current_link
        WHERE current_link.discovery_request_id = ldr.id
          AND NOT COALESCE((candidate.normalized_payload #>> '{musicQueue,wantedReleaseId}' = current_link.wanted_release_id::text
            OR COALESCE(candidate.normalized_payload #> '{musicQueue,wantedReleaseIds}', '[]'::jsonb) ? current_link.wanted_release_id::text
            OR candidate.normalized_payload #>> '{musicQueueContext,wantedReleaseId}' = current_link.wanted_release_id::text
            OR COALESCE(candidate.normalized_payload #> '{musicQueueContext,wantedReleaseIds}', '[]'::jsonb) ? current_link.wanted_release_id::text), FALSE))
      OR EXISTS (SELECT 1 FROM library_discovery_request_wanted_release_links current_link
        JOIN library_wanted_releases participant ON participant.id = current_link.wanted_release_id
        JOIN app_users participant_owner ON participant_owner.id = participant.app_user_id
        WHERE current_link.discovery_request_id = ldr.id AND (participant_owner.is_disabled
          OR participant.wanted_status NOT IN ('missing', 'partial') OR participant.missing_track_count <= 0
          OR participant.evidence->>'visibilityState' = 'ignored'))
      OR EXISTS (SELECT 1 FROM (
        SELECT candidate.normalized_payload #>> '{musicQueue,wantedReleaseId}' AS wanted_id
        UNION ALL SELECT candidate.normalized_payload #>> '{musicQueueContext,wantedReleaseId}'
        UNION ALL SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(candidate.normalized_payload #> '{musicQueue,wantedReleaseIds}') = 'array'
          THEN candidate.normalized_payload #> '{musicQueue,wantedReleaseIds}' ELSE '[]'::jsonb END)
        UNION ALL SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(candidate.normalized_payload #> '{musicQueueContext,wantedReleaseIds}') = 'array'
          THEN candidate.normalized_payload #> '{musicQueueContext,wantedReleaseIds}' ELSE '[]'::jsonb END)
      ) original WHERE original.wanted_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM library_discovery_request_wanted_release_links current_link
        WHERE current_link.discovery_request_id = ldr.id AND current_link.wanted_release_id::text = original.wanted_id))`;

export const RELEASE_SAFE_ADD_ACTIVE_RUN_SQL = `LEFT JOIN LATERAL (SELECT runs.id, runs.status, runs.summary FROM operation_runs runs
    WHERE runs.operation_type = 'import_candidate_apply' AND runs.status IN ('pending', 'running')
    ORDER BY runs.created_at ASC, runs.id ASC LIMIT 1) active ON TRUE`;

export const RELEASE_SAFE_ADD_RUN_FACTS_SQL = `active.id AS active_run_id, active.status AS active_run_status,
    active.summary->>'applySafetyMode' AS active_run_safety_mode, active.summary->>'triggerSource' AS active_run_trigger_source,
    COALESCE(active.summary->'importCandidateIds' ? candidate.id::text, FALSE) AS run_matches_candidate,
    EXISTS (SELECT 1 FROM library_discovery_request_wanted_release_links marker_link
      WHERE marker_link.discovery_request_id = ldr.id AND marker_link.wanted_release_id::text =
        CASE active.summary->>'triggerSource'
          WHEN 'music_queue_prerequisite_recheck' THEN COALESCE(candidate.normalized_payload #>> '{musicQueue,recheckRequestedForWantedReleaseId}',
            candidate.normalized_payload #>> '{musicQueueContext,recheckRequestedForWantedReleaseId}')
          WHEN 'music_queue_manual_add' THEN COALESCE(candidate.normalized_payload #>> '{musicQueue,libraryAddRequestedForWantedReleaseId}',
            candidate.normalized_payload #>> '{musicQueueContext,libraryAddRequestedForWantedReleaseId}') END) AS owning_target_marker_valid`;
