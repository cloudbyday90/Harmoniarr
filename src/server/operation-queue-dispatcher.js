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
import { createOperationQueueStore } from './operation-queue-store.js';

const defaultDispatchIntervalMs = 1000;

function normalizeDispatchIntervalMs(intervalMs) {
  const parsed = Number.parseInt(intervalMs, 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return defaultDispatchIntervalMs;
  }

  return Math.min(parsed, 60 * 1000);
}

export function createOperationQueueDispatcher({
  createIntervalHeartbeatRunnerFn = createIntervalHeartbeatRunner,
  dispatchPauseService = null,
  handlers = {},
  intervalMs = defaultDispatchIntervalMs,
  onError = async () => {},
  operationQueueStore = createOperationQueueStore(),
  operationStrandedRunRecoveryService = null,
} = {}) {
  const supportedOperationTypes = Object.keys(handlers).filter(Boolean);
  const resolvedDispatchIntervalMs = normalizeDispatchIntervalMs(intervalMs);

  function launchRun(run) {
    const handler = handlers[run.operationType];

    if (!handler) {
      return;
    }

    return (async () => {
      await handler({ run });
    })().catch(async (error) => {
      await onError(error, { run });
    });
  }

  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs: resolvedDispatchIntervalMs,
    onTick: async () => {
      const dispatchReadiness = dispatchPauseService?.resolveDispatchReadiness
        ? await dispatchPauseService.resolveDispatchReadiness({
          operationTypes: supportedOperationTypes,
        })
        : { allowed: true };

      if (dispatchReadiness && dispatchReadiness.allowed === false) {
        return {
          claimedCount: 0,
          failedCount: 0,
          nextRetryAt: dispatchReadiness.nextRetryAt ?? null,
          pauseCode: dispatchReadiness.pauseCode ?? null,
          pauseMessage: dispatchReadiness.pauseMessage ?? null,
          pauseProvider: dispatchReadiness.pauseProvider ?? null,
          pausedOperationTypes: dispatchReadiness.pausedOperationTypes ?? supportedOperationTypes,
          reason: 'paused',
          retriedCount: 0,
          scannedCount: 0,
          skipped: true,
        };
      }

      const recoveryResult = operationStrandedRunRecoveryService?.recoverStrandedRuns
        ? await operationStrandedRunRecoveryService.recoverStrandedRuns({
          operationTypes: supportedOperationTypes,
        })
        : null;

      let claimedCount = 0;

      while (true) {
        const run = await operationQueueStore.claimNextRunnableRun({
          operationTypes: supportedOperationTypes,
        });

        if (!run) {
          break;
        }

        claimedCount += 1;
        launchRun(run);
      }

      return {
        claimedCount,
        failedCount: recoveryResult?.failedCount ?? 0,
        retriedCount: recoveryResult?.retriedCount ?? 0,
        scannedCount: recoveryResult?.scannedCount ?? 0,
        skipped: false,
      };
    },
  });

  return {
    start() {
      runner.start();
    },
    async stop() {
      runner.stop();
    },
    tick() {
      return runner.tick();
    },
  };
}
