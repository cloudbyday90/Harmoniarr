/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { seedWantedRootProfile } from '../../testing/integration/wanted-root-profile-fixture.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { compareWantedGuardedSamples, profileWantedGuardedReconciliation } from '../../testing/integration/wanted-guarded-profile.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
suite('Bounded full guarded Wanted profiling on actual private media', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
    test('tonal media retains exact guarded work, rollback and late-byte refusal across readers', {
      timeout: config.scenarioTimeoutMs,
    }, async t => {
      const operation = withIntegrationApp({ config,
        withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
        run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
          const c = await seedWantedRootProfile(input.workspaceDir, { mediaProfile: 'sine', durationSeconds: 2, receiptCandidates: 8 });
          const files = c.preview.files.map(f => f.libraryTarget.path);
          const sizes = await Promise.all(files.map(async path => (await stat(path)).size));
          const beforeRows = (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows;
          const eventsBefore = (await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows;
          await withWantedProfileClient(c.pool, async borrowed => {
            const samples = [];
            for (const readMethod of ['stream', 'reusable']) samples.push(await profileWantedGuardedReconciliation(borrowed, {
              readMethod, signal: scope.signal, gc: () => {} }));
            compareWantedGuardedSamples(...samples);
            assert.equal(samples[0].diagnostics.counters.projectionReads, 7);
            assert.equal(samples[0].diagnostics.counters.fingerprintCalls, 112);
            assert.equal(samples[0].diagnostics.counters.hashedBytes, sizes.reduce((a, b) => a + b, 0) * 8 * 7);
            assert.equal(samples[0].pathWork.distinctPerProjection, 14);
            assert.equal(samples[0].pathWork.repeatedWithinProjections, 98);
            const original = await readFile(files[0]);
            try {
              await assert.rejects(profileWantedGuardedReconciliation(borrowed, { signal: scope.signal, gc: () => {},
                afterProjection: async ({ count }) => { if (count === 1) await writeFile(files[0], 'Controlled late byte change'); } }),
              { code: 'library_wanted_projection_stale' });
            } finally { await writeFile(files[0], original); }
          });
          assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeRows);
          assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, eventsBefore);
          await c.pool.query(`CREATE FUNCTION refuse_profile_source_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
            IF NEW.event_type='operator_track_source_reopened' THEN RAISE EXCEPTION 'Controlled guarded source event'; END IF; RETURN NEW; END $$;
            CREATE TRIGGER refuse_profile_source_event BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION refuse_profile_source_event()`);
          const original = await readFile(files[0]);
          try {
            await writeFile(files[0], 'Controlled missing evidence');
            await withWantedProfileClient(c.pool, borrowed => assert.rejects(profileWantedGuardedReconciliation(borrowed, {
              signal: scope.signal, gc: () => {} }), error => error.message.includes('Controlled guarded source event')));
          } finally { await writeFile(files[0], original); }
          assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeRows);
          assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, eventsBefore);
        }),
      });
      active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation));
      await operation;
    });
});
