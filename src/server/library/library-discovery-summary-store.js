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

function mapRequestCounts(row) {
  return {
    blocked: toInteger(row.blocked_request_count),
    cooldown: toInteger(row.cooldown_request_count),
    ready: toInteger(row.ready_request_count),
    totalRequests: toInteger(row.total_request_count),
  };
}

export function createLibraryDiscoverySummaryStore({
  getPoolFn = getPool,
} = {}) {
  async function getLibraryDiscoverySnapshot() {
    const pool = getPoolFn();
    const result = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE request_status = 'ready')::integer AS ready_request_count,
          COUNT(*) FILTER (WHERE request_status = 'cooldown')::integer AS cooldown_request_count,
          COUNT(*) FILTER (WHERE request_status = 'blocked')::integer AS blocked_request_count,
          COUNT(*)::integer AS total_request_count,
          MIN(next_search_after) FILTER (WHERE request_status <> 'ready') AS next_eligible_at,
          MAX(last_evaluated_at) AS last_evaluated_at
        FROM library_discovery_requests
      `,
    );

    return {
      lastEvaluatedAt: result.rows[0]?.last_evaluated_at ?? null,
      nextEligibleAt: result.rows[0]?.next_eligible_at ?? null,
      requestCounts: mapRequestCounts(result.rows[0] ?? {}),
    };
  }

  return {
    getLibraryDiscoverySnapshot,
  };
}