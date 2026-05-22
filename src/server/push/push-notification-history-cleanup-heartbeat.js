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

const defaultCleanupIntervalMs = 6 * 60 * 60 * 1000;
const defaultRetentionMs = 7 * 24 * 60 * 60 * 1000;

export function createPushNotificationHistoryCleanupHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  deleteSentNotificationHistory,
  intervalMs = defaultCleanupIntervalMs,
  nowFn = () => new Date(),
  onError = () => {},
  retentionMs = defaultRetentionMs,
} = {}) {
  if (typeof deleteSentNotificationHistory !== 'function') {
    throw new Error('deleteSentNotificationHistory dependency is required');
  }

  return createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      try {
        const now = nowFn();
        const cutoff = new Date(now.getTime() - retentionMs).toISOString();
        const result = await deleteSentNotificationHistory({ olderThan: cutoff });
        return {
          deletedCount: result?.deletedCount ?? 0,
          skipped: false,
        };
      } catch (error) {
        onError(error);
        return {
          reason: 'error',
          skipped: true,
        };
      }
    },
  });
}
