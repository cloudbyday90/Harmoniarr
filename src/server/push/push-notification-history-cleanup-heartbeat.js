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
import { PUSH_HISTORY_BATCH_LIMIT, PUSH_HISTORY_MAX_BATCHES } from './push-notification-retention-policy.js';

const defaultCleanupIntervalMs = 6 * 60 * 60 * 1000;

export function createPushNotificationHistoryCleanupHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  deleteTerminalNotificationHistory,
  intervalMs = defaultCleanupIntervalMs,
  batchLimit = PUSH_HISTORY_BATCH_LIMIT,
  maxBatches = PUSH_HISTORY_MAX_BATCHES,
  onError = () => process.stderr.write('[harmoniarr-push] Notification history cleanup failed.\n'),
} = {}) {
  if (typeof deleteTerminalNotificationHistory !== 'function') {
    throw new Error('deleteTerminalNotificationHistory dependency is required');
  }
  if (!Number.isSafeInteger(batchLimit) || batchLimit < 1 || batchLimit > PUSH_HISTORY_BATCH_LIMIT
    || !Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > PUSH_HISTORY_MAX_BATCHES
    || !Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647) {
    throw new RangeError('Notification history cleanup bounds are invalid');
  }
  let stopped = false;
  let generation = 0;
  function reportFailure() {
    try {
      const result = onError(new Error('Notification history cleanup failed'));
      if (typeof result?.catch === 'function') result.catch(() => {});
    } catch { /* Diagnostics cannot reject an interval tick or discard confirmed counts. */ }
  }

  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTickInProgress: async () => ({ deletedCount: 0, batchesCompleted: 0, batchLimitReached: false,
      reason: 'tick_in_progress', skipped: true }),
    onTick: async () => {
      const tickGeneration = generation;
      const summary = { deletedCount: 0, batchesCompleted: 0, batchLimitReached: false, skipped: true };
      try {
        for (let index = 0; index < maxBatches; index += 1) {
          if (stopped || tickGeneration !== generation) return { ...summary, reason: 'stopped' };
          const result = await deleteTerminalNotificationHistory({ limit: batchLimit });
          if (!Number.isSafeInteger(result?.deletedCount) || result.deletedCount < 0 || result.deletedCount > batchLimit) {
            throw new Error('Notification history cleanup returned an invalid count');
          }
          summary.deletedCount += result.deletedCount;
          summary.batchesCompleted += 1;
          summary.skipped = false;
          if (result.deletedCount < batchLimit) return summary;
        }
        return { ...summary, batchLimitReached: true };
      } catch {
        reportFailure();
        return { ...summary, reason: 'error' };
      }
    },
  });
  return {
    start() {
      stopped = false;
      return runner.start();
    },
    stop() {
      stopped = true;
      generation += 1;
      // The current SQL statement may finish; no subsequent batch can start.
      return runner.stop();
    },
    tick: runner.tick,
  };
}
