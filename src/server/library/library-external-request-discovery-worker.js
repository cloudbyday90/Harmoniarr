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

import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

export function createLibraryExternalRequestDiscoveryWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  discoverExternalRequestRelease,
  isCancellationRequested,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunPaused,
  markRunStarted,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runDiscovery({ intentId, mediaRequestId, runId, triggerSource = 'operator_review', triggeredByUserId = null }) {
    let finalLeaseStatus = 'completed';
    let leaseAcquired = false;
    let heartbeat = null;
    const summary = { intentId, mediaRequestId, triggerSource };
    try {
      await acquireLease({ runId });
      leaseAcquired = true;
      if (renewLease) {
        heartbeat = createOperationRunLeaseHeartbeatFn({ renewLease, runId });
        heartbeat.start();
      }
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      await markRunStarted({ runId, summary: { ...summary, currentStep: 'Searching for the approved release' } });
      const result = await discoverExternalRequestRelease({ intentId, mediaRequestId, operationRunId: runId, triggeredByUserId });
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (result.candidateCount === 0) {
        finalLeaseStatus = 'failed';
        await markRunFailed({
          errorMessage: 'No candidates were found. Review the approved release and retry this background job when ready.',
          runId,
          summary: {
            ...summary,
            ...result,
            currentStep: 'No candidates found; review and retry discovery',
            failureCode: 'external_request_discovery_no_candidates',
          },
        });
        return;
      }
      await markRunCompleted({
        runId,
        summary: {
          ...summary,
          ...result,
          currentStep: 'Candidates ready for import review',
        },
      });
    } catch (error) {
      if (error?.code === 'operation_run_lease_unavailable') return;
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            ...summary,
            currentStep: 'External request discovery paused',
            pauseCode: error.pauseCode ?? null,
            pauseProvider: error.pauseProvider ?? null,
          },
        });
      } else if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({ runId, summary: { ...summary, currentStep: 'External request discovery cancelled' } });
      } else {
        finalLeaseStatus = 'failed';
        await markRunFailed({
          errorMessage: 'External request discovery failed. Review provider health and retry the background job.',
          runId,
          summary: { ...summary, currentStep: 'External request discovery failed' },
        });
      }
    } finally {
      heartbeat?.stop();
      activeRunIds.delete(runId);
      if (leaseAcquired) await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun(args) {
    if (activeRunIds.has(args.runId)) return;
    activeRunIds.add(args.runId);
    queueMicrotask(() => { void runDiscovery(args); });
  }

  return { startWorkerRun };
}
