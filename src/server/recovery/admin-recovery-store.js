/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from '../database.js';

function normalizeRecoveryRun(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
    recoveryCodeHash: row.recovery_code_hash,
    armedVia: row.armed_via,
    armedAt: row.armed_at?.toISOString?.() ?? row.armed_at ?? null,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at ?? null,
    invalidAttemptCount: row.invalid_attempt_count ?? 0,
    maxAttempts: row.max_attempts ?? 5,
    completedAt: row.completed_at?.toISOString?.() ?? row.completed_at ?? null,
    cancelledAt: row.cancelled_at?.toISOString?.() ?? row.cancelled_at ?? null,
    createdAdminUserId: row.created_admin_user_id ?? null,
    completedFromIp: row.completed_from_ip ?? null,
    completedUserAgent: row.completed_user_agent ?? null,
    reason: row.reason ?? null,
    details: row.details_json ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
  };
}

export function createAdminRecoveryStore({
  getPoolFn = getPool,
} = {}) {
  async function getActiveArmedRun({ queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        SELECT id, status, recovery_code_hash, armed_via, armed_at, expires_at,
               invalid_attempt_count, max_attempts, completed_at, cancelled_at,
               created_admin_user_id, completed_from_ip, completed_user_agent,
               reason, details_json, created_at
        FROM admin_recovery_runs
        WHERE status = 'armed'
        ORDER BY armed_at DESC
        LIMIT 1
      `,
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function getRecoveryRunById({ runId, queryable = null, lockForTransaction = false } = {}) {
    if (typeof runId !== 'string' || runId.trim().length < 1) {
      return null;
    }

    if (lockForTransaction) {
      if (!queryable) throw new Error('A transaction client is required to lock a recovery run');
      await queryable.query('SELECT id FROM admin_recovery_runs WHERE id = $1 FOR UPDATE', [runId]);
    }
    // Separate statement: observe wall time after any row-lock wait.
    const result = await (queryable ?? getPoolFn()).query(
      `
        SELECT id, status, recovery_code_hash, armed_via, armed_at, expires_at,
               invalid_attempt_count, max_attempts, completed_at, cancelled_at,
               created_admin_user_id, completed_from_ip, completed_user_agent,
               reason, details_json, created_at, expires_at <= clock_timestamp() AS is_expired
        FROM admin_recovery_runs
        WHERE id = $1
        LIMIT 1
      `,
      [runId],
    );

    const row = result.rows[0];
    return row ? { ...normalizeRecoveryRun(row), isExpired: row.is_expired === true } : null;
  }

  async function insertRecoveryRun({
    recoveryCodeHash,
    armedVia = 'harmoniarrctl',
    expiresAt,
    ttlMinutes = null,
    maxAttempts = 5,
    reason = null,
    queryable = null,
  } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        INSERT INTO admin_recovery_runs (
          status, recovery_code_hash, armed_via, armed_at, expires_at,
          max_attempts, reason
        )
        VALUES ('armed', $1, $2, clock_timestamp(),
          CASE WHEN $6::integer IS NULL THEN $3::timestamptz
            ELSE clock_timestamp() + $6::integer * INTERVAL '1 minute' END, $4, $5)
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
      [recoveryCodeHash, armedVia, expiresAt ?? null, maxAttempts, reason, ttlMinutes],
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function incrementInvalidAttemptCount({ runId, queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE admin_recovery_runs
        SET invalid_attempt_count = invalid_attempt_count + 1
        WHERE id = $1 AND status = 'armed'
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
      [runId],
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function invalidateRecoveryRun({ runId, reason = null, queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE admin_recovery_runs
        SET status = 'invalidated',
            details_json = COALESCE(details_json, '{}'::jsonb) || jsonb_build_object('invalidatedAt', NOW()::text, 'invalidationReason', $2::text)
        WHERE id = $1 AND status = 'armed'
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
      [runId, reason],
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function completeRecoveryRun({
    runId,
    createdAdminUserId,
    completedFromIp = null,
    completedUserAgent = null,
    queryable = null,
  } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE admin_recovery_runs
        SET status = 'completed',
            completed_at = clock_timestamp(),
            created_admin_user_id = $2,
            completed_from_ip = $3,
            completed_user_agent = $4
        WHERE id = $1 AND status = 'armed'
          AND expires_at > clock_timestamp()
          AND invalid_attempt_count < max_attempts
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
      [runId, createdAdminUserId, completedFromIp, completedUserAgent],
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function cancelRecoveryRun({ runId, reason = null, queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE admin_recovery_runs
        SET status = 'cancelled',
            cancelled_at = clock_timestamp(),
            reason = COALESCE($2, reason)
        WHERE id = $1 AND status = 'armed'
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
      [runId, reason],
    );

    return normalizeRecoveryRun(result.rows[0]);
  }

  async function expireStaleArmedRuns({ queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE admin_recovery_runs
        SET status = 'expired',
            cancelled_at = clock_timestamp()
        WHERE status = 'armed'
          AND expires_at <= clock_timestamp()
        RETURNING id, status, recovery_code_hash, armed_via, armed_at, expires_at,
                  invalid_attempt_count, max_attempts, completed_at, cancelled_at,
                  created_admin_user_id, completed_from_ip, completed_user_agent,
                  reason, details_json, created_at
      `,
    );

    return result.rows.map(normalizeRecoveryRun);
  }

  async function expireRecoveryRun({ runId, queryable }) {
    await queryable.query(`UPDATE admin_recovery_runs SET status = 'expired', cancelled_at = clock_timestamp()
      WHERE id = $1 AND status = 'armed' AND expires_at <= clock_timestamp()`, [runId]);
  }

  async function lockOperatorLifecycle({ queryable }) {
    await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.admin-recovery-lifecycle', 0))");
  }

  async function revokeAllInteractiveSessions({ revokedReason = 'admin_recovery', queryable = null } = {}) {
    const result = await (queryable ?? getPoolFn()).query(
      `
        UPDATE refresh_tokens
        SET is_revoked = TRUE,
            revoked_at = NOW(),
            revoked_reason = $1
        WHERE is_revoked = FALSE
      `,
      [revokedReason],
    );

    return result.rowCount ?? 0;
  }

  return {
    cancelRecoveryRun,
    completeRecoveryRun,
    expireStaleArmedRuns,
    expireRecoveryRun,
    getActiveArmedRun,
    getRecoveryRunById,
    incrementInvalidAttemptCount,
    insertRecoveryRun,
    invalidateRecoveryRun,
    lockOperatorLifecycle,
    revokeAllInteractiveSessions,
  };
}
