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

import { createIntervalHeartbeatRunner } from '../heartbeat/interval-heartbeat-runner.js';

const defaultIntervalMs = 60000;
const defaultCorrelationLimit = 100;
const defaultCleanupBatchSize = 500;

export function createFulfillmentCorrelationHeartbeat({
  correlateUnmatchedEvidence,
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  deleteExpiredEvidence,
  intervalMs = defaultIntervalMs,
  onError = () => {},
} = {}) {
  if (typeof correlateUnmatchedEvidence !== 'function') {
    throw new Error('correlateUnmatchedEvidence dependency is required');
  }
  if (typeof deleteExpiredEvidence !== 'function') {
    throw new Error('deleteExpiredEvidence dependency is required');
  }

  return createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      try {
        const [correlationResult, deletedCount] = await Promise.all([
          correlateUnmatchedEvidence({ limit: defaultCorrelationLimit }),
          deleteExpiredEvidence({ batchSize: defaultCleanupBatchSize }),
        ]);

        return {
          correlation: correlationResult,
          deleted: deletedCount,
          skipped: false,
        };
      } catch (error) {
        onError(error);
        return { reason: 'error', skipped: true };
      }
    },
  });
}
