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

const defaultIntervalMs = 24 * 60 * 60 * 1000;

/**
 * Scheduled, deliberate retention pass for the control-plane ledgers. This is
 * the explicit "policy action" that replaces the legacy inline pruning coupled
 * to operation completion. It pauses while a maintenance lock is active and
 * never throws (the supervisor keeps long-lived heartbeats running).
 */
export function createLedgerRetentionHeartbeat({
  applyLedgerRetention,
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  heartbeatPauseService = null,
  intervalMs = defaultIntervalMs,
  onError = () => {},
} = {}) {
  if (typeof applyLedgerRetention !== 'function') {
    throw new Error('applyLedgerRetention dependency is required');
  }

  return createIntervalHeartbeatRunnerFn({
    intervalMs,
    onTick: async () => {
      try {
        const heartbeatReadiness = await heartbeatPauseService?.resolveHeartbeatReadiness?.({
          operationLabel: 'Ledger retention',
        }) ?? { allowed: true };

        if (!heartbeatReadiness.allowed) {
          return {
            nextRetryAt: heartbeatReadiness.nextRetryAt ?? null,
            reason: 'paused',
            skipped: true,
          };
        }

        const summary = await applyLedgerRetention({ trigger: 'scheduled' });
        return { skipped: false, summary };
      } catch (error) {
        onError(error);
        return { reason: 'error', skipped: true };
      }
    },
  });
}
