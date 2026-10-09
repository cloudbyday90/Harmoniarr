/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { isUnconfirmedExecutionItem } from './import-candidate-execution-handoff-state.js';
import { effectiveExecutionOriginSql, validExecutionOriginSupersessionSql } from './import-execution-origin-sql.js';

export const MAX_UNCONFIRMED_EXECUTION_RUNS = 20;

/** Older unresolved checkpoints remain observable independently of the latest job. */
export function createImportCandidateExecutionConfirmationWorklistStore({ getPoolFn = getPool } = {}) {
  async function listUnconfirmedExecutionRuns({ excludeRunId = null, limit = MAX_UNCONFIRMED_EXECUTION_RUNS } = {}) {
    const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_UNCONFIRMED_EXECUTION_RUNS) : MAX_UNCONFIRMED_EXECUTION_RUNS;
    // Filter with the owning typed policy before limiting: a malformed epoch must
    // never hide an older unresolved request behind a database page boundary.
    const result = await getPoolFn().query(`SELECT items.operation_run_id,items.import_candidate_id,
      items.item_status,items.planning_snapshot,items.updated_at,runs.summary
      FROM import_execution_run_items items
      JOIN import_candidates candidates ON candidates.id=items.import_candidate_id
      JOIN operation_runs runs ON runs.id=items.operation_run_id
      WHERE candidates.status = 'selected'
        AND ((items.item_status='awaiting_confirmation'
          AND items.planning_snapshot #>> '{execution,handoff,state}' IS DISTINCT FROM 'not_dispatched')
          OR items.planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation')
          OR COALESCE(items.planning_snapshot #> '{execution,handoff}','{}'::jsonb) ? 'preProviderEpoch')
        AND runs.operation_type='import_candidate_execution_planning'
        AND ($1::text IS NULL OR items.operation_run_id::text<>$1::text)
      ORDER BY items.updated_at,items.operation_run_id,items.id`, [typeof excludeRunId === 'string' ? excludeRunId : null]);
    const waiting = result.rows.filter((row) => isUnconfirmedExecutionItem({ operationRunId: row.operation_run_id,
      importCandidateId: row.import_candidate_id, itemStatus: row.item_status, planningSnapshot: row.planning_snapshot },
    { id: row.operation_run_id, summary: row.summary }));
    return { runIds: [...new Set(waiting.map((row) => row.operation_run_id))].slice(0, boundedLimit),
      pendingConfirmationCount: waiting.length };
  }
  async function listRestoredExecutionRuns({ excludeRunId = null, limit = MAX_UNCONFIRMED_EXECUTION_RUNS } = {}) {
    const bounded = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_UNCONFIRMED_EXECUTION_RUNS) : MAX_UNCONFIRMED_EXECUTION_RUNS;
    const result = await getPoolFn().query(`SELECT source_item.operation_run_id,MIN(source_item.updated_at) AS last_checked_at,
      jsonb_agg(source_item.import_candidate_id ORDER BY source_item.import_candidate_id) AS candidate_ids
      FROM import_execution_run_items source_item JOIN import_candidates candidate ON candidate.id=source_item.import_candidate_id
      JOIN operation_runs retired ON retired.summary #>> '{downloadOriginSupersession,sourceRunId}'=source_item.operation_run_id::text
        AND retired.summary #>> '{downloadOriginSupersession,importCandidateId}'=source_item.import_candidate_id::text
      WHERE candidate.status IN ('selected','downloading')
        AND ${validExecutionOriginSupersessionSql({ runAlias: 'retired', importCandidateIdSql: 'candidate.id' })}
        AND source_item.operation_run_id=${effectiveExecutionOriginSql({ importCandidateIdSql: 'candidate.id' })}
        AND ($1::text IS NULL OR source_item.operation_run_id::text<>$1::text)
      GROUP BY source_item.operation_run_id ORDER BY last_checked_at,source_item.operation_run_id LIMIT $2`, [excludeRunId, bounded]);
    return { runIds: result.rows.map((row) => row.operation_run_id),
      candidateIdsByRun: Object.fromEntries(result.rows.map((row) => [row.operation_run_id, row.candidate_ids])) };
  }
  return { listUnconfirmedExecutionRuns, listRestoredExecutionRuns };
}
