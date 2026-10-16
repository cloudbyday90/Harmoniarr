/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';
import { withIntegrationApp } from './app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { withFixtureLifecycle } from './fixture-lifecycle.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { exerciseWantedRootProfile } from './wanted-root-profile-scenario.js';
import { assertWantedRootProfileOptions, wantedRootProfileCandidates, wantedRootProfileMedia } from './wanted-root-profile-comparison.js';

/** Full historical matrix, explicitly admitted; actual scenario/owner return precedes completion. */
export async function measureWantedRootLookups({ signal, profiles = wantedRootProfileMedia,
  receiptCandidates = wantedRootProfileCandidates, pairs = 4, onProgress = async () => {}, onSample = async () => {},
  onCheckpoint = async () => {}, createRuntime = createPostgresIntegrationRuntime, withApp = withIntegrationApp,
  exercise = exerciseWantedRootProfile } = {}) {
  assertWantedRootProfileOptions({ profiles, receiptCandidates, pairs });
  const selectedProfiles = [...profiles]; const selectedCandidates = [...receiptCandidates];
  if ([onProgress, onSample, onCheckpoint, createRuntime, withApp, exercise].some(value => typeof value !== 'function')) {
    throw new TypeError('Invalid root lookup workload dependency');
  }
  signal?.throwIfAborted(); const config = resolveIntegrationTestRuntimeConfig(); const rows = [];
  await onCheckpoint({ stage: 'server_start' }); signal?.throwIfAborted();
  const runtime = await createRuntime({ config, env: {} });
  const result = await withWorkerTaskCleanup(async () => {
    for (const mediaProfile of selectedProfiles) for (const candidates of selectedCandidates) {
      signal?.throwIfAborted();
      const caseSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(config.scenarioTimeoutMs)]);
      await onCheckpoint({ stage: 'scenario_start', mediaProfile, receipts: candidates * 2 });
      caseSignal.throwIfAborted();
      await withApp({ config,
        withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: caseSignal }),
        run: input => withFixtureLifecycle({ signal: caseSignal }, async scope => {
          scope.signal.throwIfAborted();
          await exercise({ workspaceDir: input.workspaceDir, signal: scope.signal, mediaProfile, receiptCandidates: candidates,
            pairs, onCheckpoint, onSample: async row => { rows.push(row); await onSample(row); scope.signal.throwIfAborted(); } });
          scope.signal.throwIfAborted();
        }),
      });
      caseSignal.throwIfAborted();
      await onProgress({ mediaProfile, receipts: candidates * 2, completedSamples: rows.length }); signal?.throwIfAborted();
    }
    return rows;
  }, () => withWorkerTaskCleanup(() => onCheckpoint({ stage: 'server_cleanup' }), () => runtime.cleanup()));
  signal?.throwIfAborted(); return result;
}
