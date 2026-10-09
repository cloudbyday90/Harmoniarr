/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { normalizeJobLease } from '../job-lease-store.js';
import { createImportExecutionHandoffStore } from './import-execution-handoff-store.js';
import { writableExecutionRunSql } from './import-execution-origin-sql.js';

/** One candidate/run/item/lease owner controls the private local preparation protocol. */
export function createImportExecutionPreProviderStore({ getPoolFn = getPool } = {}) {
  const handoff = createImportExecutionHandoffStore({ getPoolFn });
  async function lockContext({ runId, importCandidateId, queryable }) {
    await queryable.query('SELECT id FROM import_candidates WHERE id=$1::uuid FOR UPDATE', [importCandidateId]);
    await queryable.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=$1::uuid ORDER BY id FOR UPDATE', [importCandidateId]);
    const result = await queryable.query(`SELECT * FROM operation_runs WHERE id=$1::uuid FOR UPDATE`, [runId]);
    const row = result.rows[0];
    const run = row ? { id: row.id, operationType: row.operation_type, status: row.status, summary: row.summary,
      cancelRequestedAt: row.cancel_requested_at, cancelledAt: row.cancelled_at } : null;
    const item = await handoff.getItem({ importCandidateId, operationRunId: runId, lock: true }, queryable);
    const leaseResult = await queryable.query('SELECT * FROM job_leases WHERE lease_key=$1 FOR UPDATE', [`import_candidate_execution_planning:${runId}`]);
    const links = await queryable.query(`SELECT COUNT(*)::integer count FROM import_execution_transfer_links
      WHERE operation_run_id=$1::uuid AND import_candidate_id=$2::uuid`, [runId, importCandidateId]);
    return { run, item, lease: normalizeJobLease(leaseResult.rows[0]), candidate: await handoff.getCandidate(importCandidateId, queryable),
      transferLinkCount: links.rows[0].count };
  }
  async function saveEpoch({ context, epoch, itemStatus, statusMessage, handoffState, outcome, queryable }) {
    const old = context.item.planningSnapshot?.execution ?? {};
    const execution = { ...old, requestedFiles: epoch.requestedFiles,
      handoff: { ...old.handoff, preProviderEpoch: epoch, ...(handoffState ? { state: handoffState } : {}) },
      ...(outcome ? { outcome } : {}) };
    const previous = old.handoff?.preProviderEpoch;
    const result = await queryable.query(`UPDATE import_execution_run_items SET planning_snapshot=jsonb_set(planning_snapshot,'{execution}',$2::jsonb),
      item_status=$3,status_message=$4,updated_at=NOW() WHERE id=$1::uuid
      AND planning_snapshot #> '{execution,handoff,preProviderEpoch}' IS NOT DISTINCT FROM $5::jsonb
      AND planning_snapshot #>> '{execution,handoff,attempt,attemptId}' IS NOT DISTINCT FROM $6::text
      AND NOT(COALESCE(planning_snapshot #> '{execution,handoff}','{}'::jsonb) ? 'adoption')
      AND NOT(COALESCE(planning_snapshot #> '{execution,handoff}','{}'::jsonb) ? 'originResolution')
      AND EXISTS(SELECT 1 FROM operation_runs parent WHERE parent.id=operation_run_id AND ${writableExecutionRunSql('parent')}) RETURNING id`,
    [context.item.id, JSON.stringify(execution), itemStatus ?? context.item.itemStatus, statusMessage ?? context.item.statusMessage,
      previous === undefined ? null : JSON.stringify(previous), old.handoff?.attempt?.attemptId ?? null]);
    return result.rowCount > 0;
  }
  return { lockContext, saveEpoch,
    isCurrentOrigin: (input, queryable) => handoff.isCurrentOrigin(input, queryable),
    findUnresolvedOtherHandoff: (input, queryable) => handoff.findUnresolvedOtherHandoff(input, queryable) };
}
