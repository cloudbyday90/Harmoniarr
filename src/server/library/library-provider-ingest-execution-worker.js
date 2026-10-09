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

import { isOperationRunLeaseLostError } from '../operation-run-lease-error.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

export function createLibraryProviderIngestExecutionWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  executeProviderIngestRequests,
  isCancellationRequested,
  markRunPaused,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runExecution({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource = 'planning_complete', triggeredByUserId = null }) {
    let finalLeaseStatus = 'completed';
    let acquiredLease = null;
    let leaseHeartbeat = null;

    try {
      acquiredLease = await acquireLease({ runId });
      if (!acquiredLease) return;
      if (renewLease) {
        leaseHeartbeat = createOperationRunLeaseHeartbeatFn({ renewLease, runId, expectedLease: acquiredLease });
        leaseHeartbeat.start();
      }

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (await markRunStarted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          canonicalUrl,
          currentStep: 'Executing provider ingest requests',
          mediaRequestId,
          resourceType,
          sourceIdentifier,
          sourceProvider,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }

      const result = await executeProviderIngestRequests({
        mediaRequestId,
        operationRunId: runId,
        triggerSource,
        triggeredByUserId,
      });

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (await markRunCompleted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          canonicalUrl,
          currentStep: 'Provider ingest execution completed',
          derivedIngestRequestCount: result.derivedIngestRequests?.length ?? 0,
          executedCount: result.executedCount,
          failedCount: result.failedCount,
          mediaRequestId,
          resourceType,
          sourceIdentifier,
          sourceProvider,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }
    } catch (error) {
      if (!acquiredLease || isOperationRunLeaseLostError(error)) { finalLeaseStatus = 'failed'; return; }
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        if (await markRunPaused({
          expectedLease: acquiredLease,
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            canonicalUrl,
            currentStep: 'Provider ingest execution paused by maintenance lock',
            mediaRequestId,
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            resourceType,
            sourceIdentifier,
            sourceProvider,
            triggerSource,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        if (await markRunCancelled({
          expectedLease: acquiredLease,
          runId,
          summary: {
            canonicalUrl,
            currentStep: 'Provider ingest execution cancelled',
            mediaRequestId,
            resourceType,
            sourceIdentifier,
            sourceProvider,
            triggerSource,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }
        return;
      }

      finalLeaseStatus = 'failed';
      if (await markRunFailed({
        expectedLease: acquiredLease,
        errorMessage: error.message,
        runId,
        summary: {
          canonicalUrl,
          currentStep: 'Provider ingest execution failed',
          mediaRequestId,
          resourceType,
          sourceIdentifier,
          sourceProvider,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (acquiredLease) await releaseLease({ runId, status: finalLeaseStatus, expectedLease: acquiredLease });
    }
  }

  async function startWorkerRun({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource = 'planning_complete', triggeredByUserId = null }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runExecution({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource, triggeredByUserId });
    });
  }

  return {
    startWorkerRun,
  };
}
