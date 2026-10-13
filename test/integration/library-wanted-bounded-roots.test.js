/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, stat, utimes, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { seedWantedRootProfile } from '../../testing/integration/wanted-root-profile-fixture.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { profileWantedGuardedReconciliation, compareWantedBoundedRootSamples } from '../../testing/integration/wanted-guarded-profile.js';
import { lockLibraryRootAuthority } from '../../src/server/library/library-root-authority-lock-store.js';
import { withWantedRootReadAuthority, wantedRootReadTransaction } from '../../src/server/library/wanted-root-read-authority-service.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { fingerprintOperatorTrackFile } from '../../src/server/metadata/operator-track-file-evidence-service.js';
import { captureOperatorTrackFileStat } from '../../src/server/metadata/operator-track-fingerprint-policy.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
suite('Bounded current roots inside actual Wanted publication', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('exact outcomes, scoped transaction checks, current root/byte refusal and guard integrity', { timeout: config.scenarioTimeoutMs }, async t => {
    const operation = withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
      run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
        const c = await seedWantedRootProfile(input.workspaceDir, { receiptCandidates: 8, mediaProfile: 'sine', durationSeconds: 2 });
        await withWantedProfileClient(c.pool, async borrowed => {
          const results = [];
          for (const rootReadMode of ['member', 'bounded']) results.push(await profileWantedGuardedReconciliation(borrowed, {
            rootReadMode, receiptGrouping: true, gc: () => {}, signal: scope.signal }));
          compareWantedBoundedRootSamples(...results);
          assert.equal(results[0].diagnostics.phases.root_resolution.calls, 224);
          assert.equal(results[1].diagnostics.phases.root_resolution.calls, 28);
          assert.equal(results[1].queryCount, 160);
        });
        const reader = createLibraryWantedReleaseReader();
        const ownerId = (await c.pool.query('SELECT app_user_id FROM operator_track_receipts LIMIT 1')).rows[0].app_user_id;
        await withRollbackFixtureClient(c.pool, async client => {
          await lockLibraryRootAuthority({ queryable: client }); let captured;
          await withWantedRootReadAuthority({ queryable: client }, async authority => {
            captured = authority;
            await client.query('COMMIT'); await client.query('BEGIN');
            const expectedTransactionId = wantedRootReadTransaction(authority, client);
            for (const id of [ownerId, randomUUID()]) await assert.rejects(createOperatorTrackDeliveryPlanService().resolvePrivateOwnerRoot({
              ownerId: id, queryable: client, expectedTransactionId }), { code: 'library_wanted_projection_stale' });
          });
          const records = []; const observer = createWantedVerificationObserver({ enabled: true, onRecord: record => records.push(record) });
          await reader.readWantedReleaseProjection({ queryable: client, rootReadAuthority: captured, verificationObserver: observer });
          observer.finish('completed'); assert.equal(records[0].counters.boundedRootGroups, 0); assert.equal(records[0].phases.root_resolution.calls, 32);
        });
        const snapshot = async () => ({ wanted: (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows,
          events: (await c.pool.query('SELECT * FROM media_request_events ORDER BY id')).rows });
        const baseline = await snapshot(); const originals = new Map(c.preview.files.map(file => [file.libraryTarget.path, null]));
        for (const path of originals.keys()) originals.set(path, await readFile(path));
        for (const change of ['disabled', 'null', 'relative', 'bytes']) {
          let queryable; let hashes = 0;
          const probe = createLibraryWantedReleaseReader({ groupReceiptVerification: true, allowBoundedRootReads: true,
            fingerprintTrackFile: async (path, options) => {
              if (change === 'bytes') await utimes(path, 1_700_000_000, 1_700_000_000);
              const evidence = await fingerprintOperatorTrackFile(path, options);
              if (++hashes === 1) {
                if (change === 'disabled') await queryable.query('UPDATE app_users SET is_disabled=TRUE');
                if (change === 'null') await queryable.query("UPDATE app_settings SET setting_value='null'::jsonb WHERE namespace='paths' AND setting_key='music'");
                if (change === 'relative') await queryable.query("UPDATE app_users SET managed_library_relative_root=managed_library_relative_root||'-changed' WHERE managed_library_relative_root IS NOT NULL");
                if (change === 'bytes') {
                  const marker = captureOperatorTrackFileStat(await stat(path)); const bytes = Buffer.from(await readFile(path)); bytes[bytes.length - 1] ^= 1;
                  await writeFile(path, bytes, { flag: 'r+' }); await utimes(path, 1_700_000_000, 1_700_000_000);
                  assert.deepEqual(captureOperatorTrackFileStat(await stat(path)), marker);
                }
              }
              return evidence;
            } });
          try {
            await assert.rejects(createLibraryWantedReleaseService({ rootReadMode: 'bounded', assertMaintenanceWriteAllowed: async () => {},
              projectionReader: { readWantedReleaseProjection: options => { queryable = options.queryable; return probe.readWantedReleaseProjection(options); } },
            }).reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
            assert.equal(hashes, change === 'bytes' ? 2 : 1); assert.deepEqual(await snapshot(), baseline);
          } finally { for (const [path, bytes] of originals) await writeFile(path, bytes); }
        }
        await c.pool.query('ALTER TABLE app_users DISABLE TRIGGER app_users_root_authority_admission');
        try { await assert.rejects(createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} }).reconcileWantedReleases(),
          { code: 'library_wanted_projection_stale' }); assert.deepEqual(await snapshot(), baseline); }
        finally { await c.pool.query('ALTER TABLE app_users ENABLE TRIGGER app_users_root_authority_admission'); }
        const replaceGuard = condition => c.pool.query(`CREATE OR REPLACE TRIGGER app_users_root_authority_admission
          BEFORE INSERT OR DELETE OR UPDATE OF id,is_disabled,managed_library_relative_root ON app_users
          FOR EACH STATEMENT ${condition} EXECUTE FUNCTION public.harmoniarr_root_authority_admission()`);
        await replaceGuard('WHEN (false)');
        try { await assert.rejects(createLibraryWantedReleaseService({ assertMaintenanceWriteAllowed: async () => {} }).reconcileWantedReleases(),
          { code: 'library_wanted_projection_stale' }); assert.deepEqual(await snapshot(), baseline); }
        finally { await replaceGuard(''); }
      }),
    });
    active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); await operation;
  });
});
