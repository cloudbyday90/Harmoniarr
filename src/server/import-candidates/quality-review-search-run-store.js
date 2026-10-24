/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { createOperationRunStore } from '../operation-run-store.js';
import { createOperationRunOwnedLifecycleStore } from '../operation-run-owned-lifecycle-store.js';
import { QUALITY_REVIEW_SEARCH_OPERATION } from './quality-review-search-policy.js';

export function createQualityReviewSearchRunStore({ getPoolFn = getPool } = {}) {
  const runs = createOperationRunStore({ getPoolFn, operationType: QUALITY_REVIEW_SEARCH_OPERATION });
  const owned = createOperationRunOwnedLifecycleStore({ getPoolFn, operationType: QUALITY_REVIEW_SEARCH_OPERATION });
  async function findActive({ wantedReleaseId, queryable = null }) {
    return (await (queryable ?? getPoolFn()).query(`SELECT id,summary FROM operation_runs
      WHERE operation_type='quality_review_search' AND status IN ('pending','running') AND summary->>'wantedReleaseId'=$1
      ORDER BY created_at LIMIT 1`, [wantedReleaseId])).rows[0] ?? null;
  }
  async function canAdmit({ actorUserId, queryable }) {
    const row = (await queryable.query(`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE triggered_by_user_id=$1::uuid)::int AS actor_count FROM operation_runs
      WHERE operation_type='quality_review_search' AND status IN ('pending','running')`, [actorUserId])).rows[0];
    return row.total < 16 && row.actor_count < 2;
  }
  async function now({ queryable }) {
    const value = (await queryable.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at;
    return value instanceof Date ? value.getTime() : Date.parse(value);
  }
  const markRunStopped = input => owned.withOwnedRun(input, ({ queryable, expectedLease }) => owned.writeLifecycle({
    ...input, expectedLease, queryable, action: 'failed' }));
  return { ...runs, ...owned, findActive, canAdmit, now, markRunStopped };
}
