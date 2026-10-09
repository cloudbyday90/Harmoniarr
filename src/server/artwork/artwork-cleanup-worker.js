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
import { createArtworkCleanupService } from './artwork-cleanup-service.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

export function createArtworkCleanupWorker({
  acquireLease,
  artworkCleanupService = createArtworkCleanupService(),
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunCompleted,
  markRunCancelled,
  markRunFailed,
  markRunPaused,
  markRunStarted,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runCleanup({ requestedAssetCount, retentionCutoff, runId }) {
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
          requestedAssetCount,
          retentionCutoff,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }

      const summary = await artworkCleanupService.cleanupUnassignedArtwork({
        ...(isCancellationRequested ? { isCancellationRequested, runId } : {}),
        limit: requestedAssetCount,
      });

      if (await markRunCompleted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          requestedAssetCount,
          retentionCutoff,
          ...summary,
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
            currentStep: 'Artwork cleanup paused by maintenance lock',
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            requestedAssetCount,
            retentionCutoff,
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
            currentStep: 'Artwork cleanup cancelled',
            requestedAssetCount,
            retentionCutoff,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }
        return;
      }

      finalLeaseStatus = 'failed';
      if (await markRunFailed({
        expectedLease: acquiredLease,
        runId,
        errorMessage: error.message,
        summary: {
          requestedAssetCount,
          retentionCutoff,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (acquiredLease) await releaseLease({ runId, status: finalLeaseStatus, expectedLease: acquiredLease });
    }
  }

  async function startWorkerRun({ requestedAssetCount, retentionCutoff, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runCleanup({ requestedAssetCount, retentionCutoff, runId });
    });
  }

  return {
    startWorkerRun,
  };
}