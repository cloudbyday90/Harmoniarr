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
import { PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT, PUSH_SUBSCRIPTION_PRUNING_MAX_BATCHES } from './push-subscription-pruning-policy.js';
import { createPushCleanupSummary, runBoundedCleanupPhase } from './push-cleanup-phase.js';

const defaultCleanupIntervalMs = 6 * 60 * 60 * 1000;

export function createPushNotificationHistoryCleanupHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  deleteTerminalNotificationHistory,
  pruneInvalidatedSubscriptions = null,
  intervalMs = defaultCleanupIntervalMs,
  batchLimit = PUSH_HISTORY_BATCH_LIMIT,
  maxBatches = PUSH_HISTORY_MAX_BATCHES,
  subscriptionBatchLimit = PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT,
  subscriptionMaxBatches = PUSH_SUBSCRIPTION_PRUNING_MAX_BATCHES,
  onError = () => process.stderr.write('[harmoniarr-push] Notification history cleanup failed.\n'),
  onSubscriptionPruningError = () => process.stderr.write('[harmoniarr-push] Invalidated subscription pruning failed.\n'),
} = {}) {
  if (typeof deleteTerminalNotificationHistory !== 'function') {
    throw new Error('deleteTerminalNotificationHistory dependency is required');
  }
  if (pruneInvalidatedSubscriptions !== null && typeof pruneInvalidatedSubscriptions !== 'function') {
    throw new Error('pruneInvalidatedSubscriptions dependency must be a function');
  }
  if (!Number.isSafeInteger(batchLimit) || batchLimit < 1 || batchLimit > PUSH_HISTORY_BATCH_LIMIT
    || !Number.isSafeInteger(maxBatches) || maxBatches < 1 || maxBatches > PUSH_HISTORY_MAX_BATCHES
    || !Number.isSafeInteger(intervalMs) || intervalMs < 1 || intervalMs > 2147483647) {
    throw new RangeError('Notification history cleanup bounds are invalid');
  }
  if (!Number.isSafeInteger(subscriptionBatchLimit) || subscriptionBatchLimit < 1
    || subscriptionBatchLimit > PUSH_SUBSCRIPTION_PRUNING_BATCH_LIMIT
    || !Number.isSafeInteger(subscriptionMaxBatches) || subscriptionMaxBatches < 1
    || subscriptionMaxBatches > PUSH_SUBSCRIPTION_PRUNING_MAX_BATCHES) {
    throw new RangeError('Subscription pruning bounds are invalid');
  }
  let stopped = false;
  let generation = 0;
  function skippedSummary(reason) {
    const history = createPushCleanupSummary(reason);
    return pruneInvalidatedSubscriptions
      ? { ...history, subscriptionPruning: createPushCleanupSummary(reason) }
      : history;
  }

  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTickInProgress: async () => skippedSummary('tick_in_progress'),
    onTick: async () => {
      const tickGeneration = generation;
      const shouldStop = () => stopped || tickGeneration !== generation;
      const history = await runBoundedCleanupPhase({
        deleteBatch: deleteTerminalNotificationHistory, batchLimit, maxBatches, shouldStop,
        onError: () => onError(new Error('Notification history cleanup failed')),
      });
      if (!pruneInvalidatedSubscriptions) return history;
      if (shouldStop()) return { ...history, subscriptionPruning: createPushCleanupSummary('stopped') };
      if (history.reason === 'error') return { ...history, subscriptionPruning: createPushCleanupSummary('history_error') };
      const subscriptionPruning = await runBoundedCleanupPhase({
        deleteBatch: pruneInvalidatedSubscriptions,
        batchLimit: subscriptionBatchLimit,
        maxBatches: subscriptionMaxBatches,
        shouldStop,
        onError: () => onSubscriptionPruningError(new Error('Invalidated subscription pruning failed')),
      });
      return { ...history, subscriptionPruning };
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
