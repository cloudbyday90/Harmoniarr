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
import {
  defaultOperatorArtistMonitoringPolicy,
  normalizeOperatorArtistMonitoringRow,
} from './operator-artist-monitoring-policy.js';

export function createOperatorArtistMonitoringStore({
  getPoolFn = getPool,
} = {}) {
  async function listOperatorMonitoredArtists({
    appUserId,
    limit = 25,
    offset = 0,
  }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          operator_artist_monitoring.*,
          metadata_artists.name,
          metadata_artists.sort_name,
          metadata_artists.disambiguation,
          metadata_artists.country,
          metadata_artists.artist_type,
          metadata_artists.musicbrainz_artist_id
        FROM operator_artist_monitoring
        INNER JOIN metadata_artists
          ON metadata_artists.id = operator_artist_monitoring.metadata_artist_id
        WHERE operator_artist_monitoring.app_user_id = $1
          AND operator_artist_monitoring.is_monitored = TRUE
        ORDER BY
          COALESCE(NULLIF(metadata_artists.sort_name, ''), metadata_artists.name) ASC,
          operator_artist_monitoring.metadata_artist_id ASC
        LIMIT $2
        OFFSET $3
      `,
      [appUserId, limit, offset],
    );

    return result.rows.map((row) => ({
      artist: {
        country: row.country ?? null,
        disambiguation: row.disambiguation ?? null,
        id: row.metadata_artist_id,
        musicBrainzArtistId: row.musicbrainz_artist_id ?? null,
        name: row.name,
        sortName: row.sort_name ?? null,
        type: row.artist_type ?? null,
      },
      monitoring: normalizeOperatorArtistMonitoringRow(row),
    }));
  }

  async function getOperatorArtistMonitoring({ appUserId, metadataArtistId, queryable = null }) {
    const queryTarget = queryable ?? getPoolFn();
    const result = await queryTarget.query(
      `
        SELECT *
        FROM operator_artist_monitoring
        WHERE app_user_id = $1
          AND metadata_artist_id = $2
        LIMIT 1
      `,
      [appUserId, metadataArtistId],
    );

    if (result.rows.length === 0) {
      return {
        ...defaultOperatorArtistMonitoringPolicy,
        appUserId,
        id: null,
        metadataArtistId,
      };
    }

    return normalizeOperatorArtistMonitoringRow(result.rows[0]);
  }

  async function listOperatorArtistMonitoringByMetadataArtist({ metadataArtistId }) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_artist_monitoring
        WHERE metadata_artist_id = $1
          AND is_monitored = TRUE
        ORDER BY updated_at DESC, app_user_id ASC
      `,
      [metadataArtistId],
    );

    return result.rows.map((row) => normalizeOperatorArtistMonitoringRow(row));
  }

  async function upsertOperatorArtistMonitoring({
    acquisitionProfileKey,
    appUserId,
    isMonitored,
    lastReconciledAt = null,
    lastSavedSnapshotAt = null,
    metadataArtistId,
    monitoredReleaseGroupTypes,
    queryable = null,
    releaseScope,
    searchOnAddMode,
    selectionSourceMode,
    wantedAutomationMode,
  }) {
    const queryTarget = queryable ?? getPoolFn();
    await queryTarget.query(
      `
        INSERT INTO operator_artist_monitoring (
          app_user_id,
          metadata_artist_id,
          is_monitored,
          monitored_release_group_types,
          release_scope,
          wanted_automation_mode,
          acquisition_profile_key,
          search_on_add_mode,
          selection_source_mode,
          last_reconciled_at,
          last_saved_snapshot_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz, NOW())
        ON CONFLICT (app_user_id, metadata_artist_id) DO UPDATE
        SET is_monitored = EXCLUDED.is_monitored,
            monitored_release_group_types = EXCLUDED.monitored_release_group_types,
            release_scope = EXCLUDED.release_scope,
            wanted_automation_mode = EXCLUDED.wanted_automation_mode,
            acquisition_profile_key = EXCLUDED.acquisition_profile_key,
            search_on_add_mode = EXCLUDED.search_on_add_mode,
            selection_source_mode = EXCLUDED.selection_source_mode,
            last_reconciled_at = EXCLUDED.last_reconciled_at,
            last_saved_snapshot_at = EXCLUDED.last_saved_snapshot_at,
            updated_at = NOW()
      `,
      [
        appUserId,
        metadataArtistId,
        isMonitored,
        monitoredReleaseGroupTypes,
        releaseScope,
        wantedAutomationMode,
        acquisitionProfileKey,
        searchOnAddMode,
        selectionSourceMode,
        lastReconciledAt,
        lastSavedSnapshotAt,
      ],
    );
  }

  async function listOperatorArtistMonitoringSnapshot() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT *
        FROM operator_artist_monitoring
        ORDER BY app_user_id ASC, metadata_artist_id ASC
      `,
    );

    return result.rows.map((row) => normalizeOperatorArtistMonitoringRow(row));
  }

  async function replaceOperatorArtistMonitoringSnapshot({ operatorArtistMonitoring = [] } = {}) {
    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM operator_artist_monitoring');

      for (const row of operatorArtistMonitoring) {
        await client.query(
          `
            INSERT INTO operator_artist_monitoring (
              app_user_id,
              metadata_artist_id,
              is_monitored,
              monitored_release_group_types,
              release_scope,
              wanted_automation_mode,
              acquisition_profile_key,
              search_on_add_mode,
              selection_source_mode,
              last_reconciled_at,
              last_saved_snapshot_at,
              updated_at
            )
            VALUES ($1, $2, $3, $4::text[], $5, $6, $7, $8, $9, $10::timestamptz, $11::timestamptz, NOW())
          `,
          [
            row.appUserId,
            row.metadataArtistId,
            row.isMonitored === true,
            Array.isArray(row.monitoredReleaseGroupTypes) && row.monitoredReleaseGroupTypes.length > 0
              ? row.monitoredReleaseGroupTypes
              : [...defaultOperatorArtistMonitoringPolicy.monitoredReleaseGroupTypes],
            row.releaseScope ?? defaultOperatorArtistMonitoringPolicy.releaseScope,
            row.wantedAutomationMode ?? defaultOperatorArtistMonitoringPolicy.wantedAutomationMode,
            row.acquisitionProfileKey ?? defaultOperatorArtistMonitoringPolicy.acquisitionProfileKey,
            row.searchOnAddMode ?? defaultOperatorArtistMonitoringPolicy.searchOnAddMode,
            row.selectionSourceMode ?? defaultOperatorArtistMonitoringPolicy.selectionSourceMode,
            row.lastReconciledAt ?? null,
            row.lastSavedSnapshotAt ?? null,
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
    getOperatorArtistMonitoring,
    listOperatorArtistMonitoringByMetadataArtist,
    listOperatorMonitoredArtists,
    listOperatorArtistMonitoringSnapshot,
    replaceOperatorArtistMonitoringSnapshot,
    upsertOperatorArtistMonitoring,
  };
}
