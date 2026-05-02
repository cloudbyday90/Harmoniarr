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

function normalizeLock(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    lockType: row.lock_type,
    status: row.status,
    reason: row.reason ?? null,
    acquiredByUserId: row.acquired_by_user_id ?? null,
    acquiredAt: row.acquired_at?.toISOString?.() ?? row.acquired_at ?? null,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at ?? null,
  };
}

export function createMaintenanceLockService({
  getPoolFn = getPool,
} = {}) {
  async function listActiveMaintenanceLocks({ lockTypes = null } = {}) {
    const normalizedLockTypes = Array.isArray(lockTypes) && lockTypes.length > 0
      ? lockTypes.filter((lockType) => typeof lockType === 'string' && lockType.trim().length > 0)
      : [];

    const pool = getPoolFn();
    const hasLockTypeFilter = normalizedLockTypes.length > 0;
    const result = await pool.query(
      `
        SELECT id, lock_type, status, reason, acquired_by_user_id, acquired_at, expires_at
        FROM maintenance_locks
        WHERE status = 'active'
          AND released_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
          AND ($1::boolean = false OR lock_type = ANY($2::text[]))
        ORDER BY acquired_at ASC
      `,
      [hasLockTypeFilter, normalizedLockTypes],
    );

    return result.rows.map(normalizeLock);
  }

  async function listRestoreApplyBlockingLocks() {
    return listActiveMaintenanceLocks();
  }

  async function acquireMaintenanceLock({
    lockType,
    reason = null,
    acquiredByUserId = null,
    ownerInstanceId = null,
    expiresAt = null,
    status = 'active',
  } = {}) {
    if (typeof lockType !== 'string' || lockType.trim().length < 1) {
      throw new Error('lockType is required');
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        INSERT INTO maintenance_locks (
          lock_type,
          status,
          owner_instance_id,
          reason,
          acquired_by_user_id,
          acquired_at,
          expires_at,
          released_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6::timestamptz, NULL)
        RETURNING id, lock_type, status, reason, acquired_by_user_id, acquired_at, expires_at
      `,
      [lockType.trim(), status, ownerInstanceId, reason, acquiredByUserId, expiresAt],
    );

    return normalizeLock(result.rows[0]);
  }

  async function releaseMaintenanceLock({ lockId, status = 'released' } = {}) {
    if (typeof lockId !== 'string' || lockId.trim().length < 1) {
      throw new Error('lockId is required');
    }

    const pool = getPoolFn();
    const result = await pool.query(
      `
        UPDATE maintenance_locks
        SET status = $2,
            released_at = NOW()
        WHERE id = $1
          AND released_at IS NULL
        RETURNING id, lock_type, status, reason, acquired_by_user_id, acquired_at, expires_at
      `,
      [lockId, status],
    );

    return normalizeLock(result.rows[0]);
  }

  return {
    acquireMaintenanceLock,
    listActiveMaintenanceLocks,
    listRestoreApplyBlockingLocks,
    releaseMaintenanceLock,
  };
}
