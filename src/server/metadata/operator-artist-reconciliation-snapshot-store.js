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

function normalizeSnapshotRow(row) {
  if (!row) {
    return null;
  }

  return {
    appUserId: row.app_user_id ?? row.appUserId ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.createdAt ?? null,
    id: row.id ?? null,
    metadataArtistId: row.metadata_artist_id ?? row.metadataArtistId ?? null,
    snapshotPayload: row.snapshot_payload ?? row.snapshotPayload ?? {},
    snapshotRevision: Number.parseInt(
      row.snapshot_revision ?? row.snapshotRevision ?? '0',
      10,
    ) || 0,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updatedAt ?? null,
  };
}

export function createOperatorArtistReconciliationSnapshotStore({
  getPoolFn = getPool,
} = {}) {
  async function getOperatorArtistReconciliationSnapshotById({
    appUserId,
    metadataArtistId,
    snapshotId,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_artist_reconciliation_snapshot
        WHERE id = $1
          AND app_user_id = $2
          AND metadata_artist_id = $3
        LIMIT 1
      `,
      [snapshotId, appUserId, metadataArtistId],
    );

    return normalizeSnapshotRow(result.rows[0]);
  }

  async function getLatestOperatorArtistReconciliationSnapshot({
    appUserId,
    metadataArtistId,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_artist_reconciliation_snapshot
        WHERE app_user_id = $1
          AND metadata_artist_id = $2
        ORDER BY snapshot_revision DESC
        LIMIT 1
      `,
      [appUserId, metadataArtistId],
    );

    return normalizeSnapshotRow(result.rows[0]);
  }

  async function createOperatorArtistReconciliationSnapshot({
    appUserId,
    metadataArtistId,
    queryable = null,
    snapshotPayload,
  }) {
    const queryTarget = queryable ?? getPoolFn();
    const result = await queryTarget.query(
      `
        WITH next_revision AS (
          SELECT COALESCE(MAX(snapshot_revision), 0) + 1 AS snapshot_revision
          FROM operator_artist_reconciliation_snapshot
          WHERE app_user_id = $1
            AND metadata_artist_id = $2
        )
        INSERT INTO operator_artist_reconciliation_snapshot (
          app_user_id,
          metadata_artist_id,
          snapshot_revision,
          snapshot_payload,
          updated_at
        )
        SELECT $1, $2, next_revision.snapshot_revision, $3::jsonb, NOW()
        FROM next_revision
        RETURNING *
      `,
      [
        appUserId,
        metadataArtistId,
        JSON.stringify(snapshotPayload ?? {}),
      ],
    );

    return normalizeSnapshotRow(result.rows[0]);
  }

  async function listOperatorArtistReconciliationSnapshots({
    appUserId = null,
    metadataArtistId = null,
  } = {}) {
    const pool = getPoolFn();
    const clauses = [];
    const params = [];

    if (appUserId) {
      params.push(appUserId);
      clauses.push(`app_user_id = $${params.length}`);
    }
    if (metadataArtistId) {
      params.push(metadataArtistId);
      clauses.push(`metadata_artist_id = $${params.length}`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await pool.query(
      `
        SELECT *
        FROM operator_artist_reconciliation_snapshot
        ${whereClause}
        ORDER BY app_user_id ASC, metadata_artist_id ASC, snapshot_revision ASC
      `,
      params,
    );

    return result.rows.map((row) => normalizeSnapshotRow(row));
  }

  return {
    createOperatorArtistReconciliationSnapshot,
    getOperatorArtistReconciliationSnapshotById,
    getLatestOperatorArtistReconciliationSnapshot,
    listOperatorArtistReconciliationSnapshots,
  };
}
