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

export function createBackgroundJobHealthService({
  getPoolFn = getPool,
} = {}) {
  async function getWorkerHealth() {
    const pool = getPoolFn();
    const [leaseResult, operationResult] = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::integer AS count
        FROM job_leases
        WHERE released_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
      `),
      pool.query(`
        SELECT COUNT(*)::integer AS count
        FROM operation_runs
        WHERE status = 'running'
      `),
    ]);

    const activeLeaseCount = Number(leaseResult.rows[0]?.count ?? 0);
    const runningOperationCount = Number(operationResult.rows[0]?.count ?? 0);

    return {
      activeLeaseCount,
      runningOperationCount,
      status: activeLeaseCount > 0 || runningOperationCount > 0
        ? 'healthy'
        : 'informational',
      message: activeLeaseCount > 0 || runningOperationCount > 0
        ? 'Background worker activity is reporting through active leases or running operations.'
        : 'No active background worker leases are reporting yet. This remains informational until worker slices land.',
    };
  }

  return {
    getWorkerHealth,
  };
}