/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { seedWantedDistinctBindingProfile } from '../../testing/integration/wanted-distinct-binding-fixture.js';
import { assertWantedDistinctSample } from '../../testing/integration/wanted-distinct-binding-policy.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { compareWantedBoundedRootSamples, profileWantedGuardedReconciliation } from '../../testing/integration/wanted-guarded-profile.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
suite('Actual distinct private deliveries in guarded Wanted profiling', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('four bindings retain every source guard, exact full bytes, rollback and late change refusal', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    const operation = withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
      run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
        const c = await seedWantedDistinctBindingProfile(input.workspaceDir, { bindings: 4, mediaProfile: 'sine',
          durationSeconds: 2, signal: scope.signal });
        assert.deepEqual(c.dimensions, { bindings: 4, requirements: 4, owners: 2, contexts: 2, receiptsPerBinding: 3, receipts: 12 });
        assert.equal(c.pool.options.max, 2); assert.equal(c.pool.options.connectionTimeoutMillis, 10_000);
        const beforeRows = (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows;
        const beforeEvents = (await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows;
        await withWantedProfileClient(c.pool, async borrowed => {
          const samples = [];
          for (const rootReadMode of ['member', 'bounded']) {
            const sample = await profileWantedGuardedReconciliation(borrowed, { rootReadMode, receiptGrouping: true,
              signal: scope.signal, gc: () => {} });
            assertWantedDistinctSample(sample, { bindings: 4, fileSizes: c.fileSizes }); samples.push(sample);
          }
          compareWantedBoundedRootSamples(...samples);
          assert.equal(samples[0].diagnostics.counters.projectionReads, 9);
          assert.equal(samples[0].diagnostics.counters.fingerprintCalls, 72);
          assert.equal(samples[0].queryCount - samples[1].queryCount, 144);
          const path = c.files[2]; const bytes = await readFile(path);
          try {
            await assert.rejects(profileWantedGuardedReconciliation(borrowed, { rootReadMode: 'bounded', receiptGrouping: true,
              signal: scope.signal, gc: () => {}, afterProjection: async ({ count }) => {
                if (count === 1) await writeFile(path, 'Controlled late binding mutation');
              } }), { code: 'library_wanted_projection_stale' });
          } finally { await writeFile(path, bytes); }
        });
        assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeRows);
        assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, beforeEvents);
        await c.pool.query(`CREATE FUNCTION refuse_distinct_source_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type='operator_track_source_reopened' THEN RAISE EXCEPTION 'Controlled distinct source event'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refuse_distinct_source_event BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION refuse_distinct_source_event()`);
        const path = c.files[3]; const bytes = await readFile(path);
        try {
          await writeFile(path, 'Controlled unavailable binding');
          await withWantedProfileClient(c.pool, borrowed => assert.rejects(profileWantedGuardedReconciliation(borrowed, {
            rootReadMode: 'bounded', receiptGrouping: true, signal: scope.signal, gc: () => {} }),
          error => error.message.includes('Controlled distinct source event')));
        } finally { await writeFile(path, bytes); }
        assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeRows);
        assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, beforeEvents);
      }),
    });
    active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); await operation;
  });
});
