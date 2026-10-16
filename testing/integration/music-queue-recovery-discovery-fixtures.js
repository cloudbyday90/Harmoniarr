/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMusicQueueRecoveryService } from '../../src/server/import-candidates/music-queue-recovery-service.js';
import { MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createLibraryMusicQueueRecoveryDiscoveryService } from '../../src/server/library/library-music-queue-recovery-discovery-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createMusicQueueRecoveryFixtureContext } from './music-queue-recovery-fixtures.js';
import { withFixtureLifecycle } from './fixture-lifecycle.js';
import { startLibraryDiscoveryFixtureWorker } from './library-discovery-worker-fixture.js';

export function createMusicQueueRecoveryDiscoveryFixtureContext({ getPoolFn }) {
  const context = createMusicQueueRecoveryFixtureContext({ getPoolFn });
  context.service = createMusicQueueRecoveryService({ store: context.store, withTransaction: context.withTransaction,
    assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed, createExecutionRun: context.executionRuns.createOperationRun,
    createDiscoveryRun: context.discoveryRuns.createOperationRun, rediscoveryDelayMs: 0, getNow: () => new Date(Date.now() - 50) });
  context.requestStore = createLibraryDiscoveryRequestStore({ getPoolFn, withTransaction: context.withTransaction, recoveryStore: context.store });
  context.scoped = createLibraryMusicQueueRecoveryDiscoveryService({ store: context.store, withTransaction: context.withTransaction,
    assertMaintenanceWriteAllowed: context.assertMaintenanceWriteAllowed });
  return context;
}

export async function runMusicQueueRecoveryDiscoveryWorker(context, fixture, { prepare = async () => null, provider = async () => ({ id: randomUUID() }),
  signal = context.fixtureSignal, ingest = async () => ({ candidateCount: 0, fileCount: 0 }),
  releaseLease = context.discoveryRuns.releaseLease, pruneOldRuns = async () => {} } = {}) {
  return withFixtureLifecycle({ signal }, async (scope) => {
    const searches = []; const ingestions = []; const globalCalls = [];
    const dispatch = createLibraryDiscoveryDispatchService({ loadSettingsFn: async () => ({ library: { discoveryBatchSize: 5 } }),
      libraryDiscoveryRequestStore: context.requestStore, musicQueueRecoveryDiscoveryService: context.scoped,
      getReleaseTracklistExpectationsFn: prepare,
      slskdService: { startSearch: async (input) => { searches.push(input); return provider(input); } },
      importCandidateService: { ingestSlskdSearchResponses: async (input) => { ingestions.push(input); return ingest(input); } },
    });
    let terminalOutcome;
    const runs = context.discoveryRuns;
    const callbacks = { acquireLease: runs.acquireLease,
      releaseLease, pruneOldRuns,
      isCancellationRequested: runs.isCancellationRequested, markRunStarted: runs.markRunStarted,
      markRunCompleted: async (input) => { const result = await runs.markRunCompleted(input);
        if (result !== false) terminalOutcome = { state: 'completed', summary: input.summary }; return result; },
      markRunFailed: async (input) => { const result = await runs.markRunFailed(input);
        if (result !== false) terminalOutcome = { state: 'failed', error: input.errorMessage }; return result; },
      markRunCancelled: async (input) => { const result = await runs.markRunCancelled(input);
        if (result !== false) terminalOutcome = { state: 'cancelled' }; return result; },
      markRunPaused: async (input) => { const result = await runs.markRunPaused(input);
        if (result !== false) terminalOutcome = { state: 'paused' }; return result; },
      dispatchDiscoveryRequests: dispatch.dispatchReadyDiscoveryRequests,
      reconcileWantedReleases: async () => globalCalls.push('wanted'), reconcileDiscoveryRequests: async () => globalCalls.push('discovery'),
      prefetchMonitoredArtistArtwork: async () => globalCalls.push('artwork'),
    };
    const worker = await startLibraryDiscoveryFixtureWorker({ callbacks, signal: scope.signal, track: scope.track,
      run: { runId: fixture.runId, triggerSource: MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } });
    await worker.done;
    assert.deepEqual(globalCalls, []);
    return { outcome: terminalOutcome, searches, ingestions, dispatch };
  });
}
