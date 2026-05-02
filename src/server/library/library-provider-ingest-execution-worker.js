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
import { isOperationRunCancellationError, throwIfOperationRunCancellationRequested } from '../operation-run-cancellation.js';

export function createLibraryProviderIngestExecutionWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  executeProviderIngestRequests,
  isCancellationRequested,
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
    let leaseHeartbeat = null;

    try {
      await acquireLease({ runId });
      if (renewLease) {
        leaseHeartbeat = createOperationRunLeaseHeartbeatFn({ renewLease, runId });
        leaseHeartbeat.start();
      }

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      await markRunStarted({
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
      });

      const result = await executeProviderIngestRequests({
        mediaRequestId,
        operationRunId: runId,
        triggerSource,
        triggeredByUserId,
      });

      await markRunCompleted({
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
      });
    } catch (error) {
      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
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
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({
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
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
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
