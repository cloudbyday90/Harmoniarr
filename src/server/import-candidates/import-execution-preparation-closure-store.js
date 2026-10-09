/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { normalizeJobLease } from '../job-lease-store.js';
import { createImportExecutionPreProviderStore } from './import-execution-pre-provider-store.js';

/** The closure lease, reciprocal parent fence and item refusal share one transaction. */
export function createImportExecutionPreparationClosureStore({ getPoolFn = getPool } = {}) {
  const preparation = createImportExecutionPreProviderStore({ getPoolFn });
  async function lockContext(input) {
    const context = await preparation.lockContext(input);
    const result = await input.queryable.query(`SELECT clock_timestamp() AS observed_at,
      (SELECT COUNT(*)::integer FROM import_execution_run_items WHERE operation_run_id=$1::uuid) AS item_count,
      (SELECT COUNT(*)::integer FROM import_execution_transfer_links WHERE operation_run_id=$1::uuid) AS link_count`, [input.runId]);
    return { ...context, observedAt: result.rows[0].observed_at.toISOString(),
      runItemCount: result.rows[0].item_count, runTransferLinkCount: result.rows[0].link_count };
  }
  async function acquireClosureLease({ runId, ownerInstanceId, queryable }) {
    const result = await queryable.query(`INSERT INTO job_leases(job_type,lease_key,owner_instance_id,acquisition_id,acquired_at,heartbeat_at,expires_at,status)
      VALUES('import_candidate_execution_planning',$1,$2,gen_random_uuid(),date_trunc('milliseconds',clock_timestamp()),clock_timestamp(),clock_timestamp()+INTERVAL '1 minute','active')
      ON CONFLICT(lease_key) DO UPDATE SET owner_instance_id=EXCLUDED.owner_instance_id,acquired_at=EXCLUDED.acquired_at,
        acquisition_id=EXCLUDED.acquisition_id,
        heartbeat_at=EXCLUDED.heartbeat_at,expires_at=EXCLUDED.expires_at,released_at=NULL,status='active'
      WHERE job_leases.released_at IS NOT NULL OR job_leases.expires_at<=clock_timestamp() RETURNING *`,
    [`import_candidate_execution_planning:${runId}`, ownerInstanceId]);
    return normalizeJobLease(result.rows[0]);
  }
  async function readClock(queryable) {
    return (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at.toISOString();
  }
  async function saveClosureFence({ context, closure, queryable }) {
    const result = await queryable.query(`UPDATE operation_runs SET status='cancelled',finished_at=$3::timestamptz,
      cancel_requested_at=COALESCE(cancel_requested_at,$3::timestamptz),cancelled_at=COALESCE(cancelled_at,$3::timestamptz),
      claimed_at=NULL,claimed_by_instance_id=NULL,
      summary=summary||jsonb_build_object('downloadPreparationClosure',$2::jsonb,'currentStep','Download preparation stopped before dispatch')
      WHERE id=$1::uuid AND status IN ('pending','failed','completed','cancelled') AND claimed_at IS NULL AND claimed_by_instance_id IS NULL
        AND summary IS NOT DISTINCT FROM $4::jsonb AND NOT(summary ? 'downloadPreparationClosure')
        AND NOT(summary ? 'downloadOriginSupersession') RETURNING id`,
    [context.run.id, JSON.stringify(closure), closure.closedAt, JSON.stringify(context.run.summary)]);
    return result.rowCount === 1;
  }
  async function releaseClosureLease({ runId, lease, queryable }) {
    const result = await queryable.query(`UPDATE job_leases SET released_at=clock_timestamp(),heartbeat_at=clock_timestamp(),status='cancelled'
      WHERE lease_key=$1 AND owner_instance_id=$2 AND acquired_at=$3::timestamptz AND released_at IS NULL
        AND acquisition_id=$4::uuid
        AND expires_at>clock_timestamp() RETURNING id`,
    [`import_candidate_execution_planning:${runId}`, lease.ownerInstanceId, lease.acquiredAt, lease.acquisitionId]);
    return result.rowCount === 1;
  }
  return { lockContext, acquireClosureLease, readClock, saveEpoch: preparation.saveEpoch, saveClosureFence, releaseClosureLease };
}
