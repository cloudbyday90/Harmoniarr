/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { effectiveExecutionOriginSql, validExecutionOriginSupersessionSql } from './import-execution-origin-sql.js';

export const MAX_UNCONFIRMED_EXECUTION_RUNS = 20;

/** Older unresolved checkpoints remain observable independently of the latest job. */
export function createImportCandidateExecutionConfirmationWorklistStore({ getPoolFn = getPool } = {}) {
  async function listUnconfirmedExecutionRuns({ excludeRunId = null, limit = MAX_UNCONFIRMED_EXECUTION_RUNS } = {}) {
    const boundedLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_UNCONFIRMED_EXECUTION_RUNS) : MAX_UNCONFIRMED_EXECUTION_RUNS;
    const result = await getPoolFn().query(`WITH waiting AS (
      SELECT items.operation_run_id, items.updated_at
      FROM import_execution_run_items items
      JOIN import_candidates candidates ON candidates.id = items.import_candidate_id
      JOIN operation_runs runs ON runs.id = items.operation_run_id
      WHERE candidates.status = 'selected'
        AND COALESCE(items.planning_snapshot #>> '{execution,handoff,state}', '') <> 'not_dispatched'
        AND (items.item_status = 'awaiting_confirmation'
        OR items.planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation'))
        AND runs.operation_type = 'import_candidate_execution_planning'
        AND ($1::text IS NULL OR items.operation_run_id::text <> $1::text)
    ), waiting_runs AS (
      SELECT operation_run_id, MIN(updated_at) AS last_checked_at FROM waiting GROUP BY operation_run_id
    ) SELECT (SELECT COUNT(*)::integer FROM waiting) AS pending_confirmation_count,
      COALESCE((SELECT jsonb_agg(operation_run_id ORDER BY last_checked_at, operation_run_id)
        FROM (SELECT operation_run_id,last_checked_at FROM waiting_runs
          ORDER BY last_checked_at,operation_run_id LIMIT $2) bounded), '[]'::jsonb) AS run_ids`,
    [typeof excludeRunId === 'string' ? excludeRunId : null, boundedLimit]);
    const row = result.rows[0] ?? {};
    return { runIds: Array.isArray(row.run_ids) ? row.run_ids : [], pendingConfirmationCount: row.pending_confirmation_count ?? 0 };
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
