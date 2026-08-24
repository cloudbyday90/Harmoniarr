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

function normalizeRecord(row) {
  if (!row) {
    return null;
  }

  return {
    actorUserId: row.actor_user_id ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at ?? null,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at ?? null,
    id: row.id,
    idempotencyKey: row.idempotency_key,
    operationScope: row.operation_scope,
    requestHash: row.request_hash,
    response: row.response_json ?? {},
    state: row.state ?? 'completed',
    statusCode: row.status_code,
  };
}

export function createControlPlaneIdempotencyStore({
  getPoolFn = getPool,
} = {}) {
  async function getRecordByScopeActorAndKey({ actorUserId = null, idempotencyKey, operationScope }) {
    const result = await getPoolFn().query(
      `
        SELECT id, operation_scope, actor_user_id, idempotency_key, request_hash, state, status_code, response_json, created_at, expires_at
        FROM control_plane_idempotency_records
        WHERE operation_scope = $1
          AND actor_user_id IS NOT DISTINCT FROM $2
          AND idempotency_key = $3
        LIMIT 1
      `,
      [operationScope, actorUserId, idempotencyKey],
    );

    return normalizeRecord(result.rows[0]);
  }

  async function createInProgressRecord({
    actorUserId = null,
    expiresAt = null,
    idempotencyKey,
    operationScope,
    requestHash,
  }) {
    const result = await getPoolFn().query(
      `
        INSERT INTO control_plane_idempotency_records (
          operation_scope,
          actor_user_id,
          idempotency_key,
          request_hash,
          state,
          status_code,
          response_json,
          expires_at
        )
        VALUES ($1, $2, $3, $4, 'in_progress', 202, '{}'::jsonb, $5::timestamptz)
        ON CONFLICT DO NOTHING
        RETURNING id, operation_scope, actor_user_id, idempotency_key, request_hash, state, status_code, response_json, created_at, expires_at
      `,
      [
        operationScope,
        actorUserId,
        idempotencyKey,
        requestHash,
        expiresAt,
      ],
    );

    return normalizeRecord(result.rows[0]);
  }

  async function completeRecord({ expiresAt = null, id, response, statusCode }) {
    const result = await getPoolFn().query(
      `
        UPDATE control_plane_idempotency_records
        SET state = 'completed',
            status_code = $2,
            response_json = $3::jsonb,
            expires_at = $4::timestamptz
        WHERE id = $1
          AND state = 'in_progress'
        RETURNING id, operation_scope, actor_user_id, idempotency_key, request_hash, state, status_code, response_json, created_at, expires_at
      `,
      [id, statusCode, JSON.stringify(response ?? {}), expiresAt],
    );

    return normalizeRecord(result.rows[0]);
  }

  async function deleteExpiredRecordById({ id, now }) {
    const result = await getPoolFn().query(
      `
        DELETE FROM control_plane_idempotency_records
        WHERE id = $1
          AND expires_at IS NOT NULL
          AND expires_at <= $2::timestamptz
        RETURNING id
      `,
      [id, now],
    );

    return result.rowCount > 0;
  }

  async function deleteInProgressRecordById({ id }) {
    await getPoolFn().query(
      `
        DELETE FROM control_plane_idempotency_records
        WHERE id = $1
          AND state = 'in_progress'
      `,
      [id],
    );
  }

  async function deleteExpiredRecords({ now = null } = {}) {
    const result = await getPoolFn().query(
      `
        DELETE FROM control_plane_idempotency_records
        WHERE expires_at IS NOT NULL
          AND expires_at <= COALESCE($1::timestamptz, NOW())
      `,
      [now],
    );

    return {
      deletedCount: result.rowCount ?? 0,
    };
  }

  return {
    completeRecord,
    createInProgressRecord,
    deleteExpiredRecords,
    deleteExpiredRecordById,
    deleteInProgressRecordById,
    getRecordByScopeActorAndKey,
  };
}
