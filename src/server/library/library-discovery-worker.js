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

export function createLibraryDiscoveryWorker({
  acquireLease,
  dispatchDiscoveryRequests = async () => ({
    attemptedCount: 0,
    candidateCount: 0,
    dispatchedCount: 0,
    failedCount: 0,
    fileCount: 0,
  }),
  markRunCompleted,
  markRunFailed,
  markRunStarted,
  reconcileDiscoveryRequests = null,
  reconcileWantedReleases = null,
  releaseLease,
} = {}) {
  const activeRunIds = new Set();

  async function runDispatch({
    requestMetadata = null,
    runId,
    triggerSource = 'manual',
    triggeredByUserId = null,
  }) {
    let finalLeaseStatus = 'completed';

    try {
      await acquireLease({ runId });
      await markRunStarted({
        runId,
        summary: {
          triggerSource,
        },
      });

      if (reconcileWantedReleases) {
        await reconcileWantedReleases();
      }

      if (reconcileDiscoveryRequests) {
        await reconcileDiscoveryRequests();
      }

      const summary = await dispatchDiscoveryRequests({
        actorUserId: triggeredByUserId,
        requestMetadata,
      });

      await markRunCompleted({
        runId,
        summary: {
          ...summary,
          triggerSource,
        },
      });
    } catch (error) {
      finalLeaseStatus = 'failed';
      await markRunFailed({
        errorMessage: error.message,
        runId,
        summary: {
          triggerSource,
        },
      });
    } finally {
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
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