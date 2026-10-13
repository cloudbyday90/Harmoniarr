/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { createPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';
import { withIntegrationApp } from './app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { withFixtureLifecycle } from './fixture-lifecycle.js';
import { seedWantedRootProfile } from './wanted-root-profile-fixture.js';
import { withWantedProfileClient } from './wanted-profile-client.js';
import { compareWantedGuardedSamples, compareWantedClosedGroupSamples, profileWantedGuardedReconciliation, summarizeWantedGuardedSample } from './wanted-guarded-profile.js';

export async function measureWantedGuardedWorkload({ signal, onProgress = () => {}, onSample = () => {},
  profiles = ['sine', 'noise'], receiptCounts = [16, 48, 96], pairs = 2, gc = global.gc, groupingComparison = false } = {}) {
  if (typeof groupingComparison !== 'boolean' || typeof gc !== 'function' || typeof onProgress !== 'function' || typeof onSample !== 'function'
    || ![1, 2].includes(pairs) || !Array.isArray(profiles) || !profiles.length || profiles.length > 2
    || new Set(profiles).size !== profiles.length || profiles.some(p => !['sine', 'noise'].includes(p))
    || !Array.isArray(receiptCounts) || !receiptCounts.length || receiptCounts.length > 3
    || new Set(receiptCounts).size !== receiptCounts.length || receiptCounts.some(n => ![16, 48, 96].includes(n))) {
    throw new TypeError('Invalid guarded workload profile');
  }
  signal?.throwIfAborted();
  const config = resolveIntegrationTestRuntimeConfig(); const rows = [];
  const runtime = await createPostgresIntegrationRuntime({ config, env: {} });
  let failed = false; let failure;
  try {
    for (const mediaProfile of profiles) for (const receipts of receiptCounts) for (let pair = 0; pair < pairs; pair++) {
      signal?.throwIfAborted();
      const caseSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(config.scenarioTimeoutMs)]);
      await withIntegrationApp({ config,
        withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: caseSignal }),
        run: input => withFixtureLifecycle({ signal: caseSignal }, async scope => {
          const c = await seedWantedRootProfile(input.workspaceDir, { receiptCandidates: receipts / 2,
            mediaProfile, durationSeconds: mediaProfile === 'noise' ? 30 : 2 });
          scope.signal.throwIfAborted();
          const fileStats = await Promise.all(c.preview.files.map(file => stat(file.libraryTarget.path)));
          assert.equal(new Set(fileStats.map(info => JSON.stringify([info.dev, info.ino]))).size, 2);
          const fileSizes = fileStats.map(info => info.size);
          await withWantedProfileClient(c.pool, async borrowed => {
            const samples = [];
            const options = groupingComparison ? [{ readMethod: 'reusable', receiptGrouping: false }, { readMethod: 'reusable', receiptGrouping: true }]
              : [{ readMethod: 'stream', receiptGrouping: false }, { readMethod: 'reusable', receiptGrouping: false }];
            for (const option of (pair % 2 ? options.reverse() : options)) {
              const result = await profileWantedGuardedReconciliation(borrowed, { ...option, signal: scope.signal, gc });
              const { counters } = result.diagnostics;
              assert.equal(result.diagnostics.outcome, 'completed'); assert.ok(counters.projectionReads > 1);
              assert.equal(counters.fingerprintCalls, (option.receiptGrouping ? 4 : receipts) * counters.projectionReads);
              assert.equal(counters.availableReceipts, receipts * counters.projectionReads);
              assert.equal(counters.hashedBytes, fileSizes.reduce((a, b) => a + b, 0) * (option.receiptGrouping ? 2 : receipts / 2) * counters.projectionReads);
              assert.equal(result.pathWork.distinctPrivateBindings, 2);
              assert.equal(result.pathWork.distinctPerProjection, 2 * counters.projectionReads);
              assert.deepEqual(result.result.wantedKeys, []);
              assert.equal(result.memory.unavailable, false);
              samples.push(result);
            }
            if (groupingComparison) {
              compareWantedClosedGroupSamples(samples.find(s => !s.receiptGrouping), samples.find(s => s.receiptGrouping));
            } else compareWantedGuardedSamples(...samples);
            for (const sample of samples) {
              const row = { mediaProfile, receipts, pair, fileSizes, ...summarizeWantedGuardedSample(sample) };
              rows.push(row); await onSample(row);
            }
          });
        }),
      });
      await onProgress({ mediaProfile, receipts, pair, completedSamples: rows.length });
    }
  } catch (error) { failed = true; failure = error; }
  try { await runtime.cleanup(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return rows;
}
