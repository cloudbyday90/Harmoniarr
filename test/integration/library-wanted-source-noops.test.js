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
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { withFixturePostgresObserver } from '../../testing/integration/fixture-postgres-observer.js';
import { waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { seedWantedDistinctBindingProfile } from '../../testing/integration/wanted-distinct-binding-fixture.js';
import { withWantedProfileClient } from '../../testing/integration/wanted-profile-client.js';
import { profileWantedGuardedReconciliation } from '../../testing/integration/wanted-guarded-profile.js';
import { compareWantedSourceNoopSamples } from '../../testing/integration/wanted-source-noop-profile-policy.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createWantedVerificationObserver } from '../../src/server/library/library-wanted-verification-observer.js';
import { lockLibraryRootAuthority } from '../../src/server/library/library-root-authority-lock-store.js';
import { withWantedRootReadAuthority } from '../../src/server/library/wanted-root-read-authority-service.js';
import { tryLockedOperatorTrackSourceNoop } from '../../src/server/metadata/operator-track-source-noop-store.js';
import { createOperatorTrackSourceLifecycleService } from '../../src/server/metadata/operator-track-source-lifecycle-service.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; const active = new Set();
async function saved(pool) {
  const result = {};
  for (const table of ['library_wanted_releases', 'library_discovery_request_wanted_release_links', 'media_requests', 'media_request_events']) {
    const order = table === 'library_discovery_request_wanted_release_links' ? 'discovery_request_id,wanted_release_id' : 'id';
    result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows;
  }
  return result;
}

suite('Transaction-held positive source no-ops through canonical Wanted', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  test('four real bindings prove exact no-ops, retained final authority, write/event rollback and lock lifetime', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    const operation = withIntegrationApp({ config,
      withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver, signal: t.signal }),
      run: input => withFixtureLifecycle({ signal: t.signal }, async scope => {
        const c = await seedWantedDistinctBindingProfile(input.workspaceDir, { bindings: 4, mediaProfile: 'sine', durationSeconds: 2, signal: scope.signal });
        const { pool } = c; const baseline = await saved(pool);
        t.diagnostic(`PostgreSQL ${(await pool.query('SHOW server_version')).rows[0].server_version}`);
        const receipts = (await pool.query('SELECT receipt FROM operator_track_receipts ORDER BY app_user_id,import_candidate_id')).rows;
        const receipt = receipts[0].receipt;
        const source = { ownerId: receipt.ownerId, mediaRequestId: receipt.sourceMediaRequestId,
          importCandidateId: 'unused-noop-marker', scope: receipt.scope, available: true };
        await withRollbackFixtureClient(pool, async client => {
          await lockLibraryRootAuthority({ queryable: client }); let captured;
          await withWantedRootReadAuthority({ queryable: client }, async rootReadAuthority => {
            captured = rootReadAuthority;
            assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable: client, rootReadAuthority }), true);
            for (const patch of [{ available: false }, { mediaRequestId: '11111111-1111-4111-8111-111111111111' },
              { ownerId: '11111111-1111-4111-8111-111111111111' }, { scope: { ...source.scope, tracks: [] } }]) {
              assert.equal(await tryLockedOperatorTrackSourceNoop({ source: { ...source, ...patch }, queryable: client, rootReadAuthority }), false);
            }
            assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable: { query: client.query.bind(client) }, rootReadAuthority }), false);
            await client.query("UPDATE media_requests SET request_state='needs_fetch' WHERE id=$1", [source.mediaRequestId]);
            assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable: client, rootReadAuthority }), false);
          });
          assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable: client, rootReadAuthority: captured }), false);
        });
        await withRollbackFixtureClient(pool, async client => {
          await lockLibraryRootAuthority({ queryable: client });
          await withWantedRootReadAuthority({ queryable: client }, async rootReadAuthority => {
            await client.query('COMMIT'); await client.query('BEGIN');
            assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable: client, rootReadAuthority }), false);
          });
        });
        for (const primary of [new Error('Original optional lock failure'), null]) await withRollbackFixtureClient(pool, async client => {
          const queryable = { query: async (...args) => {
            if (args[0].includes('FOR NO KEY UPDATE NOWAIT')) throw primary;
            return client.query(...args);
          } };
          await lockLibraryRootAuthority({ queryable });
          await assert.rejects(withWantedRootReadAuthority({ queryable }, rootReadAuthority =>
            tryLockedOperatorTrackSourceNoop({ source, queryable, rootReadAuthority })), error => error === primary);
        });
        await withWantedProfileClient(pool, async borrowed => {
          const samples = [];
          for (const sourceTransitionMode of ['compatibility', 'locked-noop']) samples.push(await profileWantedGuardedReconciliation(borrowed, {
            rootReadMode: 'bounded', sourceTransitionMode, captureDurable: true, receiptGrouping: true, signal: scope.signal, gc: () => {} }));
          compareWantedSourceNoopSamples(...samples, { bindings: 4, fileSizes: c.fileSizes });
          const holder = await pool.connect();
          try {
            await holder.query('BEGIN'); await holder.query('SELECT id FROM media_requests WHERE id=$1 FOR UPDATE', [source.mediaRequestId]);
            const busy = await profileWantedGuardedReconciliation(borrowed, { rootReadMode: 'bounded', sourceTransitionMode: 'locked-noop',
              receiptGrouping: true, captureDurable: true, signal: scope.signal, gc: () => {} });
            assert.equal(busy.diagnostics.counters.sourceNoops, 3); assert.equal(busy.diagnostics.counters.sourceTransitionAttempts, 1);
            assert.equal(busy.diagnostics.counters.projectionReads, 6); assert.equal(busy.diagnostics.counters.fingerprintCalls, 48);
            assert.deepEqual(busy.result, samples[0].result); assert.deepEqual(busy.durable, samples[0].durable);
          } finally { await holder.query('ROLLBACK'); holder.release(); }
        });
        assert.deepEqual(await saved(pool), baseline);

        const native = createOperatorTrackSourceLifecycleService(); let record;
        const make = hook => createLibraryWantedReleaseService({ getPoolFn: () => pool, assertMaintenanceWriteAllowed: async () => {},
          createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: value => { record = value; } }),
          trackSourceLifecycle: { reconcileSources: options => native.reconcileSources({ ...options, assertCurrent: async () => {
            await hook?.(options); await options.assertCurrent();
          } }) },
        });
        const path = c.files[2]; const bytes = await readFile(path); const marker = await stat(path);
        try {
          await assert.rejects(make(async () => {
            const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
            await writeFile(path, changed, { flag: 'r+' }); await utimes(path, marker.atime, marker.mtime);
          }).reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
          assert.equal(record.counters.sourceNoops, 4);
        } finally { await writeFile(path, bytes); await utimes(path, marker.atime, marker.mtime); }
        assert.deepEqual(await saved(pool), baseline);
        await assert.rejects(make(({ queryable }) => queryable.query('UPDATE app_users SET is_disabled=TRUE WHERE id=$1', [source.ownerId]))
          .reconcileWantedReleases(), { code: 'library_wanted_projection_stale' });
        assert.equal(record.counters.sourceNoops, 4); assert.deepEqual(await saved(pool), baseline);

        const runs = createOperationRunStore({ getPoolFn: () => pool, operationType: 'library_scan', leaseJobType: 'library_scan',
          createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn: () => pool, ownerInstanceId: 'noop-proof', leaseDurationMs: 60_000 }) });
        const run = await runs.createOperationRun({ status: 'pending', summary: {} }); const lease = await runs.acquireLease({ runId: run.id });
        assert.equal(await runs.markRunStarted({ runId: run.id, expectedLease: lease, summary: {} }), true);
        const workerContext = { operationType: 'library_scan', runId: run.id, expectedLease: lease };
        try {
          for (const fault of ['lease', 'cancel']) {
            const sql = fault === 'lease' ? "UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1"
              : 'UPDATE operation_runs SET cancel_requested_at=clock_timestamp() WHERE id=$1';
            await assert.rejects(make(({ queryable }) => queryable.query(sql, [fault === 'lease' ? lease.leaseKey : run.id]))
              .reconcileWantedReleases({ workerContext }), { code: fault === 'lease' ? 'operation_run_lease_lost' : 'operation_run_cancelled' });
            assert.equal(record.counters.sourceNoops, 4); assert.deepEqual(await saved(pool), baseline);
          }
        } finally { await runs.releaseLease({ runId: run.id, expectedLease: lease, status: 'failed' }); }

        await pool.query("UPDATE media_requests SET request_state='needs_fetch' WHERE id=$1", [source.mediaRequestId]);
        const pendingBaseline = await saved(pool);
        await withWantedProfileClient(pool, async borrowed => {
          const samples = [];
          for (const sourceTransitionMode of ['compatibility', 'locked-noop']) samples.push(await profileWantedGuardedReconciliation(borrowed, {
            rootReadMode: 'bounded', sourceTransitionMode, captureDurable: true, receiptGrouping: true, signal: scope.signal, gc: () => {} }));
          assert.deepEqual(samples[0].result, samples[1].result); assert.deepEqual(samples[0].durable, samples[1].durable);
          assert.equal(new Set([...samples[0].projectionDigests, ...samples[1].projectionDigests]).size, 1);
          assert.equal(samples[1].diagnostics.counters.sourceNoops, 3); assert.equal(samples[1].diagnostics.counters.sourceTransitionAttempts, 1);
          assert.equal(samples[1].diagnostics.counters.projectionReads, 6); assert.equal(samples[1].diagnostics.counters.fingerprintCalls, 48);
          assert.equal(samples[1].durable.media_request_events.length, pendingBaseline.media_request_events.length + 1);
        });
        assert.deepEqual(await saved(pool), pendingBaseline);
        await pool.query(`CREATE FUNCTION refuse_noop_source_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
          IF NEW.event_type IN ('operator_track_source_retired','operator_track_source_reopened') THEN
            RAISE EXCEPTION 'Controlled required no-op source event'; END IF; RETURN NEW; END $$;
          CREATE TRIGGER refuse_noop_source_event BEFORE INSERT ON media_request_events FOR EACH ROW EXECUTE FUNCTION refuse_noop_source_event()`);
        await assert.rejects(make().reconcileWantedReleases(), error => error.message.includes('Controlled required no-op source event'));
        assert.deepEqual(await saved(pool), pendingBaseline);
        await pool.query("UPDATE media_requests SET request_state='already_exists' WHERE id=$1", [source.mediaRequestId]);
        const negativeBaseline = await saved(pool);
        try {
          await writeFile(path, 'Controlled unavailable binding');
          await assert.rejects(make().reconcileWantedReleases(), error => error.message.includes('Controlled required no-op source event'));
          assert.deepEqual(await saved(pool), negativeBaseline);
        } finally { await writeFile(path, bytes); await utimes(path, marker.atime, marker.mtime); }
        await pool.query('DROP TRIGGER refuse_noop_source_event ON media_request_events; DROP FUNCTION refuse_noop_source_event()');

        for (const rollback of [false, true]) {
          const entered = createFixtureGate({ signal: scope.signal }); const gate = createFixtureGate({ signal: scope.signal });
          let holderPid; let writer; const primary = new Error('Controlled no-op publication rollback');
          const service = createLibraryWantedReleaseService({ getPoolFn: () => pool, assertMaintenanceWriteAllowed: async () => {},
            createVerificationObserver: () => createWantedVerificationObserver({ enabled: true, onRecord: value => { record = value; } }),
            trackSourceLifecycle: { reconcileSources: async options => {
              await native.reconcileSources(options); holderPid = (await options.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
              entered.release(); await gate.promise; if (rollback) throw primary;
            } },
          });
          const previous = await saved(pool); const pending = service.reconcileWantedReleases();
          // The expected rejection is asserted below; register its actual settlement for fixture drainage.
          scope.track(pending.catch(() => {}));
          try {
            await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: scope.signal });
            writer = pool.query("UPDATE media_requests SET request_state='needs_fetch' WHERE id=$1", [source.mediaRequestId]); void writer.catch(() => {});
            await withFixturePostgresObserver({ connectionConfig: input.databaseConfig, signal: scope.signal },
              observer => waitForFixturePostgresBlock({ queryable: observer, holderPid, operation: writer, signal: scope.signal }));
            gate.release();
            if (rollback) await assert.rejects(pending, error => error === primary); else await pending;
            assert.equal((await writer).rowCount, 1);
            assert.equal(record.counters.sourceNoops, 4); assert.equal(record.counters.projectionReads, 5);
            assert.equal(record.counters.fingerprintCalls, 40);
            if (rollback) {
              const expected = structuredClone(previous);
              expected.media_requests.find(row => row.id === source.mediaRequestId).request_state = 'needs_fetch';
              assert.deepEqual(await saved(pool), expected);
            }
          } finally {
            gate.release(); await pending.catch(() => {}); await writer?.catch(() => {});
            await pool.query("UPDATE media_requests SET request_state='already_exists' WHERE id=$1", [source.mediaRequestId]);
          }
        }
      }),
    });
    active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); await operation;
  });
});
