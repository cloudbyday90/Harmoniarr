/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const uuid = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

/** Aliases/expressions are internal SQL constants, never request data. */
export function validExecutionOriginSupersessionSql({ runAlias = 'origin', importCandidateIdSql = null } = {}) {
  const record = `${runAlias}.summary->'downloadOriginSupersession'`;
  return `COALESCE((
    ${runAlias}.operation_type='import_candidate_execution_planning' AND ${runAlias}.status='cancelled'
    AND jsonb_typeof(${record})='object' AND ${record}->'version'='1'::jsonb
    AND ${record}->>'newerRunId'=${runAlias}.id::text
    AND ${record}->>'importCandidateId'=${runAlias}.summary->>'selectedCandidateId'
    AND ${runAlias}.summary->'requestedCandidateCount'='1'::jsonb
    ${importCandidateIdSql ? `AND ${record}->>'importCandidateId'=(${importCandidateIdSql})::text` : ''}
    AND ${['resolutionId', 'importCandidateId', 'sourceRunId', 'newerRunId', 'sourceAttemptId', 'actorUserId']
      .map((field) => `${record}->>'${field}' ~ '${uuid}'`).join(' AND ')}
    AND ${record}->>'sourceRunId'<>${record}->>'newerRunId'
    AND ${record}->>'requestHash' ~ '^[a-f0-9]{64}$'
    AND jsonb_typeof(${record}->'publicOutcome')='object'
    AND ${record}->>'resolvedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{3}Z$'
    AND pg_input_is_valid(${record}->>'resolvedAt','timestamp with time zone')
    AND EXISTS(SELECT 1 FROM import_execution_run_items restored_item JOIN operation_runs restored_run
      ON restored_run.id=restored_item.operation_run_id
      WHERE restored_run.operation_type='import_candidate_execution_planning'
        AND restored_run.id::text=${record}->>'sourceRunId'
        AND restored_item.import_candidate_id::text=${record}->>'importCandidateId'
        AND restored_item.planning_snapshot #>> '{execution,handoff,attempt,attemptId}'=${record}->>'sourceAttemptId'
        AND restored_item.planning_snapshot #>> '{execution,handoff,attempt,version}'='2'
        AND restored_item.planning_snapshot #>> '{execution,handoff,attempt,providerBinding,protocol}'='batch'
        AND restored_item.planning_snapshot #> '{execution,handoff,originResolution}'=${record}
    )
  ),FALSE)`;
}

export function effectiveExecutionOriginSql({ importCandidateIdSql }) {
  return `(SELECT effective_origin.id FROM operation_runs effective_origin
    WHERE effective_origin.operation_type='import_candidate_execution_planning'
      AND (effective_origin.summary->>'selectedCandidateId'=(${importCandidateIdSql})::text OR EXISTS(
        SELECT 1 FROM import_execution_run_items effective_item WHERE effective_item.operation_run_id=effective_origin.id
          AND effective_item.import_candidate_id=(${importCandidateIdSql})::uuid))
      AND NOT (${validExecutionOriginSupersessionSql({ runAlias: 'effective_origin', importCandidateIdSql })})
    ORDER BY effective_origin.created_at DESC,effective_origin.id DESC LIMIT 1)`;
}

/** Even an invalid retirement marker cannot be erased or reactivated by ordinary writers. */
export const writableExecutionRunSql = (runAlias) => `NOT (COALESCE(${runAlias}.summary,'{}'::jsonb) ? 'downloadOriginSupersession')`;

export const resolvedExecutionRunSql = (runAlias) => `EXISTS(SELECT 1 FROM operation_runs retired_origin
  WHERE retired_origin.summary #>> '{downloadOriginSupersession,sourceRunId}'=${runAlias}.id::text
    AND ${validExecutionOriginSupersessionSql({ runAlias: 'retired_origin' })})`;
