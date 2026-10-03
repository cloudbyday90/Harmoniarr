/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { RELEASE_SAFE_ADD_ACTIVE_RUN_SQL, RELEASE_SAFE_ADD_CONFLICT_SQL, RELEASE_SAFE_ADD_OWNED_CANDIDATE_SQL,
  RELEASE_SAFE_ADD_RUN_FACTS_SQL } from './import-candidate-release-safe-add-facts-sql.js';

export const RELEASE_PREPARED_ADD_FACTS_LATERAL_SQL = `LEFT JOIN LATERAL (
  SELECT candidate.id AS candidate_id, candidate.status AS candidate_status,
    (SELECT COUNT(*)::integer FROM import_candidate_files files WHERE files.import_candidate_id = candidate.id) AS file_count,
    (${RELEASE_SAFE_ADD_CONFLICT_SQL}) AS has_conflicting_candidate, ${RELEASE_SAFE_ADD_RUN_FACTS_SQL}
  FROM import_candidates candidate ${RELEASE_SAFE_ADD_ACTIVE_RUN_SQL}
  WHERE candidate.status = 'import_pending' AND ${RELEASE_SAFE_ADD_OWNED_CANDIDATE_SQL}
    AND candidate.source_search_id = NULLIF(ldr.evidence->>'lastSearchId', '')
  ORDER BY candidate.updated_at DESC, candidate.id ASC LIMIT 1
) release_prepared_add ON TRUE`;

export const RELEASE_PREPARED_ADD_FACTS_SELECT_SQL = `release_prepared_add.candidate_id AS prepared_add_candidate_id,
  release_prepared_add.candidate_status AS prepared_add_candidate_status, release_prepared_add.file_count AS prepared_add_file_count,
  release_prepared_add.has_conflicting_candidate AS prepared_add_has_conflicting_candidate,
  release_prepared_add.active_run_id AS prepared_add_active_run_id, release_prepared_add.active_run_status AS prepared_add_active_run_status,
  release_prepared_add.active_run_safety_mode AS prepared_add_active_run_safety_mode,
  release_prepared_add.active_run_trigger_source AS prepared_add_active_run_trigger_source,
  release_prepared_add.run_matches_candidate AS prepared_add_run_matches_candidate,
  release_prepared_add.owning_target_marker_valid AS prepared_add_owning_target_marker_valid`;

export function mapReleasePreparedAddFacts(row) {
  return row?.prepared_add_candidate_id ? { candidateId: row.prepared_add_candidate_id, candidateStatus: row.prepared_add_candidate_status,
    fileCount: row.prepared_add_file_count ?? 0, hasConflictingCandidate: row.prepared_add_has_conflicting_candidate !== false,
    activeRunId: row.prepared_add_active_run_id ?? null, activeRunStatus: row.prepared_add_active_run_status ?? null,
    activeRunSafetyMode: row.prepared_add_active_run_safety_mode ?? null, activeRunTriggerSource: row.prepared_add_active_run_trigger_source ?? null,
    runMatchesCandidate: row.prepared_add_run_matches_candidate === true, owningTargetMarkerValid: row.prepared_add_owning_target_marker_valid === true } : null;
}
