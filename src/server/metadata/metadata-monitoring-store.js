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
import { operationRunRegistry } from '../../shared/operation-run-descriptors.js';

function normalizeDateValue(value) {
  return value?.toISOString?.() ?? value ?? null;
}

export function createMetadataMonitoringStore({
  getPoolFn = getPool,
} = {}) {
  const refreshOperationType = operationRunRegistry.metadataArtistRefresh.operationType;

  async function getArtistMonitoring(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT metadata_artist_id, is_monitored, monitored_release_group_types, last_refreshed_at, next_refresh_at
        FROM metadata_artist_monitoring
        WHERE metadata_artist_id = $1
        LIMIT 1
      `,
      [metadataArtistId],
    );

    if (result.rows.length === 0) {
      return {
        isMonitored: false,
        lastRefreshedAt: null,
        monitoredReleaseGroupTypes: ['album', 'ep'],
        nextRefreshAt: null,
      };
    }

    return {
      isMonitored: result.rows[0].is_monitored,
      lastRefreshedAt: normalizeDateValue(result.rows[0].last_refreshed_at),
      monitoredReleaseGroupTypes: result.rows[0].monitored_release_group_types ?? ['album', 'ep'],
      nextRefreshAt: normalizeDateValue(result.rows[0].next_refresh_at),
    };
  }

  async function upsertArtistMonitoring({
    isMonitored,
    metadataArtistId,
    monitoredReleaseGroupTypes,
  }) {
    const pool = getPoolFn();
    await pool.query(
      `
        INSERT INTO metadata_artist_monitoring (
          metadata_artist_id,
          is_monitored,
          monitored_release_group_types,
          last_refreshed_at,
          next_refresh_at,
          updated_at
        )
        VALUES ($1, $2, $3::text[], NULL, NULL, NOW())
        ON CONFLICT (metadata_artist_id) DO UPDATE
        SET is_monitored = EXCLUDED.is_monitored,
            monitored_release_group_types = EXCLUDED.monitored_release_group_types,
            updated_at = NOW()
      `,
      [metadataArtistId, isMonitored, monitoredReleaseGroupTypes],
    );
  }

  async function scheduleArtistRefresh({ metadataArtistId, nextRefreshAt }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE metadata_artist_monitoring
        SET next_refresh_at = $2,
            updated_at = NOW()
        WHERE metadata_artist_id = $1
      `,
      [metadataArtistId, nextRefreshAt],
    );
  }

  async function clearArtistRefreshSchedule({ metadataArtistId }) {
    const pool = getPoolFn();
    await pool.query(
      `
        UPDATE metadata_artist_monitoring
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
        UPDATE metadata_artist_monitoring
        SET last_refreshed_at = $2,
            next_refresh_at = $3,
            updated_at = NOW()
        WHERE metadata_artist_id = $1
      `,
      [metadataArtistId, lastRefreshedAt, nextRefreshAt],
    );
  }

  async function listArtistsDueForRefresh({ limit = 1, now = new Date().toISOString() } = {}) {
    const pool = getPoolFn();
    const normalizedLimit = Number.isInteger(limit) && limit > 0
      ? Math.min(limit, 25)
      : 1;
    const result = await pool.query(
      `
        SELECT
          metadata_artist_monitoring.metadata_artist_id,
          metadata_artist_monitoring.last_refreshed_at,
          metadata_artist_monitoring.next_refresh_at,
          metadata_artists.name,
          metadata_artists.musicbrainz_artist_id
        FROM metadata_artist_monitoring
        JOIN metadata_artists
          ON metadata_artists.id = metadata_artist_monitoring.metadata_artist_id
        WHERE metadata_artist_monitoring.is_monitored = TRUE
          AND (metadata_artist_monitoring.next_refresh_at IS NULL OR metadata_artist_monitoring.next_refresh_at <= $1)
          AND metadata_artists.musicbrainz_artist_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM operation_runs
            WHERE operation_runs.operation_type = $2
              AND operation_runs.status IN ('pending', 'running')
              AND operation_runs.summary->>'metadataArtistId' = metadata_artist_monitoring.metadata_artist_id::text
          )
        ORDER BY metadata_artist_monitoring.next_refresh_at ASC NULLS FIRST, metadata_artist_monitoring.updated_at DESC
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

  async function listArtistMonitoringSnapshot() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT metadata_artist_id, is_monitored, monitored_release_group_types, last_refreshed_at, next_refresh_at
        FROM metadata_artist_monitoring
        ORDER BY metadata_artist_id ASC
      `,
    );

    return result.rows.map((row) => ({
      isMonitored: row.is_monitored,
      lastRefreshedAt: normalizeDateValue(row.last_refreshed_at),
      metadataArtistId: row.metadata_artist_id,
      monitoredReleaseGroupTypes: row.monitored_release_group_types ?? ['album', 'ep'],
      nextRefreshAt: normalizeDateValue(row.next_refresh_at),
    }));
  }

  async function replaceArtistMonitoringSnapshot({ artistMonitoring = [] } = {}) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM metadata_artist_monitoring');

      for (const row of artistMonitoring) {
        await client.query(
          `
            INSERT INTO metadata_artist_monitoring (
              metadata_artist_id,
              is_monitored,
              monitored_release_group_types,
              last_refreshed_at,
              next_refresh_at,
              updated_at
            )
            VALUES ($1, $2, $3::text[], $4::timestamptz, $5::timestamptz, NOW())
          `,
          [
            row.metadataArtistId,
            row.isMonitored === true,
            Array.isArray(row.monitoredReleaseGroupTypes) && row.monitoredReleaseGroupTypes.length > 0
              ? row.monitoredReleaseGroupTypes
              : ['album', 'ep'],
            row.lastRefreshedAt ?? null,
            row.nextRefreshAt ?? null,
          ],
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
    clearArtistRefreshSchedule,
    getArtistMonitoring,
    listArtistMonitoringSnapshot,
    listArtistsDueForRefresh,
    recordArtistRefresh,
    replaceArtistMonitoringSnapshot,
    scheduleArtistRefresh,
    upsertArtistMonitoring,
  };
}