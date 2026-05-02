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

export function createMetadataArtistRefreshWorker({
  acquireLease,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  isCancellationRequested,
  markRunCancelled,
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  recordArtistRefreshCompleted = async () => null,
  refreshMetadataArtist,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runRefresh({ artistName, metadataArtistId, musicBrainzArtistId, runId, triggerSource = 'manual' }) {
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
          artistName,
          currentStep: 'Refreshing artist metadata',
          metadataArtistId,
          musicBrainzArtistId,
          triggerSource,
        },
      });

      const result = await refreshMetadataArtist({
        metadataArtistId,
        musicBrainzArtistId,
        runId,
        throwIfCancelled: () => throwIfOperationRunCancellationRequested({ isCancellationRequested, runId }),
        triggerSource,
      });
      const refreshSchedule = await recordArtistRefreshCompleted({
        metadataArtistId,
        refreshedAt: result.refreshedAt,
      });

      await markRunCompleted({
        runId,
        summary: {
          artistName,
          currentStep: 'Metadata artist refresh completed',
          metadataArtistId,
          musicBrainzArtistId,
          nextRefreshAt: refreshSchedule?.nextRefreshAt ?? null,
          detectedReleaseGroupCount: result.detectedReleaseGroupCount ?? 0,
          refreshedAt: result.refreshedAt,
          releaseGroupCount: result.releaseGroupCount,
          triggerSource,
          wantedReconciliationCompleted: result.wantedReconciliationCompleted,
        },
      });
    } catch (error) {
      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            artistName,
            currentStep: 'Metadata artist refresh cancelled',
            metadataArtistId,
            musicBrainzArtistId,
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
          artistName,
          metadataArtistId,
          musicBrainzArtistId,
          triggerSource,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
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