/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { createApiError } from '../auth.js';
import { normalizeJobLease } from '../job-lease-store.js';
import { createImportExecutionHandoffStore } from './import-execution-handoff-store.js';
import { evaluateUnusedExecutionAllocation, hasReciprocalExecutionOriginResolution, isValidExecutionOriginResolution }
  from './import-execution-origin-policy.js';
import { effectiveExecutionOriginSql } from './import-execution-origin-sql.js';

const iso = (value) => value?.toISOString?.() ?? value ?? null;
function mapRun(row) {
  return row ? { id: row.id, operationType: row.operation_type, status: row.status, summary: row.summary,
    createdAt: iso(row.created_at), startedAt: iso(row.started_at), finishedAt: iso(row.finished_at),
    attemptCount: row.attempt_count, claimedAt: iso(row.claimed_at), claimedByInstanceId: row.claimed_by_instance_id,
    cancelRequestedAt: iso(row.cancel_requested_at), cancelledAt: iso(row.cancelled_at) } : null;
}
const mapItem = (row) => ({ id: row.id, operationRunId: row.operation_run_id, importCandidateId: row.import_candidate_id,
  itemStatus: row.item_status, planningSnapshot: row.planning_snapshot, statusMessage: row.status_message });

export function createImportExecutionOriginStore({ getPoolFn = getPool } = {}) {
  const db = (queryable) => queryable ?? getPoolFn();
  const handoff = createImportExecutionHandoffStore({ getPoolFn });
  async function getCurrentOrigin({ importCandidateId, queryable = null }) {
    const result = await db(queryable).query(`SELECT ${effectiveExecutionOriginSql({ importCandidateIdSql: '$1' })} AS id`, [importCandidateId]);
    return result.rows[0]?.id ?? null;
  }
  async function getReviewContext({ importCandidateId, operationRunId, sourceRunId = operationRunId, queryable = null }) {
    const sourceResult = await db(queryable).query('SELECT * FROM operation_runs WHERE id=$1::uuid', [sourceRunId]);
    const sourceRun = mapRun(sourceResult.rows[0]);
    const candidate = await handoff.getCandidate(importCandidateId, queryable);
    const sourceItem = await handoff.getItem({ importCandidateId, operationRunId: sourceRunId }, queryable);
    const newerResult = await db(queryable).query(`SELECT runs.*,COUNT(*) OVER() AS newer_count FROM operation_runs runs
      JOIN operation_runs source ON source.id=$2::uuid
      WHERE runs.operation_type='import_candidate_execution_planning'
        AND (runs.summary->>'selectedCandidateId'=$1::text OR EXISTS(SELECT 1 FROM import_execution_run_items item
          WHERE item.operation_run_id=runs.id AND item.import_candidate_id=$1::uuid))
        AND (runs.created_at,runs.id)>(source.created_at,source.id)
      ORDER BY runs.created_at DESC,runs.id DESC LIMIT 2`, [importCandidateId, sourceRunId]);
    const raw = sourceItem?.planningSnapshot?.execution?.handoff?.originResolution;
    const recordedNewer = isValidExecutionOriginResolution(raw)
      ? (await db(queryable).query('SELECT * FROM operation_runs WHERE id=$1::uuid', [raw.newerRunId])).rows[0] : null;
    const newerRun = mapRun(recordedNewer ?? newerResult.rows[0]);
    const newerItems = newerRun ? (await db(queryable).query('SELECT * FROM import_execution_run_items WHERE operation_run_id=$1::uuid ORDER BY position,id', [newerRun.id])).rows.map(mapItem) : [];
    const keys = [sourceRunId, newerRun?.id].filter(Boolean).map((id) => `import_candidate_execution_planning:${id}`);
    const leases = (await db(queryable).query('SELECT * FROM job_leases WHERE lease_key=ANY($1::text[]) ORDER BY lease_key', [keys])).rows.map((row) => normalizeJobLease(row));
    const newerTransferLinkCount = newerRun ? (await db(queryable).query('SELECT COUNT(*)::integer count FROM import_execution_transfer_links WHERE operation_run_id=$1::uuid', [newerRun.id])).rows[0].count : 0;
    const savedResolution = hasReciprocalExecutionOriginResolution({ record: raw, sourceItem, newerRun, importCandidateId }) ? raw : null;
    return { candidate, sourceRun, sourceItem, newerRun, newerItems,
      newerLeases: leases.filter((lease) => lease.leaseKey.endsWith(`:${newerRun?.id}`)),
      sourceLeases: leases.filter((lease) => lease.leaseKey.endsWith(`:${sourceRunId}`)),
      newerCount: Number(newerResult.rows[0]?.newer_count ?? 0), newerTransferLinkCount,
      currentOriginId: await getCurrentOrigin({ importCandidateId, queryable }), savedResolution };
  }
  async function lockContext({ importCandidateId, operationRunId, sourceRunId = operationRunId, newerRunId, queryable }) {
    await queryable.query('SELECT id FROM import_candidates WHERE id=$1::uuid FOR UPDATE', [importCandidateId]);
    await queryable.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=$1::uuid ORDER BY id FOR UPDATE', [importCandidateId]);
    const runIds = [...new Set([sourceRunId, newerRunId].filter(Boolean))].sort();
    await queryable.query('SELECT id FROM operation_runs WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [runIds]);
    await queryable.query('SELECT id FROM import_execution_run_items WHERE operation_run_id=ANY($1::uuid[]) ORDER BY operation_run_id,id FOR UPDATE', [runIds]);
    await queryable.query('SELECT id FROM job_leases WHERE lease_key=ANY($1::text[]) ORDER BY lease_key FOR UPDATE', [runIds.map((id) => `import_candidate_execution_planning:${id}`)]);
    return getReviewContext({ importCandidateId, sourceRunId, queryable });
  }
  async function retireUnusedAllocation({ context, resolutionId, requestHash, actorUserId, publicOutcome, resolvedAt = new Date().toISOString(), queryable }) {
    const fresh = await getReviewContext({ importCandidateId: context.candidate.id, sourceRunId: context.sourceRun.id, queryable });
    const proof = evaluateUnusedExecutionAllocation({ run: fresh.newerRun, items: fresh.newerItems, leases: fresh.newerLeases,
      transferLinkCount: fresh.newerTransferLinkCount, importCandidateId: fresh.candidate?.id });
    if (!proof.eligible || fresh.newerCount !== 1 || fresh.newerRun?.id !== context.newerRun?.id
      || fresh.currentOriginId !== fresh.newerRun.id) throw createApiError(409, 'import_execution_origin_resolution_stale', 'The download origin changed');
    const record = { version: 1, resolutionId, importCandidateId: fresh.candidate.id, sourceRunId: fresh.sourceRun.id,
      newerRunId: fresh.newerRun.id, sourceAttemptId: fresh.sourceItem?.planningSnapshot?.execution?.handoff?.attempt?.attemptId,
      requestHash, actorUserId, resolvedAt, publicOutcome };
    if (!isValidExecutionOriginResolution(record)) throw new TypeError('Download origin resolution requires a typed reciprocal record');
    await queryable.query(`UPDATE operation_runs SET status='cancelled',cancel_requested_at=COALESCE(cancel_requested_at,NOW()),
      cancel_requested_by_user_id=COALESCE(cancel_requested_by_user_id,$3::uuid),cancelled_at=NOW(),finished_at=NOW(),claimed_at=NULL,claimed_by_instance_id=NULL,
      summary=COALESCE(summary,'{}'::jsonb)||jsonb_build_object('downloadOriginSupersession',$2::jsonb,'currentStep','Unused request retired after origin resolution')
      WHERE id=$1::uuid AND NOT(summary ? 'downloadOriginSupersession')`, [record.newerRunId, JSON.stringify(record), actorUserId]);
    const saved = await queryable.query(`UPDATE import_execution_run_items SET planning_snapshot=jsonb_set(planning_snapshot,
      '{execution,handoff,originResolution}',$2::jsonb),updated_at=NOW()
      WHERE id=$1::uuid AND planning_snapshot #>> '{execution,handoff,attempt,attemptId}'=$3::text
        AND NOT(COALESCE(planning_snapshot #> '{execution,handoff}','{}'::jsonb) ? 'originResolution') RETURNING id`,
    [fresh.sourceItem.id, JSON.stringify(record), record.sourceAttemptId]);
    if (!saved.rowCount) throw createApiError(409, 'import_execution_origin_resolution_stale', 'The download origin changed');
    return record;
  }
  return { getCurrentOrigin, getReviewContext, lockContext, retireUnusedAllocation };
}
