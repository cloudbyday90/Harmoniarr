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

export function createOperatorArtistReconciliationWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  executeOperatorArtistReconciliation = async () => ({
    completedAt: new Date().toISOString(),
  }),
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

  async function runReconciliation({
    appUserId,
    artistName,
    metadataArtistId,
    runId,
    snapshotId,
    snapshotRevision,
    triggerSource = 'save',
  }) {
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
          appUserId,
          artistName,
          currentStep: 'Reconciling operator artist snapshot',
          metadataArtistId,
          snapshotId,
          snapshotRevision,
          triggerSource,
        },
      });

      const result = await executeOperatorArtistReconciliation({
        appUserId,
        metadataArtistId,
        snapshotId,
        snapshotRevision,
        throwIfCancelled: () => throwIfOperationRunCancellationRequested({ isCancellationRequested, runId }),
      });

      await markRunCompleted({
        runId,
        summary: {
          appUserId,
          artistName,
          currentStep: 'Artist reconciliation completed',
          metadataArtistId,
          ...result,
          triggerSource,
        },
      });
    } catch (error) {
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            appUserId,
            artistName,
            currentStep: 'Artist reconciliation paused by maintenance lock',
            metadataArtistId,
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
            snapshotId,
            snapshotRevision,
            triggerSource,
          },
        });
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            appUserId,
            artistName,
            currentStep: 'Artist reconciliation cancelled',
            metadataArtistId,
            snapshotId,
            snapshotRevision,
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
          appUserId,
          artistName,
          metadataArtistId,
          snapshotId,
          snapshotRevision,
          triggerSource,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({
    appUserId,
    artistName,
    metadataArtistId,
    runId,
    snapshotId,
    snapshotRevision,
    triggerSource = 'save',
  }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runReconciliation({
        appUserId,
        artistName,
        metadataArtistId,
        runId,
        snapshotId,
        snapshotRevision,
        triggerSource,
      });
    });
  }

  return {
    startWorkerRun,
  };
}
