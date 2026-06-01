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

import { createImportCandidateExecutionHeartbeatState } from './import-candidate-execution-heartbeat-state.js';
import { createIntervalHeartbeatRunner } from '../heartbeat/interval-heartbeat-runner.js';

const defaultHeartbeatIntervalMs = 60 * 1000;

function hasActionableTransfers(items) {
  return items.some((item) => {
    const liveStatus = item?.liveTransferSummary?.status ?? null;
    return liveStatus === 'queued'
      || liveStatus === 'active'
      || liveStatus === 'completed'
      || liveStatus === 'failed'
      || liveStatus === 'rejected'
      || (liveStatus === 'not_found' && item?.liveTransferSummary?.missingTransfer?.isPastGracePeriod);
  });
}

export function shouldRunImportCandidateExecutionHeartbeat({ executionSummary }) {
  const run = executionSummary?.currentRun ?? null;
  if (!run) {
    return false;
  }

  if (run.executionMode !== 'download_enqueue') {
    return false;
  }

  return hasActionableTransfers(run.items ?? []);
}

export function createImportCandidateExecutionHeartbeat({
  buildImportCandidateExecutionSummary = async () => ({ currentRun: null }),
  clearIntervalFn = clearInterval,
  getNow = () => new Date(),
  heartbeatPauseService = null,
  importCandidateExecutionHeartbeatState = createImportCandidateExecutionHeartbeatState(),
  intervalMs = defaultHeartbeatIntervalMs,
  onError = () => {},
  reconcileImportCandidateExecutionState = async () => ({ summary: { transitioned: 0 } }),
  setIntervalFn = setInterval,
} = {}) {
  async function runTick() {
    const occurredAt = getNow().toISOString();

    try {
      const heartbeatReadiness = await heartbeatPauseService?.resolveHeartbeatReadiness?.({
        operationLabel: 'Import reconciliation',
      }) ?? { allowed: true };

      if (!heartbeatReadiness.allowed) {
        importCandidateExecutionHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          pauseCode: heartbeatReadiness.pauseCode,
          pauseMessage: heartbeatReadiness.pauseMessage,
          pauseProvider: heartbeatReadiness.pauseProvider,
          skipReason: 'paused',
          nextRetryAt: heartbeatReadiness.nextRetryAt,
        });
        return {
          nextRetryAt: heartbeatReadiness.nextRetryAt ?? null,
          provider: heartbeatReadiness.pauseProvider ?? null,
          reason: 'paused',
          skipped: true,
        };
      }

      const executionSummary = await buildImportCandidateExecutionSummary();
      if (!shouldRunImportCandidateExecutionHeartbeat({ executionSummary })) {
        importCandidateExecutionHeartbeatState.recordHeartbeatOutcome({
          occurredAt,
          outcome: 'skipped',
          skipReason: 'not_due',
        });
        return { reason: 'not_due', skipped: true };
      }

      const result = await reconcileImportCandidateExecutionState({
        executionSummary,
      });
      importCandidateExecutionHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'started',
        transitionCount: result?.summary?.transitioned ?? 0,
      });
      return {
        skipped: false,
        transitioned: result?.summary?.transitioned ?? 0,
      };
    } catch (error) {
      importCandidateExecutionHeartbeatState.recordHeartbeatOutcome({
        errorMessage: error?.message ?? 'Import execution heartbeat failed',
        occurredAt,
        outcome: 'error',
        skipReason: 'error',
      });
      onError(error);
      return { reason: 'error', skipped: true };
    }
  }

  return createIntervalHeartbeatRunner({
    clearIntervalFn,
    intervalMs,
    onTick: runTick,
    onTickInProgress: async () => {
      const occurredAt = getNow().toISOString();
      importCandidateExecutionHeartbeatState.recordHeartbeatOutcome({
        occurredAt,
        outcome: 'skipped',
        skipReason: 'tick_in_progress',
      });
      return { reason: 'tick_in_progress', skipped: true };
    },
    setIntervalFn,
  });
}
