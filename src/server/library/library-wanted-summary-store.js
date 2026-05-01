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

function toInteger(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

function mapReleaseCounts(row) {
  return {
    missing: toInteger(row.missing_release_count),
    partial: toInteger(row.partial_release_count),
    totalWanted: toInteger(row.total_wanted_release_count),
  };
}

export function createLibraryWantedSummaryStore({
  getPoolFn = getPool,
} = {}) {
  async function getLibraryWantedSnapshot() {
    const pool = getPoolFn();
    const [monitoredArtistResult, releaseCountsResult] = await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::integer AS monitored_artist_count
          FROM metadata_artist_monitoring
          WHERE is_monitored = TRUE
        `,
      ),
      pool.query(
        `
          SELECT
            COUNT(*) FILTER (WHERE wanted_status = 'missing')::integer AS missing_release_count,
            COUNT(*) FILTER (WHERE wanted_status = 'partial')::integer AS partial_release_count,
            COUNT(*)::integer AS total_wanted_release_count,
            MAX(last_reconciled_at) AS last_reconciled_at
          FROM library_wanted_releases
        `,
      ),
    ]);

    return {
      lastReconciledAt: releaseCountsResult.rows[0]?.last_reconciled_at ?? null,
      monitoredArtistCount: toInteger(monitoredArtistResult.rows[0]?.monitored_artist_count),
      releaseCounts: mapReleaseCounts(releaseCountsResult.rows[0] ?? {}),
    };
  }

  return {
    getLibraryWantedSnapshot,
  };
}