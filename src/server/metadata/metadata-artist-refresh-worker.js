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

export function createMetadataArtistRefreshWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunPaused,
  markRunStarted,
  recordArtistRefreshCompleted = async () => null,
  refreshMetadataArtist,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runRefresh({ artistName, metadataArtistId, musicBrainzArtistId, runId, triggerSource = 'manual' }) {
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
          artistName,
          currentStep: 'Refreshing artist metadata',
          metadataArtistId,
          musicBrainzArtistId,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }

      const result = await refreshMetadataArtist({
        metadataArtistId,
        musicBrainzArtistId,
        runId,
        workerContext: { operationType: 'metadata_artist_refresh', runId, expectedLease: acquiredLease },
        throwIfCancelled: () => throwIfOperationRunCancellationRequested({ isCancellationRequested, runId }),
        triggerSource,
      });
      const refreshSchedule = await recordArtistRefreshCompleted({
        metadataArtistId,
        refreshedAt: result.refreshedAt,
      });

      if (await markRunCompleted({
        expectedLease: acquiredLease,
        runId,
        summary: {
          artistName,
          currentStep: 'Metadata artist refresh completed',
          metadataArtistId,
          musicBrainzArtistId,
          nextRefreshAt: refreshSchedule?.nextRefreshAt ?? null,
          detectedReleaseGroupCount: result.detectedReleaseGroupCount ?? 0,
          materializedEligibleReleaseGroupCount: result.materializedEligibleReleaseGroupCount ?? 0,
          materializedImportedReleaseCount: result.materializedImportedReleaseCount ?? 0,
          materializedSkippedExistingCanonicalCount: result.materializedSkippedExistingCanonicalCount ?? 0,
          materializedSkippedExistingReleaseCount: result.materializedSkippedExistingReleaseCount ?? 0,
          materializedSkippedNoCandidateCount: result.materializedSkippedNoCandidateCount ?? 0,
          operatorReconciliationQueuedCount: result.operatorReconciliationQueuedCount ?? 0,
          operatorReconciliationSkippedNotReadyCount: result.operatorReconciliationSkippedNotReadyCount ?? 0,
          refreshedAt: result.refreshedAt,
          releaseGroupCount: result.releaseGroupCount,
          triggerSource,
          wantedReconciliationCompleted: result.wantedReconciliationCompleted,
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
            artistName,
            currentStep: 'Metadata artist refresh paused by maintenance lock',
            metadataArtistId,
            musicBrainzArtistId,
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
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
            artistName,
            currentStep: 'Metadata artist refresh cancelled',
            metadataArtistId,
            musicBrainzArtistId,
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
          artistName,
          metadataArtistId,
          musicBrainzArtistId,
          triggerSource,
        },
      }) === false) { finalLeaseStatus = 'failed'; return; }
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      if (acquiredLease) await releaseLease({ runId, status: finalLeaseStatus, expectedLease: acquiredLease });
    }
  }

  async function startWorkerRun({ artistName, metadataArtistId, musicBrainzArtistId, runId, triggerSource = 'manual' }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runRefresh({ artistName, metadataArtistId, musicBrainzArtistId, runId, triggerSource });
    });
  }

  return {
    startWorkerRun,
  };
}
