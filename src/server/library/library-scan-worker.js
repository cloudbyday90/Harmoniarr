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
import { executeLibraryScan } from './library-scan-executor.js';
import {
  applyLibraryScanReleaseHints,
  countLibraryScanReleaseHints,
} from './library-scan-release-hints.js';
import { createOperationRunLeaseHeartbeat } from '../heartbeat/operation-run-lease-heartbeat.js';
import { createWorkerTaskLifecycle } from '../worker-task-lifecycle.js';
import { withWorkerTaskCleanup } from '../worker-task-cleanup.js';
import { drainWorkerLease } from '../worker-lease-cleanup.js';
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

function toComparableSize(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toComparableTime(value) {
  if (value == null) {
    return null;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function shouldExtractLibraryFileTags(file) {
  if (file?.fileState !== 'observed') {
    return false;
  }

  if (file.tagPayload == null) {
    return true;
  }

  const currentSize = toComparableSize(file.sizeBytes);
  const extractedSize = toComparableSize(file.tagExtractedSizeBytes);
  const currentModifiedAt = toComparableTime(file.modifiedAt);
  const extractedModifiedAt = toComparableTime(file.tagExtractedModifiedAt);

  return currentSize == null
    || extractedSize == null
    || currentModifiedAt == null
    || extractedModifiedAt == null
    || currentSize !== extractedSize
    || currentModifiedAt !== extractedModifiedAt;
}

function buildScanTriggerSummary({ releaseHints, triggeredByRunId, triggerReason }) {
  const releaseHintCount = countLibraryScanReleaseHints(releaseHints);

  return {
    ...(releaseHintCount > 0 ? { releaseHintCount } : {}),
    ...(triggeredByRunId ? { triggeredByRunId } : {}),
    ...(triggerReason ? { triggerReason } : {}),
  };
}

export function createLibraryScanWorker({
  acquireLease,
  captureLibrarySidecarArtwork = null,
  captureLibraryScanReceiptSnapshot = null,
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
  recordLibraryScanCatalogue,
  releaseLease,
  renewLease,
} = {}) {
  if (typeof recordLibraryScanCatalogue !== 'function') {
    throw new TypeError('Library scan requires its guarded catalogue owner');
  }
  const lifecycle = createWorkerTaskLifecycle({ execute: runScan });

  async function runScan({
    libraryRoot,
    releaseHints = [],
    runId,
    triggeredByRunId = null,
    triggerReason = null,
  }) {
    let finalLeaseStatus = 'completed';
    let acquiredLease = null;
    let leaseHeartbeat = null;
    const triggerSummary = buildScanTriggerSummary({ releaseHints, triggeredByRunId, triggerReason });

    return withWorkerTaskCleanup(async () => {
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
            libraryRoot,
            ...triggerSummary,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }

        const phaseTiming = buildPhaseTiming();
        const observedFiles = [];

        const receiptSnapshot = await captureLibraryScanReceiptSnapshot?.({ runId,
          expectedLease: acquiredLease, requestedLibraryRoot: libraryRoot });

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
        let observedCatalogFiles = [];
        let filesToExtract = [];
        phaseTiming.startPhase('catalog');
        catalogResult = await recordLibraryScanCatalogue({
          runId,
          expectedLease: acquiredLease,
          requestedLibraryRoot: libraryRoot,
          files: observedFiles,
          libraryRootPath: summary.libraryRoot,
          ...(receiptSnapshot != null ? { receiptSnapshot } : {}),
        });
        const hintedCatalogFiles = applyLibraryScanReleaseHints({
          files: catalogResult.files ?? [],
          releaseHints,
        });
        catalogResult = {
          ...catalogResult,
          files: hintedCatalogFiles,
        };
        observedCatalogFiles = hintedCatalogFiles
          .filter((file) => file.fileState === 'observed');
        filesToExtract = observedCatalogFiles;
        phaseTiming.finishPhase('catalog');

        if (extractLibraryFileTags && observedCatalogFiles.length) {
          filesToExtract = observedCatalogFiles.filter(shouldExtractLibraryFileTags);
          phaseTiming.startPhase('tag_extraction');
          if (filesToExtract.length > 0) {
            const extractionResult = await extractLibraryFileTags({
              runId,
              expectedLease: acquiredLease,
              requestedLibraryRoot: libraryRoot,
              libraryRootPath: summary.libraryRoot,
              libraryRootId: catalogResult.libraryRootId,
              files: filesToExtract,
            });
            filesToExtract = Array.isArray(extractionResult?.files)
              ? extractionResult.files
              : filesToExtract;
          }
          phaseTiming.finishPhase('tag_extraction');
        }

        if (captureLibrarySidecarArtwork && catalogResult?.files?.length) {
          phaseTiming.startPhase('sidecar_artwork');
          try {
            await captureLibrarySidecarArtwork({
              files: catalogResult.files,
            });
          } catch (sidecarError) {
            if (isOperationRunLeaseLostError(sidecarError)) throw sidecarError;
            // Sidecar artwork capture is best-effort and must not fail the scan.
          }
          phaseTiming.finishPhase('sidecar_artwork');
        }

        if (matchLibraryFiles && observedCatalogFiles.length) {
          phaseTiming.startPhase('file_matching');
          const filesToMatch = extractLibraryFileTags ? filesToExtract : observedCatalogFiles;
          if (filesToMatch.length > 0) {
            await matchLibraryFiles({
              runId,
              expectedLease: acquiredLease,
              requestedLibraryRoot: libraryRoot,
              libraryRootPath: summary.libraryRoot,
              libraryRootId: catalogResult.libraryRootId,
              files: filesToMatch,
            });
          }
          phaseTiming.finishPhase('file_matching');
        }

        if (reconcileLibraryReleases) {
          phaseTiming.startPhase('release_reconciliation');
          await reconcileLibraryReleases({
            runId,
            expectedLease: acquiredLease,
            requestedLibraryRoot: libraryRoot,
            libraryRootPath: summary.libraryRoot,
            libraryRootId: catalogResult.libraryRootId,
          });
          phaseTiming.finishPhase('release_reconciliation');
        }

        if (reconcileWantedReleases) {
          phaseTiming.startPhase('wanted_reconciliation');
          await reconcileWantedReleases({
            workerContext: { operationType: 'library_scan', runId, expectedLease: acquiredLease },
          });
          phaseTiming.finishPhase('wanted_reconciliation');
        }

        if (reconcileDiscoveryRequests) {
          phaseTiming.startPhase('discovery_reconciliation');
          await reconcileDiscoveryRequests();
          phaseTiming.finishPhase('discovery_reconciliation');
        }

        if (await markRunCompleted({
          expectedLease: acquiredLease,
          runId,
          summary: {
            ...summary,
            observedFileCount: catalogResult.observedFileCount,
            ...(catalogResult.missingReceiptCount ? { missingReceiptCount: catalogResult.missingReceiptCount } : {}),
            phases: phaseTiming.toJson(),
            ...triggerSummary,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }
      } catch (error) {
        if (isOperationRunLeaseLostError(error)) { finalLeaseStatus = 'failed'; return; }
        if (!acquiredLease) { finalLeaseStatus = 'failed'; throw error; }
        if (isOperationRunPauseError(error)) {
          finalLeaseStatus = 'paused';
          if (await markRunPaused({
            expectedLease: acquiredLease,
            nextAttemptAt: error.nextRetryAt ?? null,
            runId,
            summary: {
              currentStep: 'Library scan paused by maintenance lock',
              libraryRoot,
              pauseCode: error.pauseCode ?? null,
              pauseMessage: error.message,
              pauseProvider: error.pauseProvider ?? null,
              ...triggerSummary,
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
              currentStep: 'Library scan cancelled',
              libraryRoot,
              ...triggerSummary,
            },
          }) === false) { finalLeaseStatus = 'failed'; return; }
          return;
        }

        finalLeaseStatus = 'failed';
        if (await markRunFailed({
          expectedLease: acquiredLease,
          runId,
          errorMessage: error?.message ?? 'Library scan failed',
          summary: {
            libraryRoot,
            ...triggerSummary,
          },
        }) === false) { finalLeaseStatus = 'failed'; return; }
      }
    }, () => drainWorkerLease({ heartbeat: leaseHeartbeat, lease: acquiredLease, releaseLease,
      runId, status: finalLeaseStatus }));
  }

  async function startWorkerRun({
    libraryRoot,
    releaseHints = [],
    runId,
    triggeredByRunId = null,
    triggerReason = null,
  }) {
    const completion = lifecycle.start({
        libraryRoot,
        releaseHints,
        runId,
        triggeredByRunId,
        triggerReason,
    });
    return { completion };
  }

  return {
    startWorkerRun,
    close: lifecycle.close,
  };
}
