/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { seedWantedRootProfile } from '../../testing/integration/wanted-root-profile-fixture.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { compareWantedClosedGroupSamples, profileWantedGuardedReconciliation } from '../../testing/integration/wanted-guarded-profile.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { captureOperatorTrackFileStat } from '../../src/server/metadata/operator-track-fingerprint-policy.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
suite('Closed duplicate receipt groups through actual Wanted publication', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('default wiring closes real duplicate groups, preserves each source and rejects same-marker mutation/event failure', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    const operation = withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
      run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
        const c = await seedWantedRootProfile(input.workspaceDir, { mediaProfile: 'sine', durationSeconds: 2, receiptCandidates: 8 });
        const files = c.preview.files.map(file => file.libraryTarget.path); const sizes = await Promise.all(files.map(async path => (await stat(path)).size));
        await withWantedProfileClient(c.pool, async borrowed => {
          const serial = await profileWantedGuardedReconciliation(borrowed, { signal: scope.signal, gc: () => {}, receiptGrouping: false });
          const grouped = await profileWantedGuardedReconciliation(borrowed, { signal: scope.signal, gc: () => {}, receiptGrouping: true });
          compareWantedClosedGroupSamples(serial, grouped);
          assert.equal(serial.diagnostics.counters.fingerprintCalls, 112); assert.equal(grouped.diagnostics.counters.fingerprintCalls, 28);
          assert.equal(grouped.diagnostics.counters.hashedBytes, sizes.reduce((a, b) => a + b, 0) * 14);
        });
        const records = []; const observer = () => createWantedVerificationObserver({ enabled: true, onRecord: record => records.push(record) });
        const options = { assertMaintenanceWriteAllowed: async () => {}, createVerificationObserver: observer };
        const canonical = createLibraryWantedReleaseService(options);
        assert.deepEqual((await canonical.reconcileWantedReleases()).wantedKeys, []);
        assert.equal(records.at(-1).counters.closedReceiptGroups, 14); assert.equal(records.at(-1).counters.groupedReceiptRows, 112);
        assert.equal(records.at(-1).counters.fingerprintCalls, 28);
        assert.equal(records.at(-1).counters.boundedRootGroups, 14); assert.equal(records.at(-1).phases.root_resolution.calls, 28);
        const beforeWanted = (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows;
        const beforeEvents = (await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows;
        const originals = new Map(await Promise.all(files.map(async path => [path, await readFile(path)])));
        for (const path of files) await utimes(path, 1_700_000_000, 1_700_000_000);
        let hashes = 0;
        const reader = createLibraryWantedReleaseReader({ groupReceiptVerification: true,
          fingerprintTrackFile: async (path, fingerprintOptions) => {
            const marker = captureOperatorTrackFileStat(await stat(path)); const result = await fingerprintOperatorTrackFile(path, fingerprintOptions);
            if (++hashes === 1) {
              const changed = Buffer.from(originals.get(path)); changed[changed.length - 1] ^= 1;
              await writeFile(path, changed, { flag: 'r+' }); await utimes(path, 1_700_000_000, 1_700_000_000);
              assert.deepEqual(captureOperatorTrackFileStat(await stat(path)), marker);
            }
            return result;
          } });
        try {
          await assert.rejects(createLibraryWantedReleaseService({ ...options, projectionReader: reader }).reconcileWantedReleases(),
            { code: 'library_wanted_projection_stale' });
          assert.equal(hashes, 2);
        } finally { for (const [path, bytes] of originals) await writeFile(path, bytes); }
        assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeWanted);
        assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, beforeEvents);
        await c.pool.query(`CREATE FUNCTION refuse_closed_group_source_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type='operator_track_source_reopened' THEN RAISE EXCEPTION 'Controlled closed-group event'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refuse_closed_group_source_event BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION refuse_closed_group_source_event()`);
        await writeFile(files[0], 'Controlled absent receipt bytes');
        try { await assert.rejects(canonical.reconcileWantedReleases(), error => error.message.includes('Controlled closed-group event')); }
        finally { for (const [path, bytes] of originals) await writeFile(path, bytes); }
        assert.deepEqual((await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows, beforeWanted);
        assert.deepEqual((await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows, beforeEvents);
      }),
    });
    active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation));
    await operation;
  });
});
