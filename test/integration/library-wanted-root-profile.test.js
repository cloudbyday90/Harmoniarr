/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { seedWantedRootProfile, profileWantedProjection } from '../../testing/integration/wanted-root-profile-fixture.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
const activeScenarios = new Set();
async function scenario(context, work) {
  await Promise.allSettled([...activeScenarios]); context.signal.throwIfAborted();
  const operation = withIntegrationApp({ config,
    withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver }),
    run: args => withFixtureLifecycle({ signal: context.signal }, scope => work(args, scope)) });
  activeScenarios.add(operation);
  operation.then(() => activeScenarios.delete(operation), () => activeScenarios.delete(operation));
  return operation;
}
suite('Wanted projection root-context scaling and current authority', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...activeScenarios]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const profile of [{ mediaProfile: 'sine', durationSeconds: 2 }, { mediaProfile: 'noise', durationSeconds: 30 }]) {
    for (const receiptCandidates of [1, 8, 24]) {
      test(`${profile.mediaProfile} ${receiptCandidates * 2} historical receipts compare fresh roots on one client`, { timeout: config.scenarioTimeoutMs }, async context => scenario(context,
        async ({ workspaceDir }, scope) => {
          const c = await seedWantedRootProfile(workspaceDir, { ...profile, receiptCandidates });
          scope.signal.throwIfAborted();
          const sizes = await Promise.all(c.preview.files.map(async file => (await stat(file.libraryTarget.path)).size));
          await withRollbackFixtureClient(c.pool, async client => {
            // Actual apply already hashed the same files. Keep every timed
            // sample; avoid two redundant whole-history warm-up projections.
            const samples = [];
            for (let pair = 0; pair < 4; pair++) {
              const results = {};
              for (const useCombinedRootRead of (pair % 2 ? [true, false] : [false, true])) {
                const result = await profileWantedProjection(client, { useCombinedRootRead, signal: scope.signal });
                results[useCombinedRootRead ? 'joined' : 'legacy'] = result;
                const record = result.diagnostics;
                assert.equal(record.counters.fingerprintCalls, receiptCandidates * 2);
                assert.equal(record.counters.availableReceipts, receiptCandidates * 2);
                assert.equal(record.counters.hashedBytes, sizes.reduce((sum, size) => sum + size, 0) * receiptCandidates);
                assert.equal(record.phases.root_resolution.calls, receiptCandidates * 2);
                assert.deepEqual(result.projection.wantedReleases, []);
                samples.push({ pair, variant: useCombinedRootRead ? 'joined' : 'legacy', queryCount: result.queryCount, queryMs: result.queryMs,
                  counters: record.counters, phases: record.phases });
              }
              assert.deepEqual(results.joined.projection, results.legacy.projection);
              assert.equal(results.legacy.queryCount - results.joined.queryCount, receiptCandidates * 2);
            }
            context.diagnostic(JSON.stringify({ kind: 'wanted_root_profile', ...profile, receiptCandidates, fileSizes: sizes, samples }));
          });
          if (receiptCandidates === 1 && profile.mediaProfile === 'sine') {
            const root = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: true });
            const ownerId = c.preview.files[0].delivery.ownerId;
            const original = (await c.pool.query("SELECT setting_value FROM app_settings WHERE namespace='paths' AND setting_key='music'")).rows[0].setting_value;
            await c.pool.query("UPDATE app_settings SET setting_value='null'::jsonb WHERE namespace='paths' AND setting_key='music'");
            await assert.rejects(root.resolvePrivateOwnerRoot({ ownerId }), { code: 'operator_track_scope_verification_required' });
            await c.pool.query("DELETE FROM app_settings WHERE namespace='paths' AND setting_key='music'");
            const legacy = createOperatorTrackDeliveryPlanService({ useCombinedRootRead: false });
            assert.equal(await root.resolvePrivateOwnerRoot({ ownerId }), await legacy.resolvePrivateOwnerRoot({ ownerId }));
            await c.pool.query("INSERT INTO app_settings(namespace,setting_key,setting_value) VALUES('paths','music',$1::jsonb)", [JSON.stringify(original)]);
            await c.pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [ownerId]);
            await assert.rejects(root.resolvePrivateOwnerRoot({ ownerId }), { code: 'operator_track_scope_verification_required' });
            await c.pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [ownerId]);
            const reader = createLibraryWantedReleaseReader({ resolvePrivateTrackRoot: root.resolvePrivateOwnerRoot }); let reads = 0;
            const wantedBefore = (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows;
            const wanted = createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {}, projectionReader: {
              readWantedReleaseProjection: async input => {
                const projection = await reader.readWantedReleaseProjection(input);
                // Deliberate drift on the owning transaction remains detectable.
                // An external writer now waits for publication instead; waiting
                // for it inside this callback would form a circular fixture gate.
                if (++reads === 1) await input.queryable.query("UPDATE app_settings SET setting_value='null'::jsonb WHERE namespace='paths' AND setting_key='music'");
                return projection;
              },
            } });
            await assert.rejects(wanted.reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
            assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, wantedBefore);
            await c.pool.query("UPDATE app_settings SET setting_value=$1::jsonb WHERE namespace='paths' AND setting_key='music'", [JSON.stringify(original)]);
          }
        }));
    }
  }
});
