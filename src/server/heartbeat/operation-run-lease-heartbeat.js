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

import { createIntervalHeartbeatRunner } from './interval-heartbeat-runner.js';
import { normalizeExpectedJobLease } from '../job-lease-policy.js';

const defaultHeartbeatIntervalMs = 60 * 1000;

export function createOperationRunLeaseHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  intervalMs = defaultHeartbeatIntervalMs,
  onError = () => {},
  renewLease,
  expectedLease,
  runId,
  status = 'active',
} = {}) {
  const capturedLease = normalizeExpectedJobLease(expectedLease);
  return createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      try {
        if (!capturedLease) return { reason: 'lease_lost', skipped: true };
        const renewed = await renewLease({ runId, status, expectedLease: capturedLease });
        if (renewed === null) return { reason: 'lease_lost', skipped: true };
        return { skipped: false };
      } catch (error) {
        onError(error);
        return { reason: 'error', skipped: true };
      }
    },
  });
}
