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

function normalizeSnapshotRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter((row) => row && typeof row === 'object')
    .map((row) => ({ ...row }));
}

export function createRestoreScopeRuntimeSnapshotStore({
  getPoolFn = getPool,
} = {}) {
  async function listTrustSnapshot() {
    const result = await getPoolFn().query(
      `
        SELECT payload
        FROM recovery_trust_snapshots
        ORDER BY snapshot_order ASC
      `,
    );

    return normalizeSnapshotRows(result.rows.map((row) => row.payload));
  }

  async function replaceTrustSnapshot({ sourceUsers = [] } = {}) {
    const normalizedRows = normalizeSnapshotRows(sourceUsers);
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM recovery_trust_snapshots');

      for (const [index, payload] of normalizedRows.entries()) {
        await client.query(
          `
            INSERT INTO recovery_trust_snapshots (
              snapshot_order,
              payload,
              updated_at
            )
            VALUES ($1, $2::jsonb, NOW())
          `,
          [index, JSON.stringify(payload)],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function listOverridesSnapshot() {
    const result = await getPoolFn().query(
      `
        SELECT payload
        FROM recovery_override_snapshots
        ORDER BY snapshot_order ASC
      `,
    );

    return normalizeSnapshotRows(result.rows.map((row) => row.payload));
  }

  async function replaceOverridesSnapshot({ manualOverrides = [] } = {}) {
    const normalizedRows = normalizeSnapshotRows(manualOverrides);
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM recovery_override_snapshots');

      for (const [index, payload] of normalizedRows.entries()) {
        await client.query(
          `
            INSERT INTO recovery_override_snapshots (
              snapshot_order,
              payload,
              updated_at
            )
            VALUES ($1, $2::jsonb, NOW())
          `,
          [index, JSON.stringify(payload)],
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    listOverridesSnapshot,
    listTrustSnapshot,
    replaceOverridesSnapshot,
    replaceTrustSnapshot,
  };
}