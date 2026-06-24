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

import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';
import { getPool } from '../database.js';

function normalizeDateValue(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function normalizeReleaseGroupTypes(value) {
  return Array.isArray(value) && value.length > 0
    ? value
    : ['album', 'ep'];
}

export function createMetadataArtistRefreshStateStore({
  getPoolFn = getPool,
} = {}) {
  const refreshOperationType = operationRunRegistry.metadataArtistRefresh.operationType;

  async function scheduleArtistRefresh({ metadataArtistId, nextRefreshAt }) {
    const pool = getPoolFn();
    await pool.query(
      `
        INSERT INTO metadata_artist_refresh_state (
          metadata_artist_id,
          next_refresh_at,
          updated_at
        )
        VALUES ($1, $2::timestamptz, NOW())
        ON CONFLICT (metadata_artist_id) DO UPDATE
        SET next_refresh_at = EXCLUDED.next_refresh_at,
            updated_at = NOW()
      `,
      [metadataArtistId, nextRefreshAt],
    );
  }

  async function clearArtistRefreshSchedule({ metadataArtistId }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE metadata_artist_refresh_state
        SET next_refresh_at = NULL,
            updated_at = NOW()
        WHERE metadata_artist_id = $1
      `,
      [metadataArtistId],
    );
  }

  async function recordArtistRefresh({ lastRefreshedAt, metadataArtistId, nextRefreshAt }) {
    const pool = getPoolFn();
    await pool.query(
      `
        INSERT INTO metadata_artist_refresh_state (
          metadata_artist_id,
          last_refreshed_at,
          next_refresh_at,
          updated_at
        )
        VALUES ($1, $2::timestamptz, $3::timestamptz, NOW())
        ON CONFLICT (metadata_artist_id) DO UPDATE
        SET last_refreshed_at = EXCLUDED.last_refreshed_at,
            next_refresh_at = EXCLUDED.next_refresh_at,
            updated_at = NOW()
      `,
      [metadataArtistId, lastRefreshedAt, nextRefreshAt],
    );
  }

  async function getArtistRefreshMonitoring(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          COUNT(*)::integer AS monitoring_operator_count,
          ARRAY_AGG(DISTINCT monitored_type.type ORDER BY monitored_type.type) AS monitored_release_group_types
        FROM operator_artist_monitoring
        CROSS JOIN LATERAL unnest(operator_artist_monitoring.monitored_release_group_types) AS monitored_type(type)
        WHERE operator_artist_monitoring.metadata_artist_id = $1
          AND operator_artist_monitoring.is_monitored = TRUE
      `,
      [metadataArtistId],
    );
    const row = result.rows[0] ?? {};

    return {
      isMonitored: Number(row.monitoring_operator_count ?? 0) > 0,
      monitoredReleaseGroupTypes: normalizeReleaseGroupTypes(row.monitored_release_group_types),
    };
  }

  async function listArtistsDueForRefresh({ limit = 1, now = new Date().toISOString() } = {}) {
    const pool = getPoolFn();
    const normalizedLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 25)
      : 1;
    const result = await pool.query(
      `
        WITH monitored_artist_scope AS (
          SELECT
            operator_artist_monitoring.metadata_artist_id,
            MAX(operator_artist_monitoring.updated_at) AS latest_monitoring_updated_at
          FROM operator_artist_monitoring
          WHERE operator_artist_monitoring.is_monitored = TRUE
          GROUP BY operator_artist_monitoring.metadata_artist_id
        )
        SELECT
          monitored_artist_scope.metadata_artist_id,
          metadata_artist_refresh_state.last_refreshed_at,
          metadata_artist_refresh_state.next_refresh_at,
          metadata_artists.name,
          metadata_artists.musicbrainz_artist_id
        FROM monitored_artist_scope
        JOIN metadata_artists
          ON metadata_artists.id = monitored_artist_scope.metadata_artist_id
        LEFT JOIN metadata_artist_refresh_state
          ON metadata_artist_refresh_state.metadata_artist_id = monitored_artist_scope.metadata_artist_id
        WHERE (metadata_artist_refresh_state.next_refresh_at IS NULL OR metadata_artist_refresh_state.next_refresh_at <= $1)
          AND metadata_artists.musicbrainz_artist_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM operation_runs
            WHERE operation_runs.operation_type = $2
              AND operation_runs.status IN ('pending', 'running')
              AND operation_runs.summary->>'metadataArtistId' = monitored_artist_scope.metadata_artist_id::text
          )
        ORDER BY
          metadata_artist_refresh_state.next_refresh_at ASC NULLS FIRST,
          COALESCE(metadata_artist_refresh_state.updated_at, monitored_artist_scope.latest_monitoring_updated_at) DESC,
          monitored_artist_scope.metadata_artist_id ASC
        LIMIT $3
      `,
      [now, refreshOperationType, normalizedLimit],
    );

    return result.rows.map((row) => ({
      artistName: row.name,
      lastRefreshedAt: normalizeDateValue(row.last_refreshed_at),
      metadataArtistId: row.metadata_artist_id,
      musicBrainzArtistId: row.musicbrainz_artist_id,
      nextRefreshAt: normalizeDateValue(row.next_refresh_at),
    }));
  }

  return {
    clearArtistRefreshSchedule,
    getArtistRefreshMonitoring,
    listArtistsDueForRefresh,
    recordArtistRefresh,
    scheduleArtistRefresh,
  };
}
