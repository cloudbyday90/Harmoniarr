/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { RELEASE_SAFE_ADD_ACTIVE_RUN_SQL, RELEASE_SAFE_ADD_CONFLICT_SQL, RELEASE_SAFE_ADD_OWNED_CANDIDATE_SQL, RELEASE_SAFE_ADD_RUN_FACTS_SQL } from './import-candidate-release-safe-add-facts-sql.js';
import { RELEASE_PREPARED_ADD_FACTS_LATERAL_SQL, RELEASE_PREPARED_ADD_FACTS_SELECT_SQL, mapReleasePreparedAddFacts } from './import-candidate-release-prepared-add-facts.js';

// Both the worklist and the guarded command read the same live candidate scope.
export const RELEASE_RECHECK_FACTS_LATERAL_SQL = `LEFT JOIN LATERAL (
  SELECT candidate.id AS candidate_id, candidate.status AS candidate_status,
    stop.add_blocker_code, stop.recovery_reason_code,
    (${RELEASE_SAFE_ADD_CONFLICT_SQL}) AS has_conflicting_candidate,
    ${RELEASE_SAFE_ADD_RUN_FACTS_SQL}
  FROM (
    SELECT items.import_candidate_id, items.updated_at AS observed_at,
      CASE WHEN items.apply_snapshot #>> '{apply,outcome}' = 'quality_blocked' THEN 'media_verification'
        WHEN items.item_status = 'apply_failed' THEN 'add_failed'
        ELSE items.apply_snapshot #>> '{apply,addBlockerCode}' END AS add_blocker_code,
      items.apply_snapshot #>> '{apply,recoveryReasonCode}' AS recovery_reason_code
    FROM import_apply_run_items items
    UNION ALL
    SELECT events.import_candidate_id, events.occurred_at,
      events.details->>'addBlockerCode', events.details->>'recoveryReasonCode'
    FROM import_candidate_events events WHERE events.event_type = 'import_candidate_import_blocked'
  ) stop
  JOIN import_candidates candidate ON candidate.id = stop.import_candidate_id
  ${RELEASE_SAFE_ADD_ACTIVE_RUN_SQL}
  WHERE ${RELEASE_SAFE_ADD_OWNED_CANDIDATE_SQL}
    AND candidate.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
  ORDER BY stop.observed_at DESC, candidate.id ASC LIMIT 1
) release_recheck ON TRUE`;

export const RELEASE_RECHECK_FACTS_SELECT_SQL = `release_recheck.candidate_id AS recheck_candidate_id,
  release_recheck.candidate_status AS recheck_candidate_status, release_recheck.add_blocker_code AS recheck_add_blocker_code,
  release_recheck.recovery_reason_code AS recheck_recovery_reason_code,
  release_recheck.has_conflicting_candidate AS recheck_has_conflicting_candidate,
  release_recheck.active_run_id AS recheck_active_run_id, release_recheck.active_run_status AS recheck_active_run_status,
  release_recheck.active_run_safety_mode AS recheck_active_run_safety_mode,
  release_recheck.run_matches_candidate AS recheck_run_matches_candidate,
  release_recheck.active_run_trigger_source AS recheck_active_run_trigger_source,
  release_recheck.owning_target_marker_valid AS recheck_owning_target_marker_valid`;

export function mapReleaseRecheckFacts(row) {
  return row?.recheck_candidate_id ? { candidateId: row.recheck_candidate_id, candidateStatus: row.recheck_candidate_status,
    addBlockerCode: row.recheck_add_blocker_code ?? null, recoveryReasonCode: row.recheck_recovery_reason_code ?? null,
    hasConflictingCandidate: row.recheck_has_conflicting_candidate !== false, activeRunId: row.recheck_active_run_id ?? null,
    activeRunStatus: row.recheck_active_run_status ?? null, activeRunSafetyMode: row.recheck_active_run_safety_mode ?? null,
    runMatchesCandidate: row.recheck_run_matches_candidate === true,
    activeRunTriggerSource: row.recheck_active_run_trigger_source ?? null, owningTargetMarkerValid: row.recheck_owning_target_marker_valid === true } : null;
}

export function createImportCandidateReleaseRecheckStore({ getPoolFn = getPool } = {}) {
  async function readOwnedRelease({ appUserId, wantedReleaseId, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(`SELECT lwr.id, lwr.app_user_id, lwr.metadata_release_id,
      lwr.wanted_status, lwr.missing_track_count, lwr.evidence, owner.is_disabled,
      wanted_link.wanted_release_id IS NOT NULL AS link_exists, ${RELEASE_RECHECK_FACTS_SELECT_SQL}, ${RELEASE_PREPARED_ADD_FACTS_SELECT_SQL}
      FROM library_wanted_releases lwr JOIN app_users owner ON owner.id = lwr.app_user_id
      LEFT JOIN library_discovery_requests ldr ON ldr.metadata_release_id = lwr.metadata_release_id
      LEFT JOIN library_discovery_request_wanted_release_links wanted_link
        ON wanted_link.wanted_release_id = lwr.id AND wanted_link.discovery_request_id = ldr.id
      ${RELEASE_RECHECK_FACTS_LATERAL_SQL}
      ${RELEASE_PREPARED_ADD_FACTS_LATERAL_SQL}
      WHERE lwr.id = $1::uuid AND lwr.app_user_id = $2::uuid`, [wantedReleaseId, appUserId]);
    const row = result.rows[0];
    return row ? { id: row.id, appUserId: row.app_user_id, metadataReleaseId: row.metadata_release_id,
      wantedStatus: row.wanted_status, missingTrackCount: row.missing_track_count, evidence: row.evidence,
      discoveryLinkExists: row.link_exists === true, libraryAddRecoveryFacts: mapReleaseRecheckFacts(row), libraryAddFacts: mapReleasePreparedAddFacts(row),
      targetUser: { id: row.app_user_id, isDisabled: row.is_disabled } } : null;
  }
  async function readParticipantPolicies({ wantedReleaseIds, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(`SELECT wanted.id AS wanted_release_id, wanted.app_user_id,
      wanted.metadata_release_id, wanted.evidence->>'qualityProfile' AS quality_profile,
      wanted.wanted_status, wanted.missing_track_count, wanted.evidence->>'visibilityState' AS visibility_state,
      owner.user_preferences AS quality_preferences, owner.is_disabled,
      links.wanted_release_id IS NOT NULL AS discovery_link_exists,
      links.evidence->'musicQueueQualityOverride' AS quality_override
      FROM library_wanted_releases wanted JOIN app_users owner ON owner.id = wanted.app_user_id
      LEFT JOIN library_discovery_request_wanted_release_links links ON links.wanted_release_id = wanted.id
        AND links.discovery_request_id = (SELECT id FROM library_discovery_requests WHERE metadata_release_id = wanted.metadata_release_id)
      WHERE wanted.id = ANY($1::uuid[]) OR links.discovery_request_id IN (
        SELECT discovery.id FROM library_wanted_releases original
        JOIN library_discovery_requests discovery ON discovery.metadata_release_id = original.metadata_release_id
        WHERE original.id = ANY($1::uuid[])) ORDER BY wanted.id`, [wantedReleaseIds]);
    return result.rows.map((row) => ({ wantedReleaseId: row.wanted_release_id, appUserId: row.app_user_id,
      metadataReleaseId: row.metadata_release_id, qualityProfile: row.quality_profile ?? null,
      qualityPreferences: row.quality_preferences, qualityOverride: row.quality_override ?? null, isDisabled: row.is_disabled,
      wantedStatus: row.wanted_status, missingTrackCount: row.missing_track_count, visibilityState: row.visibility_state ?? null,
      discoveryLinkExists: row.discovery_link_exists === true }));
  }
  async function lockParticipantReleases({ wantedReleaseIds, queryable }) {
    await queryable.query('SELECT id FROM library_wanted_releases WHERE id = ANY($1::uuid[]) ORDER BY id FOR NO KEY UPDATE', [wantedReleaseIds]);
    await queryable.query(`SELECT discovery.id FROM library_discovery_requests discovery
      JOIN library_discovery_request_wanted_release_links links ON links.discovery_request_id = discovery.id
      WHERE links.wanted_release_id = ANY($1::uuid[]) ORDER BY discovery.id, links.wanted_release_id FOR UPDATE OF discovery, links`, [wantedReleaseIds]);
  }
  async function lockCandidate({ importCandidateId, queryable }) {
    await queryable.query('SELECT id FROM import_candidates WHERE id = $1::uuid FOR UPDATE', [importCandidateId]);
    await queryable.query('SELECT id FROM import_candidate_files WHERE import_candidate_id = $1::uuid ORDER BY id FOR UPDATE', [importCandidateId]);
    await queryable.query('SELECT id FROM import_candidate_file_decisions WHERE import_candidate_id = $1::uuid ORDER BY id FOR UPDATE', [importCandidateId]);
  }
  async function saveQualityContext({ importCandidateId, musicQueueContext, candidateStatus = 'failed', queryable }) {
    await queryable.query(`UPDATE import_candidates SET normalized_payload = jsonb_set(normalized_payload,
      '{musicQueue}', $2::jsonb), updated_at = NOW() WHERE id = $1::uuid AND status = $3`, [importCandidateId, JSON.stringify(musicQueueContext), candidateStatus]);
  }
  async function readAutomaticLibraryAddAuthority({ runId, importCandidateId }) {
    if (!runId) return null;
    const result = await getPoolFn().query(`SELECT summary->'automaticLibraryAddAuthority' AS authority FROM operation_runs
      WHERE id=$1::uuid AND operation_type='import_candidate_apply' AND status IN ('pending','running')
        AND summary->>'triggerSource'='music_queue_download_completed' AND summary->>'applySafetyMode'='safe_auto'
        AND jsonb_typeof(summary->'importCandidateIds')='array' AND summary->'importCandidateIds' ? $2::text`, [runId, importCandidateId]);
    return result.rows[0]?.authority ?? null;
  }
  return { readOwnedRelease, readParticipantPolicies, lockParticipantReleases, lockCandidate, saveQualityContext, readAutomaticLibraryAddAuthority };
}
