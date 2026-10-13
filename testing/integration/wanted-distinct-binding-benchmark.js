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
import { seedWantedDistinctBindingProfile } from './wanted-distinct-binding-fixture.js';
import { withWantedProfileClient } from './wanted-profile-client.js';
import { assertWantedDistinctSample, assertWantedDistinctWorkloadOptions, wantedDistinctBindingCounts } from './wanted-distinct-binding-policy.js';
import { compareWantedBoundedRootSamples, profileWantedGuardedReconciliation,
  summarizeWantedGuardedSample } from './wanted-guarded-profile.js';
import { compareWantedSourceNoopSamples } from './wanted-source-noop-profile-policy.js';

export async function measureWantedDistinctBindings({ signal, onProgress = () => {}, onSample = () => {},
  profiles = ['sine', 'noise'], bindingCounts = wantedDistinctBindingCounts, pairs = 2, gc = global.gc,
  sourceNoopComparison = false } = {}) {
  if (typeof sourceNoopComparison !== 'boolean') throw new TypeError('Invalid source no-op comparison');
  assertWantedDistinctWorkloadOptions({ signal, profiles, bindingCounts, pairs, gc, onProgress, onSample });
  const config = resolveIntegrationTestRuntimeConfig(); const rows = [];
  const runtime = await createPostgresIntegrationRuntime({ config, env: {} });
  let failed = false; let failure;
  try {
    for (const mediaProfile of profiles) for (const bindings of bindingCounts) for (let pair = 0; pair < pairs; pair++) {
      signal?.throwIfAborted();
      const caseSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(config.scenarioTimeoutMs)]);
      await withIntegrationApp({ config,
        withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: caseSignal }),
        run: input => withFixtureLifecycle({ signal: caseSignal }, async scope => {
          const c = await seedWantedDistinctBindingProfile(input.workspaceDir, { bindings, mediaProfile,
            durationSeconds: mediaProfile === 'noise' ? 30 : 2, signal: scope.signal });
          await withWantedProfileClient(c.pool, async borrowed => {
            const samples = [];
            const modes = sourceNoopComparison ? ['compatibility', 'locked-noop'] : ['member', 'bounded'];
            if (pair % 2) modes.reverse();
            for (const mode of modes) {
              const rootReadMode = sourceNoopComparison ? 'bounded' : mode;
              const sourceTransitionMode = sourceNoopComparison ? mode : 'compatibility';
              const sample = await profileWantedGuardedReconciliation(borrowed, { readMethod: 'reusable',
                receiptGrouping: true, rootReadMode, sourceTransitionMode, captureDurable: sourceNoopComparison, signal: scope.signal, gc });
              if (!sourceNoopComparison) assertWantedDistinctSample(sample, { bindings, fileSizes: c.fileSizes });
              samples.push(sample);
            }
            if (sourceNoopComparison) compareWantedSourceNoopSamples(samples.find(s => s.sourceTransitionMode === 'compatibility'),
              samples.find(s => s.sourceTransitionMode === 'locked-noop'), { bindings, fileSizes: c.fileSizes });
            else compareWantedBoundedRootSamples(samples.find(s => s.rootReadMode === 'member'), samples.find(s => s.rootReadMode === 'bounded'));
            for (const sample of samples) {
              const row = { mediaProfile, pair, ...c.dimensions, fileSizes: c.fileSizes, ...summarizeWantedGuardedSample(sample) };
              rows.push(row); await onSample(row);
            }
          });
        }),
      });
      await onProgress({ mediaProfile, bindings, pair, completedSamples: rows.length });
    }
  } catch (error) { failed = true; failure = error; }
  try { await runtime.cleanup(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return rows;
}
