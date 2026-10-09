/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { getImportCandidateById, listImportCandidateFiles, insertImportCandidateEvent, transitionImportCandidateStatus }
  from './import-candidate-repository.js';

function mapItem(row) {
  return row ? { id: row.id, operationRunId: row.operation_run_id, importCandidateId: row.import_candidate_id,
    itemStatus: row.item_status, planningSnapshot: row.planning_snapshot, statusMessage: row.status_message } : null;
}
export function createImportExecutionHandoffStore({ getPoolFn = getPool } = {}) {
  const db = (queryable) => queryable ?? getPoolFn();
  async function lockEvidence({ importCandidateId, operationRunId }, queryable) {
    await queryable.query('SELECT id FROM import_candidates WHERE id=$1::uuid FOR UPDATE', [importCandidateId]);
    await queryable.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=$1::uuid ORDER BY id FOR UPDATE', [importCandidateId]);
    return getItem({ importCandidateId, operationRunId, lock: true }, queryable);
  }
  async function getItem({ importCandidateId, operationRunId, lock = false }, queryable = null) {
    const result = await db(queryable).query(`SELECT * FROM import_execution_run_items WHERE operation_run_id=$1::uuid
      AND import_candidate_id=$2::uuid${lock ? ' FOR UPDATE' : ''}`, [operationRunId, importCandidateId]);
    return mapItem(result.rows[0]);
  }
  async function getCandidate(importCandidateId, queryable) {
    const candidate = await getImportCandidateById(importCandidateId, db(queryable));
    return candidate ? { ...candidate, files: await listImportCandidateFiles(importCandidateId, db(queryable)) } : null;
  }
  async function isCurrentOrigin({ importCandidateId, operationRunId }, queryable) {
    const result = await db(queryable).query(`SELECT runs.id FROM operation_runs runs WHERE operation_type='import_candidate_execution_planning'
      AND (summary->>'selectedCandidateId'=$1::text OR EXISTS(SELECT 1 FROM import_execution_run_items
        WHERE operation_run_id=runs.id AND import_candidate_id=$1::uuid)) ORDER BY created_at DESC,id DESC LIMIT 1`, [importCandidateId]);
    return result.rows[0]?.id === operationRunId;
  }
  async function findUnresolvedOtherHandoff({ importCandidateId, operationRunId }, queryable) {
    const result = await db(queryable).query(`SELECT id FROM import_execution_run_items WHERE import_candidate_id=$1::uuid
      AND operation_run_id<>$2::uuid AND ((item_status='awaiting_confirmation'
        AND planning_snapshot #>> '{execution,handoff,state}' IS DISTINCT FROM 'not_dispatched')
        OR planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation')) LIMIT 1`, [importCandidateId, operationRunId]);
    return result.rows[0] ?? null;
  }
  async function isDispatchRunActive({ operationRunId }, queryable) {
    const result = await db(queryable).query(`SELECT id FROM operation_runs WHERE id=$1::uuid
      AND operation_type='import_candidate_execution_planning' AND status='running' AND cancel_requested_at IS NULL`, [operationRunId]);
    return result.rowCount > 0;
  }
  async function updateCheckpoint({ item, expectedAttemptId, execution, itemStatus, statusMessage }, queryable) {
    const result = await db(queryable).query(`UPDATE import_execution_run_items SET item_status=$2,status_message=$3,
      planning_snapshot=jsonb_set(planning_snapshot,'{execution}',$4::jsonb),updated_at=NOW()
      WHERE id=$1::uuid AND planning_snapshot #>> '{execution,handoff,attempt,attemptId}' IS NOT DISTINCT FROM $5::text RETURNING *`,
    [item.id, itemStatus, statusMessage, JSON.stringify(execution), expectedAttemptId]);
    return mapItem(result.rows[0]);
  }
  async function transitionDownloading({ candidate, actorUserId, reason }, queryable) {
    const updated = await transitionImportCandidateStatus({ importCandidateId: candidate.id, fromStatuses: ['selected'], toStatus: 'downloading' }, queryable);
    if (!updated) return null;
    await insertImportCandidateEvent({ importCandidateId: candidate.id, actorUserId, eventType: 'import_candidate_downloading',
      previousStatus: 'selected', newStatus: 'downloading', reason }, queryable);
    return getCandidate(candidate.id, queryable);
  }
  async function recordPendingCheck({ item, attemptId, checkedAt }, queryable) {
    await db(queryable).query(`UPDATE import_execution_run_items SET updated_at=NOW(),planning_snapshot=jsonb_set(planning_snapshot,
      '{execution}',COALESCE(planning_snapshot->'execution','{}'::jsonb)||jsonb_build_object('confirmationCheckedAt',$3::text))
      WHERE id=$1::uuid AND ((item_status='awaiting_confirmation'
          AND planning_snapshot #>> '{execution,handoff,state}' IS DISTINCT FROM 'not_dispatched')
        OR planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation'))
        AND planning_snapshot #>> '{execution,handoff,attempt,attemptId}' IS NOT DISTINCT FROM $2::text`, [item.id, attemptId ?? null, checkedAt]);
  }
  return { lockEvidence, getItem, getCandidate, isCurrentOrigin, findUnresolvedOtherHandoff, isDispatchRunActive,
    updateCheckpoint, transitionDownloading, recordPendingCheck };
}
