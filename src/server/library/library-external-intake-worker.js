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

export function createLibraryExternalIntakeWorker({
    acquireLease,
    createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
    isCancellationRequested,
    markRunPaused,
    markRunCancelled,
    markRunCompleted,
    markRunFailed,
    markRunStarted,
    planExternalMediaRequest,
    queueExternalMediaRequestExecution = null,
    releaseLease,
    renewLease,
  } = {}) {
  const activeRunIds = new Set();

  async function runPlanning({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource = 'request_submit', triggeredByUserId = null }) {
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
          currentStep: 'Planning external provider ingest requests',
          mediaRequestId,
          resourceType,
          sourceIdentifier,
          sourceProvider,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }

      const result = await planExternalMediaRequest({
        mediaRequestId,
        operationRunId: runId,
        triggeredByUserId,
        triggerSource,
      });

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (queueExternalMediaRequestExecution && result.providerIngestRequests.length > 0) {
        await queueExternalMediaRequestExecution({
          canonicalUrl: result.normalizedSource.canonicalUrl,
          mediaRequestId,
          resourceType: result.normalizedSource.resourceType,
          sourceIdentifier: result.normalizedSource.sourceIdentifier,
          sourceProvider: result.normalizedSource.provider,
          triggerSource: 'planning_complete',
          triggeredByUserId,
        });
      }
      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });
      if (await markRunCompleted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          canonicalUrl: result.normalizedSource.canonicalUrl,
          currentStep: 'External provider ingest planning completed',
          mediaRequestId,
          plannedAt: result.plannedAt,
          plannedIngestRequestCount: result.providerIngestRequests.length,
          resourceType: result.normalizedSource.resourceType,
          sourceIdentifier: result.normalizedSource.sourceIdentifier,
          sourceProvider: result.normalizedSource.provider,
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
            currentStep: 'External provider ingest planning paused by maintenance lock',
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
            currentStep: 'External provider ingest planning cancelled',
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

  async function startWorkerRun({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource = 'request_submit', triggeredByUserId = null }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runPlanning({ canonicalUrl, mediaRequestId, resourceType, runId, sourceIdentifier, sourceProvider, triggerSource, triggeredByUserId });
    });
  }

  return {
    startWorkerRun,
  };
}
