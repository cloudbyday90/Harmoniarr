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

import { createIntervalHeartbeatRunner } from './heartbeat/interval-heartbeat-runner.js';

const defaultFanoutIntervalMs = 60 * 1000;

export function createOperatorNotificationFanoutHeartbeat({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  intervalMs = defaultFanoutIntervalMs,
  onError = () => {},
  startOperatorNotificationFanoutRunIfNeeded,
} = {}) {
  if (typeof startOperatorNotificationFanoutRunIfNeeded !== 'function') {
    throw new Error('startOperatorNotificationFanoutRunIfNeeded dependency is required');
  }

  return createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      try {
        const result = await startOperatorNotificationFanoutRunIfNeeded();
        if (result?.accepted) {
          return {
            queuedRunId: result.run?.id ?? null,
            skipped: false,
          };
        }

        return {
          reason: result?.reason ?? 'no_actionable_notifications',
          skipped: true,
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
