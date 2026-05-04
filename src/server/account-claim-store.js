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

import { getPool } from './database.js';

function mapClaimRow(row) {
  if (!row) {
    return null;
  }

  return {
    appUserId: row.app_user_id,
    claimCodeHash: row.claim_code_hash,
    consumedAt: row.consumed_at ?? null,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    id: row.id,
    issuedByUserId: row.issued_by_user_id ?? null,
    revokeReason: row.revoke_reason ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

export function createAccountClaimStore({
  getPoolFn = getPool,
} = {}) {
  async function insertClaimCode({ appUserId, claimCodeHash, client = getPoolFn(), expiresAt, issuedByUserId = null }) {
    const result = await client.query(
      `
        INSERT INTO app_user_claim_codes (
          app_user_id,
          issued_by_user_id,
          claim_code_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [appUserId, issuedByUserId, claimCodeHash, expiresAt],
    );

    return mapClaimRow(result.rows[0] ?? null);
  }

  async function getActiveClaimForUser({ client = getPoolFn(), lockForUpdate = false, userId }) {
    const result = await client.query(
      `
        SELECT *
        FROM app_user_claim_codes
        WHERE app_user_id = $1
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        ${lockForUpdate ? 'FOR UPDATE' : ''}
      `,
      [userId],
    );

    return mapClaimRow(result.rows[0] ?? null);
  }

  async function revokeActiveClaimCodesForUser({ client = getPoolFn(), reason = 'reissued', userId }) {
    const result = await client.query(
      `
        UPDATE app_user_claim_codes
        SET revoked_at = NOW(),
            revoke_reason = $2
        WHERE app_user_id = $1
          AND consumed_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
      `,
      [userId, reason],
    );

    return result.rowCount ?? 0;
  }

  async function consumeClaimCode({ claimId, client = getPoolFn() }) {
    const result = await client.query(
      `
        UPDATE app_user_claim_codes
        SET consumed_at = NOW()
        WHERE id = $1
          AND consumed_at IS NULL
        RETURNING *
      `,
      [claimId],
    );

    return mapClaimRow(result.rows[0] ?? null);
  }

  return {
    consumeClaimCode,
    getActiveClaimForUser,
    insertClaimCode,
    revokeActiveClaimCodesForUser,
  };
}