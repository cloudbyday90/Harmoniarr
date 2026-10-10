/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { startLibraryScanFixtureWorker } from './library-scan-worker-fixture.js';

export async function startReleaseReconciliationFixtureWorker({ scope, runs, runId, libraryRoot, observation,
  recordLibraryScanCatalogue, reconcileLibraryReleases, createWorkerFn } = {}) {
  const later = []; let lease;
  const callbacks = { ...runs,
    acquireLease: async (input) => { lease = await runs.acquireLease(input); return lease; },
    executeScan: async ({ onFile }) => { await onFile(observation(libraryRoot));
      return { libraryRoot, filesSeen: 1, filesMatched: 1, filesUnmatched: 0 }; },
    recordLibraryScanCatalogue, reconcileLibraryReleases,
    reconcileWantedReleases: async () => { later.push('wanted'); },
    reconcileDiscoveryRequests: async () => { later.push('discovery'); },
  };
  const worker = await startLibraryScanFixtureWorker({ callbacks, run: { runId, libraryRoot },
    signal: scope?.signal, track: (operation) => scope.track(operation), createWorkerFn });
  return { ...worker, later, lease: () => lease };
}
