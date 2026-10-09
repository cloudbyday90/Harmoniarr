/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

// Correlated with the owning wanted release (lwr) and current discovery (ldr).
// Raw observations stay inside the read mapper; only bounded facts leave it.
export const WANTED_RECOVERY_PROGRESS_SELECT_SQL = `recovery_progress.entries AS recovery_progress_entries,
  discovery_recovery.value AS recovery_discovery_entry`;

const CANDIDATE_JSON_SQL = `jsonb_build_object(
  'id', candidate.id, 'status', candidate.status, 'selectionReason', candidate.selection_reason,
  'sourceSearchId', candidate.source_search_id, 'sourceProvider', candidate.source_provider,
  'sourceResponseKey', candidate.source_response_key, 'username', candidate.username,
  'folderPath', candidate.folder_path, 'normalizedPayload', candidate.normalized_payload,
  'files', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id', files.id, 'filename', files.filename, 'sizeBytes', files.size_bytes,
    'extension', files.extension, 'bitRateKbps', files.bit_rate_kbps, 'isLocked', files.is_locked,
    'folderPath', files.folder_path, 'rawPayload', files.raw_payload
  ) ORDER BY files.source_file_index ASC) FROM import_candidate_files files
    WHERE files.import_candidate_id = candidate.id), '[]'::jsonb))`;

const PARTICIPANTS_JSON_SQL = `COALESCE((SELECT jsonb_agg(jsonb_build_object(
  'wantedReleaseId', participant.id, 'appUserId', participant.app_user_id,
  'metadataReleaseId', participant.metadata_release_id, 'wantedStatus', participant.wanted_status,
  'missingTrackCount', participant.missing_track_count, 'visibilityState', participant.evidence->>'visibilityState',
  'isDisabled', participant_owner.is_disabled, 'qualityPreferences', participant_owner.user_preferences,
  'qualityProfile', participant.evidence->>'qualityProfile',
  'discoveryLinkExists', current_link.wanted_release_id IS NOT NULL,
  'qualityOverride', current_link.evidence->'musicQueueQualityOverride'
) ORDER BY participant.id)
  FROM library_wanted_releases participant JOIN app_users participant_owner ON participant_owner.id = participant.app_user_id
  LEFT JOIN library_discovery_request_wanted_release_links current_link
    ON current_link.wanted_release_id = participant.id AND current_link.discovery_request_id = ldr.id
  WHERE current_link.wanted_release_id IS NOT NULL
    OR participant.id::text = candidate.normalized_payload #>> '{musicQueue,wantedReleaseId}'
    OR COALESCE(candidate.normalized_payload #> '{musicQueue,wantedReleaseIds}', '[]'::jsonb) ? participant.id::text
    OR participant.id::text = candidate.normalized_payload #>> '{musicQueueContext,wantedReleaseId}'
    OR COALESCE(candidate.normalized_payload #> '{musicQueueContext,wantedReleaseIds}', '[]'::jsonb) ? participant.id::text
    OR COALESCE(recovery_run.value #> '{summary,musicQueueRecovery,authority,wantedReleaseIds}', '[]'::jsonb) ? participant.id::text
), '[]'::jsonb)`;

export const WANTED_RECOVERY_PROGRESS_JOIN_SQL = `LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'candidate', ${CANDIDATE_JSON_SQL},
    'recoveryRun', recovery_run.value,
    'currentHandoff', current_handoff.value,
    'latestExecutionOriginId', (SELECT origin.id FROM operation_runs origin
      WHERE origin.operation_type = 'import_candidate_execution_planning'
        AND (origin.summary->>'selectedCandidateId' = candidate.id::text
          OR EXISTS (SELECT 1 FROM import_execution_run_items origin_item
            WHERE origin_item.operation_run_id = origin.id AND origin_item.import_candidate_id = candidate.id))
      ORDER BY origin.created_at DESC, origin.id DESC LIMIT 1),
    'legacyRecoverySelection', candidate.selection_reason = 'recovery_cascade' AND (
      candidate.normalized_payload ? 'musicQueue' OR candidate.normalized_payload ? 'musicQueueContext'
      OR EXISTS (SELECT 1 FROM operation_runs legacy
        WHERE legacy.operation_type = 'import_candidate_execution_planning' AND legacy.summary ? 'recoveryCascade'
          AND legacy.summary->>'selectedCandidateId' = candidate.id::text)),
    'independentlySelected', EXISTS (SELECT 1 FROM import_candidate_events selection_event
      WHERE selection_event.import_candidate_id = candidate.id AND selection_event.event_type = 'import_candidate_selected'
        AND selection_event.actor_user_id IS NOT NULL AND selection_event.created_at > (recovery_run.value->>'createdAt')::timestamptz),
    'hasConflictingSelection', EXISTS (SELECT 1 FROM import_candidates other
      WHERE other.id <> candidate.id AND other.status IN ('selected', 'downloading', 'import_pending')
        AND (other.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
          OR other.normalized_payload #>> '{discoveryScope,metadataReleaseId}' = lwr.metadata_release_id::text
          OR other.normalized_payload #>> '{requestOwnership,metadataReleaseId}' = lwr.metadata_release_id::text)),
    'ordinaryRuns', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'status', ordinary.status,
      'itemStatus', item.item_status,
      'hasItem', item.import_candidate_id IS NOT NULL
    ) ORDER BY ordinary.created_at, ordinary.id)
      FROM operation_runs ordinary
      LEFT JOIN import_execution_run_items item ON item.operation_run_id = ordinary.id AND item.import_candidate_id = candidate.id
      WHERE ordinary.operation_type = 'import_candidate_execution_planning'
        AND ordinary.status IN ('pending', 'running') AND ordinary.cancel_requested_at IS NULL
        AND ordinary.summary->>'executionMode' = 'download_enqueue'
        AND COALESCE(ordinary.summary->>'triggerSource', '') <> 'music_queue_fallback_recovery'
        AND NOT (ordinary.summary ? 'musicQueueRecovery') AND NOT (ordinary.summary ? 'recoveryCascade')
        AND (ordinary.summary->>'selectedCandidateId' = candidate.id::text
          OR (ordinary.summary->>'selectedCandidateId' IS NULL
            AND (ordinary.summary->>'sourceSearchId' IS NULL OR ordinary.summary->>'sourceSearchId' = candidate.source_search_id)
            AND (ordinary.status = 'pending' OR item.import_candidate_id IS NOT NULL)))
    ), '[]'::jsonb),
    'confirmedTransferCount', (SELECT COUNT(*)::integer FROM import_execution_transfer_links links
      JOIN operation_runs receipt ON receipt.id = links.operation_run_id
      LEFT JOIN import_execution_run_items receipt_item ON receipt_item.operation_run_id = receipt.id AND receipt_item.import_candidate_id = candidate.id
      WHERE links.import_candidate_id = candidate.id
        AND receipt.operation_type = 'import_candidate_execution_planning'
        AND CASE WHEN recovery_run.id IS NOT NULL AND NOT (
          COALESCE(recovery_run.value #> '{summary,musicQueueRecovery,retired}' = 'true'::jsonb, FALSE)
          AND EXISTS (SELECT 1 FROM import_candidate_events new_selection
            WHERE new_selection.import_candidate_id = candidate.id AND new_selection.event_type = 'import_candidate_selected'
              AND new_selection.actor_user_id IS NOT NULL AND new_selection.created_at > (recovery_run.value->>'createdAt')::timestamptz))
          THEN links.operation_run_id = recovery_run.id
          ELSE candidate.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
            AND NOT (receipt.summary ? 'musicQueueRecovery') AND NOT (receipt.summary ? 'recoveryCascade')
            AND (candidate.status = 'downloading' OR receipt.created_at >= candidate.updated_at OR receipt_item.created_at >= candidate.updated_at)
          END),
    'participants', ${PARTICIPANTS_JSON_SQL},
    'discovery', jsonb_build_object('searchMode', ldr.search_mode, 'lastSearchAt', ldr.last_search_at, 'evidence', ldr.evidence)
  ) ORDER BY candidate.id), '[]'::jsonb) AS entries
  FROM import_candidates candidate
  LEFT JOIN LATERAL (
    SELECT runs.id, jsonb_build_object('id', runs.id, 'status', runs.status, 'createdAt', runs.created_at,
      'cancelRequested', runs.cancel_requested_at IS NOT NULL, 'summary', runs.summary) AS value
    FROM operation_runs runs
    WHERE runs.operation_type = 'import_candidate_execution_planning'
      AND runs.summary->>'triggerSource' = 'music_queue_fallback_recovery'
      AND (runs.summary->>'selectedCandidateId' = candidate.id::text
        OR runs.summary #>> '{musicQueueRecovery,selectedObservation,candidateId}' = candidate.id::text)
    ORDER BY runs.created_at DESC, runs.id DESC LIMIT 1
  ) recovery_run ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('runId', runs.id, 'candidateId', candidate.id, 'summary', runs.summary,
      'itemStatus', item.item_status, 'handoff', item.planning_snapshot #> '{execution,handoff}',
      'requestedFiles', item.planning_snapshot #> '{execution,requestedFiles}',
      'downloadReviewRequired', item.planning_snapshot #> '{execution,downloadReviewRequired}',
      'physicalObservation', COALESCE(item.planning_snapshot #> '{execution,acceptedCandidateObservation}',
        item.planning_snapshot #> '{execution,handoff,attempt,sourceObservation}', item.planning_snapshot #> '{execution,sourceObservation}'),
      'confirmedTransferCount', (SELECT COUNT(*)::integer FROM import_execution_transfer_links current_links
        WHERE current_links.operation_run_id = runs.id AND current_links.import_candidate_id = candidate.id)) AS value
    FROM operation_runs runs
    LEFT JOIN import_execution_run_items item ON item.operation_run_id = runs.id AND item.import_candidate_id = candidate.id
    WHERE runs.operation_type = 'import_candidate_execution_planning'
      AND (runs.summary->>'selectedCandidateId' = candidate.id::text OR item.import_candidate_id IS NOT NULL)
      AND COALESCE(item.planning_snapshot #>> '{execution,handoff,state}', '') <> 'not_dispatched'
      AND (item.item_status = 'awaiting_confirmation'
        OR item.planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation')
        OR jsonb_typeof(item.planning_snapshot #> '{execution,handoff,attempt}') = 'object'
        OR (item.item_status IN ('queued','queued_with_warnings','downloading','completed')
          AND CASE WHEN jsonb_typeof(item.planning_snapshot #> '{execution,enqueuedTransfers}') = 'array'
            THEN jsonb_array_length(item.planning_snapshot #> '{execution,enqueuedTransfers}') > 0 ELSE FALSE END))
    ORDER BY runs.created_at DESC, runs.id DESC LIMIT 1
  ) current_handoff ON TRUE
  WHERE candidate.status IN ('selected', 'downloading')
    AND (candidate.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
      OR (recovery_run.value #>> '{summary,musicQueueRecovery,metadataReleaseId}' = lwr.metadata_release_id::text
        AND (recovery_run.value #>> '{summary,musicQueueRecovery,authority,wantedReleaseId}' = lwr.id::text
          OR COALESCE(recovery_run.value #> '{summary,musicQueueRecovery,authority,wantedReleaseIds}', '[]'::jsonb) ? lwr.id::text))
      OR recovery_run.value #>> '{summary,sourceWantedReleaseId}' = lwr.id::text
      OR current_handoff.value #>> '{summary,sourceWantedReleaseId}' = lwr.id::text)
) recovery_progress ON TRUE
LEFT JOIN LATERAL (
  SELECT jsonb_build_object(
    'candidate', ${CANDIDATE_JSON_SQL}, 'recoveryRun', recovery_run.value,
    'participants', ${PARTICIPANTS_JSON_SQL},
    'latestReservationId', (SELECT latest.id FROM operation_runs latest
      WHERE latest.operation_type = 'library_discovery_dispatch'
        AND latest.status IN ('pending', 'running')
        AND latest.summary #>> '{musicQueueRecovery,superseded}' IS DISTINCT FROM 'true'
        AND latest.summary->>'triggerSource' = 'music_queue_fallback_rediscovery'
        AND latest.summary #>> '{musicQueueRecovery,metadataReleaseId}' = lwr.metadata_release_id::text
      ORDER BY latest.created_at DESC, latest.id DESC LIMIT 1),
    'hasConflictingSelection', EXISTS (SELECT 1 FROM import_candidates other
      WHERE other.status IN ('selected', 'downloading', 'import_pending')
        AND (other.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
          OR other.normalized_payload #>> '{discoveryScope,metadataReleaseId}' = lwr.metadata_release_id::text
          OR other.normalized_payload #>> '{requestOwnership,metadataReleaseId}' = lwr.metadata_release_id::text)),
    'discovery', jsonb_build_object('searchMode', ldr.search_mode, 'requestStatus', ldr.request_status,
      'nextSearchAfter', ldr.next_search_after, 'lastSearchAt', ldr.last_search_at, 'evidence', ldr.evidence)
  ) AS value
  FROM operation_runs runs
  CROSS JOIN LATERAL (SELECT jsonb_build_object('id', runs.id, 'status', runs.status,
    'cancelRequested', runs.cancel_requested_at IS NOT NULL, 'summary', runs.summary) AS value) recovery_run
  LEFT JOIN import_candidates candidate ON candidate.id::text = runs.summary #>> '{musicQueueRecovery,failedCandidateId}'
  WHERE runs.id::text = ldr.evidence #>> '{downloadRecoveryRediscovery,owningRunId}'
    AND runs.operation_type = 'library_discovery_dispatch'
    AND runs.summary->>'triggerSource' = 'music_queue_fallback_rediscovery'
    AND runs.summary #>> '{musicQueueRecovery,metadataReleaseId}' = lwr.metadata_release_id::text
) discovery_recovery ON TRUE`;
