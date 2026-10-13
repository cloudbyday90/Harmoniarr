/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { seedWantedRootProfile } from '../../testing/integration/wanted-root-profile-fixture.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { lockLibraryRootAuthority } from '../../src/server/library/library-root-authority-lock-store.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { createOperatorTrackSourceLifecycleService } from '../../src/server/metadata/operator-track-source-lifecycle-service.js';
import { createOperatorTrackDeliveryPlanService } from '../../src/server/metadata/operator-track-delivery-plan-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { inspectSchemaAnchors, compareSchemaAnchorSnapshots } from '../../src/server/schema-anchor-service.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
const migration = '20261013_155026_wanted_root_authority_coordination.sql';
const triggerAnchors = { triggers: [
  { table: 'app_users', trigger: 'app_users_root_authority_admission' },
  { table: 'app_settings', trigger: 'app_settings_root_authority_admission' },
] };
const settingSql = "SELECT setting_value FROM app_settings WHERE namespace='paths' AND setting_key='music'";
const setRoot = (pool, value) => pool.query(`INSERT INTO app_settings(namespace,setting_key,setting_value)
  VALUES('paths','music',$1::jsonb) ON CONFLICT(namespace,setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value`, [JSON.stringify(value)]);
async function scenario(t, work) {
  const operation = withIntegrationApp({ config,
    withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
    run: input => withFixtureLifecycle({ signal: t.signal }, scope => work(input, scope)),
  });
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); await operation;
}
const saved = async pool => ({ wanted: (await pool.query('SELECT * FROM library_wanted_releases ORDER BY id')).rows,
  events: (await pool.query('SELECT * FROM media_request_events ORDER BY id')).rows });

suite('Wanted root authority through actual publication and database writers', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('snapshot and pending migration install enabled anchors; queued publishers read committed revocation after admission', {
    timeout: config.scenarioTimeoutMs,
  }, async t => scenario(t, async (input, scope) => {
    const pool = input.getPoolFn(); const beforeSnapshot = await inspectSchemaAnchors({ anchors: triggerAnchors, client: pool });
    const version = (await pool.query('SHOW server_version')).rows[0].server_version.match(/^\d+(?:\.\d+){1,2}/u)?.[0];
    assert.ok(version); t.diagnostic(`PostgreSQL ${version}`);
    assert.equal(Object.values(beforeSnapshot.triggers).every(entry => entry.actual !== null), true);
    await pool.query('ALTER TABLE app_users DISABLE TRIGGER app_users_root_authority_admission');
    assert.equal(compareSchemaAnchorSnapshots({ source: beforeSnapshot,
      snapshot: await inspectSchemaAnchors({ anchors: triggerAnchors, client: pool }) }).clean, false);
    await pool.query('DROP TRIGGER app_users_root_authority_admission ON app_users');
    await pool.query('DROP TRIGGER app_settings_root_authority_admission ON app_settings');
    await pool.query('DROP FUNCTION public.harmoniarr_root_authority_admission()');
    await pool.query('DELETE FROM schema_migrations WHERE filename=$1', [migration]);
    assert.deepEqual(await applyPendingMigrations({ getPoolFn: () => pool }), [migration]);
    assert.equal(compareSchemaAnchorSnapshots({ source: beforeSnapshot,
      snapshot: await inspectSchemaAnchors({ anchors: triggerAnchors, client: pool }) }).clean, true);
    await assert.rejects(lockLibraryRootAuthority({ queryable: pool }), { code: '25P01' });
    const ownerId = randomUUID();
    await pool.query(`INSERT INTO app_users(id,username,password_hash,role,managed_library_relative_root)
      VALUES($1,'root-authority-owner','controlled','user','private-owner')`, [ownerId]);
    const holder = await pool.connect(); let pending;
    try {
      await holder.query('BEGIN'); await holder.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [ownerId]);
      const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      pending = withRollbackFixtureClient(pool, async client => {
        await lockLibraryRootAuthority({ queryable: client });
        await assert.rejects(createOperatorTrackDeliveryPlanService().resolvePrivateOwnerRoot({ ownerId, queryable: client }),
          { code: 'operator_track_scope_verification_required' });
      }); void pending.catch(() => {});
      await withFixturePostgresObserver({ connectionConfig: input.databaseConfig, signal: scope.signal },
        observer => waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: pending, signal: scope.signal }));
      await holder.query('COMMIT'); await pending;
    } finally { await holder.query('ROLLBACK'); await pending?.catch(() => {}); holder.release(); }
    await pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [ownerId]);
    await setRoot(pool, null);
    await withRollbackFixtureClient(pool, async client => {
      await lockLibraryRootAuthority({ queryable: client });
      await assert.rejects(createOperatorTrackDeliveryPlanService().resolvePrivateOwnerRoot({ ownerId, queryable: client }),
        { code: 'operator_track_scope_verification_required' });
    });
    await pool.query("DELETE FROM app_settings WHERE namespace='paths' AND setting_key='music'");
    await withRollbackFixtureClient(pool, async client => {
      await lockLibraryRootAuthority({ queryable: client });
      assert.equal(typeof await createOperatorTrackDeliveryPlanService().resolvePrivateOwnerRoot({ ownerId, queryable: client }), 'string');
    });
  }));

  test('late writers wait beyond final production source checks; commit/rollback releases admission without blocking login-only updates', {
    timeout: config.scenarioTimeoutMs,
  }, async t => scenario(t, async (input, scope) => {
    const c = await seedWantedRootProfile(input.workspaceDir, { mediaProfile: 'sine', durationSeconds: 2, receiptCandidates: 8 });
    const pool = c.pool; const ownerId = (await pool.query('SELECT app_user_id FROM operator_track_receipts ORDER BY app_user_id LIMIT 1')).rows[0].app_user_id;
    const oldRelative = (await pool.query('SELECT managed_library_relative_root FROM app_users WHERE id=$1', [ownerId])).rows[0].managed_library_relative_root;
    const oldRoot = (await pool.query(settingSql)).rows[0].setting_value; const extraId = randomUUID();
    await pool.query("INSERT INTO app_users(id,username,password_hash,role) VALUES($1,'authority-extra','controlled','user')", [extraId]);
    const maintenance = createMaintenanceLockService({ getPoolFn: () => pool });
    const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
    const sources = createOperatorTrackSourceLifecycleService();
    const cases = [
      { write: () => pool.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [ownerId]), unavailable: true,
        reset: () => pool.query('UPDATE app_users SET is_disabled=FALSE WHERE id=$1', [ownerId]) },
      { write: () => pool.query("UPDATE app_users SET managed_library_relative_root='changed-authority-root' WHERE id=$1", [ownerId]), unavailable: true,
        reset: () => pool.query('UPDATE app_users SET managed_library_relative_root=$2 WHERE id=$1', [ownerId, oldRelative]) },
      { write: () => setRoot(pool, null), unavailable: true, reset: () => setRoot(pool, oldRoot) },
      { write: () => pool.query("DELETE FROM app_settings WHERE namespace='paths' AND setting_key='music'"),
        unavailable: true, reset: () => setRoot(pool, oldRoot) },
      { prepare: () => pool.query("DELETE FROM app_settings WHERE namespace='paths' AND setting_key='music'"),
        write: () => setRoot(pool, oldRoot), reset: () => setRoot(pool, oldRoot) },
      { write: () => pool.query('DELETE FROM app_users WHERE id=$1', [extraId]) },
      { write: () => pool.query("INSERT INTO app_users(id,username,password_hash,role) VALUES($1,'authority-extra','controlled','user')", [extraId]) },
      { failure: new Error('Controlled publication rollback'), write: () => setRoot(pool, null), reset: () => setRoot(pool, oldRoot) },
      { failure: null, write: () => setRoot(pool, null), reset: () => setRoot(pool, oldRoot) },
    ];
    for (const [index, change] of cases.entries()) {
      await change.prepare?.(); const baseline = await saved(pool);
      const entered = createFixtureGate({ signal: scope.signal }); const gate = createFixtureGate({ signal: scope.signal });
      let holderPid; let writer; let writesCompleted = false; let record;
      const service = createLibraryWantedReleaseService({ getPoolFn: () => pool,
        assertMaintenanceWriteAllowed: ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable }),
        createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: value => { record = value; } }),
        trackSourceLifecycle: { reconcileSources: async options => {
          await sources.reconcileSources(options); holderPid = (await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          entered.release(); await gate.promise;
          if (Object.hasOwn(change, 'failure')) throw change.failure;
        } },
      });
      const pending = service.reconcileWantedReleases(); void pending.catch(() => {});
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: scope.signal });
        if (index === 0) assert.equal((await pool.query('UPDATE app_users SET last_login_at=NOW() WHERE id=$1', [ownerId])).rowCount, 1);
        writer = change.write().then(result => { writesCompleted = true; return result; }); void writer.catch(() => {});
        await withFixturePostgresObserver({ connectionConfig: input.databaseConfig, signal: scope.signal },
          observer => waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: writer, signal: scope.signal }));
        assert.equal(writesCompleted, false); gate.release();
        if (Object.hasOwn(change, 'failure')) {
          await assert.rejects(pending, error => error === change.failure); assert.equal((await writer).rowCount, 1);
          assert.deepEqual(await saved(pool), baseline);
        } else { await pending; assert.equal((await writer).rowCount, 1); }
        if (index === 0) {
          assert.equal(record.counters.closedReceiptGroups, 14); assert.equal(record.counters.fingerprintCalls, 28);
          assert.equal(record.phases.root_resolution.calls, 224);
        }
        if (change.unavailable) await withRollbackFixtureClient(pool, async client => {
          await lockLibraryRootAuthority({ queryable: client });
          const projection = await createLibraryWantedReleaseReader().readWantedReleaseProjection({ queryable: client });
          const artists = projection.source.artists.filter(artist => artist.monitoring.appUserId === ownerId);
          assert.equal(artists.length, 1); assert.equal(artists[0].trackFulfillment.length, 0);
        });
      } finally { gate.release(); await pending.catch(() => {}); await writer?.catch(() => {}); await change.reset?.(); }
    }
  }));
});
