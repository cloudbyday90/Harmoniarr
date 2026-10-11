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
import { createOperationDispatcherLifetime } from './operation-dispatcher-lifetime.js';

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
  recoverFailedOperatorArtistReconciliations = null,
} = {}) {
  const supportedOperationTypes = Object.keys(handlers).filter(Boolean);
  const resolvedDispatchIntervalMs = normalizeDispatchIntervalMs(intervalMs);
  const lifetime = createOperationDispatcherLifetime({
    executeTick: async () => {
      try { return await dispatchTick(); }
      catch (error) { await reportFailure(error, { phase: 'operation_queue_tick' }); throw error; }
    },
    executeRun: async run => {
      const handler = handlers[run.operationType];
      if (!handler) return;
      try {
        const accepted = await handler({ run });
        const completion = accepted?.completion;
        if (completion !== undefined) {
          if (completion === null || typeof completion.then !== 'function') throw new TypeError('Worker completion must be a promise');
          await completion;
        }
      } catch (error) { await reportFailure(error, { run }); throw error; }
    },
    stopTimer: () => runner.stop(),
  });

  async function reportFailure(error, context) {
    try { await onError(error, context); } catch { /* Retain the original owned failure. */ }
  }

  function launchRun(run) {
    const handler = handlers[run.operationType];

    if (!handler) {
      return;
    }

    return lifetime.launch(run);
  }

  async function dispatchTick() {
    if (lifetime.isClosing()) return { reason: 'stopped', skipped: true };
    const dispatchReadiness = dispatchPauseService?.resolveDispatchReadiness
      ? await dispatchPauseService.resolveDispatchReadiness({
        operationTypes: supportedOperationTypes,
      })
      : { allowed: true };
    if (lifetime.isClosing()) return { reason: 'stopped', skipped: true };

    if (dispatchReadiness && dispatchReadiness.allowed === false) {
      return {
        cancelledCount: 0,
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
    if (lifetime.isClosing()) return { reason: 'stopped', skipped: true };

    if (recoverFailedOperatorArtistReconciliations) {
      try {
        await recoverFailedOperatorArtistReconciliations({ operationTypes: supportedOperationTypes });
      } catch (error) {
        // Recovery failure must be reported without blocking unrelated queued work.
        await onError(error, { phase: 'artist_reconciliation_recovery' });
      }
    }

    let claimedCount = 0;

    while (!lifetime.isClosing()) {
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
      cancelledCount: recoveryResult?.cancelledCount ?? 0,
      claimedCount,
      failedCount: recoveryResult?.failedCount ?? 0,
      retriedCount: recoveryResult?.retriedCount ?? 0,
      scannedCount: recoveryResult?.scannedCount ?? 0,
      skipped: false,
    };
  }

  const runner = createIntervalHeartbeatRunnerFn({
    intervalMs: resolvedDispatchIntervalMs,
    onTick: () => lifetime.tick().catch(() => ({ reason: 'error', skipped: true })),
  });

  return {
    start() {
      if (lifetime.isClosing()) throw Object.assign(new Error('Dispatcher admission is closed'), { code: 'dispatcher_closing' });
      runner.start();
    },
    async stop() {
      runner.stop();
    },
    tick() {
      return lifetime.tick();
    },
    stopAndDrain: lifetime.stopAndDrain,
  };
}
