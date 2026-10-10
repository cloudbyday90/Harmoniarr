/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { executeLibraryScan } from '../../src/server/library/library-scan-executor.js';
import { createOperationRunCancellationError } from '../../src/server/operation-run-cancellation.js';
import { startLibraryScanFixtureWorker } from './library-scan-worker-fixture.js';

export async function startLibraryScanCatalogueFixtureWorker({ scope, runs, runId, requestedRoot, recordLibraryScanCatalogue,
  afterWalk, executeScanFn = executeLibraryScan, createWorkerFn } = {}) {
  const downstream = []; let capturedLease; let hookFailed = false; let hookFailure;
  const rememberHookFailure = (error) => { if (!hookFailed) { hookFailed = true; hookFailure = error; } };
  const callbacks = { ...runs,
    acquireLease: async (input) => { capturedLease = await runs.acquireLease(input); return capturedLease; },
    executeScan: async (input) => {
      const result = await executeScanFn(input);
      try { await afterWalk?.(result); }
      catch (error) {
        rememberHookFailure(error);
        // The native worker records Error objects; preserve the fixture's original reason separately.
        throw error instanceof Error ? error : new Error('The controlled catalogue walk hook failed');
      }
      return result;
    },
    recordLibraryScanCatalogue: async (input) => {
      if (scope.signal.aborted) throw createOperationRunCancellationError({ runId });
      try { return await recordLibraryScanCatalogue(input); }
      catch (error) {
        // Ordinary SQL/service Errors are native job outcomes; null fixture cancellation cannot enter error.message.
        if (error instanceof Error) throw error;
        rememberHookFailure(error);
        throw scope.signal.aborted ? createOperationRunCancellationError({ runId })
          : new Error('The controlled catalogue owner callback failed');
      }
    },
    extractLibraryFileTags: async ({ files }) => { downstream.push('tags'); return { files }; },
    captureLibrarySidecarArtwork: async () => { downstream.push('artwork'); },
    matchLibraryFiles: async () => { downstream.push('matching'); },
    reconcileLibraryReleases: async () => { downstream.push('releases'); },
    reconcileWantedReleases: async () => { downstream.push('wanted'); },
    reconcileDiscoveryRequests: async () => { downstream.push('discovery'); },
    releaseLease: async (input) => {
      let result; let releaseFailed = false; let releaseFailure;
      try { result = await runs.releaseLease(input); }
      catch (error) { releaseFailed = true; releaseFailure = error; }
      if (hookFailed) throw hookFailure;
      if (releaseFailed) throw releaseFailure;
      return result;
    },
  };
  const worker = await startLibraryScanFixtureWorker({ callbacks, run: { runId, libraryRoot: requestedRoot },
    signal: scope?.signal, track: (operation) => scope.track(operation), createWorkerFn });
  return { ...worker, downstream, lease: () => capturedLease };
}
