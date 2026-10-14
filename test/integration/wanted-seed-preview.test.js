/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { createWantedSeedObserver } from '../../testing/integration/wanted-seed-observer.js';
import { seedWantedDistinctBindingProfile } from '../../testing/integration/wanted-distinct-binding-fixture.js';
import { profileWantedGuardedReconciliation } from '../../testing/integration/wanted-guarded-profile.js';
import { compareWantedSourceNoopSamples } from '../../testing/integration/wanted-source-noop-profile-policy.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { createOwnedMediaInspectionExecutor } from '../../testing/integration/owned-media-inspection-executor.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
suite('Actual worker previews own Wanted fixture evidence', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('four independent files retain accepted worker plans, complete receipts and guarded private comparisons', { timeout: config.scenarioTimeoutMs }, async t => {
    let inspectionExecutor;
    const work = withIntegrationApp({ config,
      workspaceCleanupGuard: () => !inspectionExecutor || inspectionExecutor.canRemoveWorkspace(),
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
      run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
        const rows = []; const observer = createWantedSeedObserver({ onRecord: row => rows.push(row) });
        if (process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE) {
          inspectionExecutor = createOwnedMediaInspectionExecutor({ workspaceDir: input.workspaceDir, signal: scope.signal });
          scope.onRelease(() => inspectionExecutor.close());
        }
        const c = await observer.measure('seed_total', null, () => seedWantedDistinctBindingProfile(input.workspaceDir,
          { bindings: 4, mediaProfile: 'sine', durationSeconds: 2, signal: scope.signal, seedObserver: observer, inspectionExecutor }));
        assert.deepEqual(c.dimensions, { bindings: 4, requirements: 4, owners: 2, contexts: 2, receiptsPerBinding: 3, receipts: 12 });
        const settled = rows.filter(row => row.event === 'settled');
        assert.equal(settled.filter(row => row.phase === 'delivery_preview').length, 0);
        assert.equal(settled.filter(row => row.phase === 'media_generate').length, 4);
        assert.equal(settled.filter(row => row.phase === 'media_inspect').length, 20);
        assert.ok(settled.every(row => row.outcome === 'completed'));
        assert.deepEqual(settled.filter(row => row.phase === 'delivery_apply').map(row => row.context), [1, 2]);
        assert.ok(settled.some(row => row.phase === 'receipt_validate'));
        const receipts = (await c.pool.query('SELECT receipt FROM operator_track_receipts')).rows.map(row => row.receipt);
        for (const delivery of c.deliveries) {
          assert.equal(delivery.planned.files.length, 2);
          assert.equal(await readFile(delivery.third, 'utf8'), 'Keep the unrequested sibling');
          for (const file of delivery.planned.files) {
            const matching = receipts.filter(receipt => receipt.files.some(f => resolve(f.libraryPath) === resolve(file.libraryTarget.path)));
            assert.equal(matching.length, 3);
            const evidence = matching[0].files[0].evidence;
            const observed = await fingerprintOperatorTrackFile(file.libraryTarget.path, { libraryRoot: file.delivery.libraryRoot });
            assert.equal(observed.sha256, evidence.sha256); assert.equal(observed.sizeBytes, evidence.sizeBytes);
          }
        }
        await withWantedProfileClient(c.pool, async borrowed => {
          const samples = [];
          for (const sourceTransitionMode of ['compatibility', 'locked-noop']) samples.push(await profileWantedGuardedReconciliation(borrowed,
            { rootReadMode: 'bounded', receiptGrouping: true, captureDurable: true, sourceTransitionMode, gc: () => {}, signal: scope.signal }));
          compareWantedSourceNoopSamples(...samples, { bindings: 4, fileSizes: c.fileSizes });
        });
      }) });
    active.add(work); try { await work; } finally { active.delete(work); }
  });
});
