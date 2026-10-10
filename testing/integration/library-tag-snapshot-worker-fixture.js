/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { parseFile } from 'music-metadata';
import { createOperationRunCancellationError } from '../../src/server/operation-run-cancellation.js';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';
import { startLibraryScanFixtureWorker } from './library-scan-worker-fixture.js';

/** Hook failures are fixture failures, rather than native media parser failures. */
export async function startLibraryTagSnapshotFixtureWorker(context, runs, hooks = {}, {
  scope = context.scope, parseFileFn = parseFile, createWorkerFn,
} = {}) {
  if (typeof scope?.track !== 'function' || typeof scope.signal?.aborted !== 'boolean'
    || typeof parseFileFn !== 'function') throw new TypeError('Tag worker fixture requires its work scope and parser');
  const artwork = []; const downstream = []; let capturedLease;
  let hookFailed = false; let hookFailure;
  const refuseCancelledWrite = () => {
    if (scope.signal.aborted) throw createOperationRunCancellationError({
      runId: context.run.id, message: 'The controlled tag fixture was cancelled before writing',
    });
  };
  const extraction = createLibraryTagExtractionService({
    extractMetadata: async (filePath) => {
      const metadata = await parseFileFn(filePath);
      try { await hooks.afterParse?.(filePath, metadata); }
      catch (error) { hookFailed = true; hookFailure = error; throw error; }
      return metadata;
    },
    writeOwnedLibraryFileTagSnapshot: async (input) => {
      // This boundary is outside extraction's genuine-parser fallback catch.
      // No assertion or cancelled controlled hold may become a failed snapshot.
      refuseCancelledWrite();
      if (hookFailed) throw hookFailure instanceof Error ? hookFailure : new Error('Controlled tag fixture hook failed');
      return (hooks.owner ?? context.tagOwner).writeOwnedLibraryFileTagSnapshot(input);
    },
    libraryEmbeddedArtworkService: { captureEmbeddedArtwork: async (input) => {
      refuseCancelledWrite(); artwork.push(input);
    } },
  });
  const callbacks = { ...runs,
    acquireLease: async (input) => { capturedLease = await runs.acquireLease(input); return capturedLease; },
    recordLibraryScanCatalogue: context.scanCatalogue.recordLibraryScanCatalogue,
    extractLibraryFileTags: extraction.extractLibraryFileTags,
    captureLibrarySidecarArtwork: async () => { downstream.push('sidecar'); },
    matchLibraryFiles: async () => { downstream.push('matching'); },
    reconcileLibraryReleases: async () => { downstream.push('releases'); },
    reconcileWantedReleases: async () => { downstream.push('wanted'); },
    reconcileDiscoveryRequests: async () => { downstream.push('discovery'); },
    releaseLease: async (input) => {
      let result;
      try { result = await runs.releaseLease(input); }
      catch (error) {
        if (hookFailed) throw hookFailure;
        if (scope.signal.aborted) throw scope.signal.reason;
        throw error;
      }
      if (hookFailed) throw hookFailure;
      if (scope.signal.aborted) throw scope.signal.reason;
      return result;
    },
  };
  const job = await startLibraryScanFixtureWorker({ callbacks,
    run: { runId: context.run.id, libraryRoot: context.requestedRoot },
    signal: scope.signal, track: (promise) => scope.track(promise),
    ...(createWorkerFn ? { createWorkerFn } : {}),
  });
  return { ...job, artwork, downstream, lease: () => capturedLease };
}
