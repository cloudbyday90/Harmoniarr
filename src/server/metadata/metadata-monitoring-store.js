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

export function createMetadataMonitoringStore({
  getPoolFn = getPool,
} = {}) {
  async function getArtistMonitoring(metadataArtistId) {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT metadata_artist_id, is_monitored, monitored_release_group_types
        FROM metadata_artist_monitoring
        WHERE metadata_artist_id = $1
        LIMIT 1
      `,
      [metadataArtistId],
    );

    if (result.rows.length === 0) {
      return {
        isMonitored: false,
        monitoredReleaseGroupTypes: ['album', 'ep'],
      };
    }

    return {
      isMonitored: result.rows[0].is_monitored,
      monitoredReleaseGroupTypes: result.rows[0].monitored_release_group_types ?? ['album', 'ep'],
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
          updated_at
        )
        VALUES ($1, $2, $3::text[], NOW())
        ON CONFLICT (metadata_artist_id) DO UPDATE
        SET is_monitored = EXCLUDED.is_monitored,
            monitored_release_group_types = EXCLUDED.monitored_release_group_types,
            updated_at = NOW()
      `,
      [metadataArtistId, isMonitored, monitoredReleaseGroupTypes],
    );
  }

  return {
    getArtistMonitoring,
    upsertArtistMonitoring,
  };
}