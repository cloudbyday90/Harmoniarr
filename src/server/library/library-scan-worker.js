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

import { executeLibraryScan } from './library-scan-executor.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import {
  isOperationRunCancellationError,
  isOperationRunPauseError,
  throwIfOperationRunCancellationRequested,
} from '../operation-run-cancellation.js';

function buildPhaseTiming() {
  const phases = [];

  return {
    finishPhase(name) {
      phases.push({
        finishedAt: new Date().toISOString(),
        name,
      });
    },
    startPhase(name) {
      phases.push({
        name,
        startedAt: new Date().toISOString(),
      });
    },
    toJson() {
      return phases.map((phase) => ({ ...phase }));
    },
  };
}

export function createLibraryScanWorker({
  acquireLease,
  captureLibrarySidecarArtwork = null,
  createOperationRunLeaseHeartbeatFn = createOperationRunLeaseHeartbeat,
  executeScan = executeLibraryScan,
  extractLibraryFileTags = null,
  matchLibraryFiles = null,
  markRunCompleted,
  markRunPaused,
  markRunCancelled,
  markRunFailed,
  markRunStarted,
  isCancellationRequested,
  reconcileDiscoveryRequests = null,
  reconcileLibraryReleases = null,
  reconcileWantedReleases = null,
  recordLibraryFiles = null,
  releaseLease,
  renewLease,
} = {}) {
  const activeRunIds = new Set();

  async function runScan({ libraryRoot, runId }) {
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
          libraryRoot,
        },
      });

      const phaseTiming = buildPhaseTiming();
      const observedFiles = [];

      phaseTiming.startPhase('filesystem_walk');
      const summary = await executeScan({
        isCancellationRequested,
        libraryRoot,
        onFile: async (file) => {
          observedFiles.push(file);
        },
        runId,
      });
      phaseTiming.finishPhase('filesystem_walk');

      let catalogResult = null;
      if (recordLibraryFiles) {
        phaseTiming.startPhase('catalog');
        catalogResult = await recordLibraryFiles({
          files: observedFiles,
          libraryRootPath: summary.libraryRoot,
        });
        phaseTiming.finishPhase('catalog');
      }

      if (extractLibraryFileTags && catalogResult?.files?.length) {
        phaseTiming.startPhase('tag_extraction');
        await extractLibraryFileTags({
          files: catalogResult.files.filter((file) => file.fileState === 'observed'),
        });
        phaseTiming.finishPhase('tag_extraction');
      }

      if (captureLibrarySidecarArtwork && catalogResult?.files?.length) {
        phaseTiming.startPhase('sidecar_artwork');
        try {
          await captureLibrarySidecarArtwork({
            files: catalogResult.files,
          });
        } catch {
          // Sidecar artwork capture is best-effort and must not fail the scan.
        }
        phaseTiming.finishPhase('sidecar_artwork');
      }

      if (matchLibraryFiles && catalogResult?.files?.length) {
        phaseTiming.startPhase('file_matching');
        await matchLibraryFiles({
          files: catalogResult.files.filter((file) => file.fileState === 'observed'),
        });
        phaseTiming.finishPhase('file_matching');
      }

      if (reconcileLibraryReleases) {
        phaseTiming.startPhase('release_reconciliation');
        await reconcileLibraryReleases();
        phaseTiming.finishPhase('release_reconciliation');
      }

      if (reconcileWantedReleases) {
        phaseTiming.startPhase('wanted_reconciliation');
        await reconcileWantedReleases();
        phaseTiming.finishPhase('wanted_reconciliation');
      }

      if (reconcileDiscoveryRequests) {
        phaseTiming.startPhase('discovery_reconciliation');
        await reconcileDiscoveryRequests();
        phaseTiming.finishPhase('discovery_reconciliation');
      }

      await markRunCompleted({
        runId,
        summary: {
          ...summary,
          observedFileCount: observedFiles.length,
          phases: phaseTiming.toJson(),
        },
      });
    } catch (error) {
      if (isOperationRunPauseError(error)) {
        finalLeaseStatus = 'paused';
        await markRunPaused({
          nextAttemptAt: error.nextRetryAt ?? null,
          runId,
          summary: {
            currentStep: 'Library scan paused by maintenance lock',
            libraryRoot,
            pauseCode: error.pauseCode ?? null,
            pauseMessage: error.message,
            pauseProvider: error.pauseProvider ?? null,
          },
        });
        return;
      }

      if (isOperationRunCancellationError(error)) {
        finalLeaseStatus = 'cancelled';
        await markRunCancelled({
          runId,
          summary: {
            currentStep: 'Library scan cancelled',
            libraryRoot,
          },
        });
        return;
      }

      finalLeaseStatus = 'failed';
      await markRunFailed({
        runId,
        errorMessage: error.message,
        summary: {
          libraryRoot,
        },
      });
    } finally {
      leaseHeartbeat?.stop();
      activeRunIds.delete(runId);
      await releaseLease({ runId, status: finalLeaseStatus });
    }
  }

  async function startWorkerRun({ libraryRoot, runId }) {
    if (activeRunIds.has(runId)) {
      return;
    }

    activeRunIds.add(runId);
    queueMicrotask(() => {
      void runScan({ libraryRoot, runId });
    });
  }

  return {
    startWorkerRun,
  };
}