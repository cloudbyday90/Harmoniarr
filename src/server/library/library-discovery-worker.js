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
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../import-candidates/music-queue-recovery-policy.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

function buildDispatchBreakdown(summary) {
  if (!summary) {
    return { outcome: 'empty' };
  }

  const { attemptedCount = 0, dispatchedCount = 0, failedCount = 0 } = summary;

  if (attemptedCount === 0) {
    return { outcome: 'empty' };
  }

  if (failedCount === 0) {
    return { outcome: 'completed' };
  }

  if (dispatchedCount === 0) {
    return { outcome: 'failed' };
  }

  return { outcome: 'partial' };
}

export function createLibraryDiscoveryWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  dispatchDiscoveryRequests = async () => ({
    attemptedCount: 0,
    candidateCount: 0,
    dispatchedCount: 0,
    failedCount: 0,
    fileCount: 0,
  }),
  markRunCompleted,
  markRunCancelled,
  markRunFailed,
  markRunPaused,
  markRunStarted,
  isCancellationRequested,
  prefetchMonitoredArtistArtwork = null,
  pruneOldRuns = async () => {},
  reconcileDiscoveryRequests = null,
  reconcileWantedReleases = null,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runDispatch({
    requestMetadata = null,
    runId,
    triggerSource = 'manual',
    triggeredByUserId = null,
  }) {
    let finalLeaseStatus = 'completed';
    let acquiredLease = null;
    let leaseLost = false;
    let leaseHeartbeat = null;
    const scopedRecovery = triggerSource === MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE;

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
          triggerSource,
        },
      }) === false) { leaseLost = true; finalLeaseStatus = 'failed'; return; }

      if (!scopedRecovery && reconcileWantedReleases) {
        await reconcileWantedReleases({
          workerContext: { operationType: 'library_discovery_dispatch', runId, expectedLease: acquiredLease },
        });
      }

      if (!scopedRecovery && reconcileDiscoveryRequests) {
        await reconcileDiscoveryRequests();
      }

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

      let monitoredArtistArtwork = null;
      if (!scopedRecovery && prefetchMonitoredArtistArtwork) {
        try {
          monitoredArtistArtwork = await prefetchMonitoredArtistArtwork();
        } catch (error) {
          if (isOperationRunLeaseLostError(error)) throw error;
          monitoredArtistArtwork = {
            errorMessage: error.message,
            status: 'failed',
          };
        }
      }

      await throwIfOperationRunCancellationRequested({ isCancellationRequested, runId });

      const summary = await dispatchDiscoveryRequests({
        actorUserId: triggeredByUserId,
        requestMetadata,
        ...(scopedRecovery ? { runId, triggerSource } : {}),
      });

      const dispatchBreakdown = buildDispatchBreakdown(summary);

      if (await markRunCompleted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          ...(monitoredArtistArtwork ? { monitoredArtistArtwork } : {}),
          ...summary,
          ...dispatchBreakdown,
          triggerSource,
        },
      }) === false) { leaseLost = true; finalLeaseStatus = 'failed'; return; }
    } catch (error) {
      if (!acquiredLease || isOperationRunLeaseLostError(error)) { leaseLost = true; finalLeaseStatus = 'failed'; return; }
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        if (await markRunPaused?.({
          expectedLease: acquiredLease,
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Library discovery paused by maintenance lock',
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            triggerSource,
          },
        }) === false) { leaseLost = true; finalLeaseStatus = 'failed'; return; }
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        if (await markRunCancelled({
          expectedLease: acquiredLease,
          runId,
          summary: {
            currentStep: 'Library discovery cancelled',
            triggerSource,
          },
        }) === false) { leaseLost = true; finalLeaseStatus = 'failed'; return; }
        return;
      }

      finalLeaseStatus = 'failed';
      if (await markRunFailed({
        expectedLease: acquiredLease,
        errorMessage: error.message,
        runId,
        summary: {
          triggerSource,
        },
      }) === false) { leaseLost = true; finalLeaseStatus = 'failed'; return; }
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (acquiredLease) await releaseLease({ runId, status: finalLeaseStatus, expectedLease: acquiredLease });
      if (acquiredLease && !leaseLost) await pruneOldRuns();
    }
  }

  async function startWorkerRun({
    requestMetadata = null,
    runId,
    triggerSource = 'manual',
    triggeredByUserId = null,
  }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runDispatch({ requestMetadata, runId, triggerSource, triggeredByUserId });
    });
  }

  return {
    startWorkerRun,
  };
}
