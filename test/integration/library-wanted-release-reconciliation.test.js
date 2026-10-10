/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createBackupRestoreScopeApplyService } from '../../src/server/recovery/backup-restore-scope-apply-service.js';
import { createLibraryWantedReleaseService } from '../../src/server/library/library-wanted-release-service.js';
import { createLibraryWantedReleaseReader } from '../../src/server/library/library-wanted-release-reader.js';
import { createLibraryWantedReleaseStore } from '../../src/server/library/library-wanted-release-store.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { lockLibraryRequestProjection } from '../../src/server/library/library-request-projection-lock-store.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { createOperatorArtistMonitoringStore } from '../../src/server/metadata/operator-artist-monitoring-store.js';
import { createOperatorReleaseGroupSelectionStore } from '../../src/server/metadata/operator-release-group-selection-store.js';
import { createOperatorTrackOverrideStore } from '../../src/server/metadata/operator-track-override-store.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createLibraryDiscoveryWorker } from '../../src/server/library/library-discovery-worker.js';
import { createMetadataArtistRefreshWorker } from '../../src/server/metadata/metadata-artist-refresh-worker.js';
import { createMetadataRefreshService } from '../../src/server/metadata/metadata-refresh-service.js';
import { createFixtureGate, createFixtureWorkerObserver, waitForFixtureReady, withFixtureLifecycle }
  from '../../testing/integration/fixture-lifecycle.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
let reportedVersion = false;
const gate = createFixtureGate;
const rows = async (c) => (await c.pool.query('SELECT * FROM library_wanted_releases ORDER BY app_user_id,metadata_release_id')).rows;
const links = async (c) => (await c.pool.query('SELECT * FROM library_discovery_request_wanted_release_links ORDER BY discovery_request_id,wanted_release_id')).rows;
const state = async (c) => ({ wanted: await rows(c), links: await links(c) });
const parent = async (c, runId) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [runId])).rows[0];
const pause = (ms) => new Promise((done) => { setTimeout(done, ms); });
const expire = (c, lease) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [lease.leaseKey]);

function wanted(user, metadata) {
  return { appUserId: user, metadataArtistId: metadata.metadataArtistId,
    metadataReleaseGroupId: metadata.metadataReleaseGroupId, metadataReleaseId: metadata.metadataReleaseId,
    wantedStatus: 'missing', expectedTrackCount: 1, matchedTrackCount: 0, missingTrackCount: 1,
    releaseDate: '1994-11-07', releaseStatus: 'Official', evidence: { restoredIntent: true } };
}
function discovery(metadata) {
  return { metadataArtistId: metadata.metadataArtistId, metadataReleaseGroupId: metadata.metadataReleaseGroupId,
    metadataReleaseId: metadata.metadataReleaseId, wantedStatus: 'missing', searchMode: 'automatic', requestStatus: 'ready',
    blockedReason: null, releaseDate: '1994-11-07', lastSearchAt: null, nextSearchAfter: '2026-01-01T00:00:00.000Z',
    manualRequestedAt: null, searchAttemptCount: 0, researchAttemptCount: 0, evidence: { fixture: true } };
}
async function waitForBlock(c, holderPid) {
  for (let count = 0; count < 100; count += 1) {
    if ((await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid])).rowCount) return;
    await pause(10);
  }
  assert.fail('Expected an actual PostgreSQL publication/target wait');
}
async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn, phaseObserver }) => {
    await phaseObserver.measure('schema_prepare', () => applyPendingMigrations({ getPoolFn }));
    const context = await phaseObserver.measure('fixture_seed', async () => {
    const pool = getPoolFn();
    if (!reportedVersion) { t.diagnostic((await pool.query('SELECT version() AS version')).rows[0].version); reportedVersion = true; }
    const metadata = await seedMetadataReleaseFixture({ queryable: pool });
    const stale = await seedMetadataReleaseFixture({ queryable: pool, releaseTitle: 'Previous intent' });
    const users = [];
    for (const disabled of [false, true]) users.push((await pool.query(`INSERT INTO app_users
      (username,password_hash,role,must_change_password,is_disabled) VALUES ($1,'controlled','admin',FALSE,$2) RETURNING id`,
    [`wanted-${randomUUID()}`, disabled])).rows[0].id);
    const monitoring = createOperatorArtistMonitoringStore({ getPoolFn });
    const monitor = (user, source = metadata, patch = {}) => monitoring.upsertOperatorArtistMonitoring({
      appUserId: user, metadataArtistId: source.metadataArtistId, isMonitored: true,
      monitoredReleaseGroupTypes: ['album'], releaseScope: 'current_and_future', wantedAutomationMode: 'current_and_future_matching',
      acquisitionProfileKey: 'balanced_library', searchOnAddMode: 'missing_now', selectionSourceMode: 'policy_plus_overrides', ...patch });
    for (const user of users) await monitor(user);
    const raw = createLibraryWantedReleaseStore({ getPoolFn });
    const discoveryStore = createLibraryDiscoveryRequestStore({ getPoolFn });
    const reader = createLibraryWantedReleaseReader();
    const initial = await reader.readWantedReleaseProjection({ queryable: pool });
    assert.equal(initial.wantedReleases.length, 2);
    await raw.replaceLibraryWantedReleases({ wantedReleases: [...initial.wantedReleases, wanted(users[0], stale)] });
    await discoveryStore.replaceLibraryDiscoveryRequests({ discoveryRequests: [discovery(metadata), discovery(stale)] });
    await pool.query(`UPDATE library_discovery_request_wanted_release_links SET evidence=$1::jsonb`,
      [JSON.stringify({ initialSearchId: 'saved-search', qualityOverride: { mode: 'allow_fallback_quality', minimumBitrateKbps: 320 } })]);
    const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
    const maintenance = createMaintenanceLockService({ getPoolFn });
    const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
    const assertMaintenanceWriteAllowed = ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable });
    const makeRuns = (operationType = 'library_scan') => createOperationRunStore({ getPoolFn, operationType, leaseJobType: operationType,
      createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId: 'same-wanted-worker', leaseDurationMs: 60_000 }) });
    const makeService = (hooks = {}) => {
      let readCount = 0; const mutations = [];
      return { mutations, ...createLibraryWantedReleaseService({ getPoolFn, withTransaction: hooks.withTransaction ?? withTransaction,
        assertMaintenanceWriteAllowed,
        projectionReader: { readWantedReleaseProjection: async (input) => {
          const result = await reader.readWantedReleaseProjection(input); readCount += 1;
          await hooks.afterRead?.({ ...input, result, index: readCount }); return result;
        } },
        libraryWantedReleaseStore: { replaceLibraryWantedReleases: async (input) => {
          const queryable = { query: async (sql, values) => {
            if (/DELETE FROM library_wanted_releases/u.test(sql)) mutations.push('delete');
            if (/INSERT INTO library_wanted_releases/u.test(sql)) mutations.push('upsert');
            return input.queryable.query(sql, values);
          } };
          const result = await raw.replaceLibraryWantedReleases({ ...input, queryable,
            beforeWrite: async (stage) => { await input.beforeWrite(stage); await hooks.beforeMutation?.({ ...stage, queryable }); } });
          await hooks.afterReplace?.({ ...input, result }); return result;
        } },
      }) };
    };
    const open = async (operationType = 'library_scan', summary = {}) => {
      const runs = makeRuns(operationType);
      const run = await runs.createOperationRun({ status: 'pending', summary });
      const lease = await runs.acquireLease({ runId: run.id });
      assert.equal(await runs.markRunStarted({ runId: run.id, expectedLease: lease, summary }), true);
      return { runs, run, lease, input: { workerContext: { operationType, runId: run.id, expectedLease: lease } } };
    };
    return { pool, getPoolFn, metadata, stale, users, monitoring, monitor, raw, discoveryStore, reader,
      withTransaction, maintenance, assertMaintenanceWriteAllowed, makeRuns, makeService, open, signal: t.signal };
    });
    await phaseObserver.measure('scenario_work', () => callback(context));
  });
}
async function scanWorker(c, runs, run, reconcile, signal = c.signal) {
  let lease; const later = [];
  const root = resolve('.tmp', 'wanted-projection-controlled-root');
  const callbacks = { ...runs,
    acquireLease: async (input) => { lease = await runs.acquireLease(input); return lease; },
    executeScan: async () => ({ libraryRoot: root, filesSeen: 0 }),
    recordLibraryScanCatalogue: async () => ({ files: [], libraryRootId: randomUUID(), observedFileCount: 0 }),
    reconcileWantedReleases: reconcile, reconcileDiscoveryRequests: async () => later.push('discovery'),
  };
  const observer = createFixtureWorkerObserver({ callbacks });
  const worker = createLibraryScanWorker({ ...callbacks, ...observer.callbacks,
    isCancellationRequested: async (input) => signal?.aborted || await runs.isCancellationRequested(input),
  });
  await worker.startWorkerRun({ runId: run.id, libraryRoot: root });
  return { done: observer.finished, lease: () => lease, later };
}

suite('Current operator inputs own wanted rows and discovery links', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a delayed old scan cannot clear or overwrite the replacement owner publication', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const empty of [false, true]) await scenario(t, async (c) => withFixtureLifecycle({ signal: c.signal }, async (scope) => {
      const runs = c.makeRuns(); const run = await runs.createOperationRun({ status: 'pending', summary: {} });
      if (empty) await c.pool.query('UPDATE operator_artist_monitoring SET is_monitored=FALSE');
      const entered = gate({ signal: scope.signal }); const resume = gate({ signal: scope.signal }); const owner = c.makeService();
      scope.onRelease(() => resume.release());
      const old = await scanWorker(c, runs, run, async (input) => {
        const diagnostic = await c.reader.readWantedReleaseProjection({ queryable: c.pool });
        assert.equal(diagnostic.wantedReleases.length === 0, empty);
        entered.release(); await resume.promise;
        return owner.reconcileWantedReleases(input);
      }, scope.signal);
      scope.track(old.done);
      await waitForFixtureReady({ ready: entered.promise, operation: old.done, signal: scope.signal }); await expire(c, old.lease());
      await c.pool.query("UPDATE operator_artist_monitoring SET is_monitored=TRUE,acquisition_profile_key='lossless_archive'");
      const replacement = await scanWorker(c, c.makeRuns(), run, c.makeService().reconcileWantedReleases, scope.signal);
      scope.track(replacement.done); await replacement.done;
      const published = await state(c); const completed = await parent(c, run.id);
      assert.equal(published.wanted.length, 2); assert.equal(completed.status, 'completed');
      assert.notEqual(old.lease().acquisitionId, replacement.lease().acquisitionId);
      resume.release(); await old.done;
      assert.deepEqual(await state(c), published); assert.deepEqual(await parent(c, run.id), completed);
      assert.deepEqual(owner.mutations, []); assert.deepEqual(old.later, []);
    }));
  });

  test('direct projection uses one connection, keeps disabled recipients, stable IDs and saved link evidence', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const previous = await state(c);
    const singlePool = new pg.Pool({ ...c.pool.options, password: c.pool.options.password, max: 1, connectionTimeoutMillis: 1000 });
    const oneConnection = createDatabaseTransactionRunner({ getPoolFn: () => singlePool });
    try {
      const result = await c.makeService({ withTransaction: oneConnection }).reconcileWantedReleases();
      assert.equal(result.wantedKeys.length, 2); assert.equal(result.deletedWantedKeys.length, 1);
      const current = await state(c);
      for (const row of current.wanted) assert.equal(row.id, previous.wanted.find((old) => old.app_user_id === row.app_user_id
        && old.metadata_release_id === row.metadata_release_id).id);
      for (const link of current.links) assert.deepEqual(link.evidence, previous.links.find((old) => old.wanted_release_id === link.wanted_release_id).evidence);
      assert.equal(current.wanted.some((row) => row.app_user_id === c.users[1]), true);
      const availability = createLibraryReleaseReconciliationStore({ getPoolFn: c.getPoolFn });
      await availability.replaceLibraryReleaseReconciliations({ reconciliations: [{ metadataArtistId: c.metadata.metadataArtistId,
        metadataReleaseGroupId: c.metadata.metadataReleaseGroupId, metadataReleaseId: c.metadata.metadataReleaseId,
        reconciliationStatus: 'partial', expectedTrackCount: 2, matchedTrackCount: 1, missingTrackCount: 1, matchedFileCount: 1, duplicateTrackCount: 0 }] });
      await c.makeService({ withTransaction: oneConnection }).reconcileWantedReleases();
      assert.equal((await rows(c)).every((row) => row.wanted_status === 'partial' && row.missing_track_count === 1), true);
      await c.pool.query("UPDATE library_release_reconciliations SET reconciliation_status='complete',matched_track_count=2,missing_track_count=0");
      const empty = await c.makeService({ withTransaction: oneConnection }).reconcileWantedReleases();
      assert.deepEqual(empty.wantedKeys, []); assert.equal(empty.deletedWantedKeys.length, 2);
      assert.deepEqual(await state(c), { wanted: [], links: [] });
    } finally { await singlePool.end(); }
  }));

  test('policy, selections, overrides, availability, metadata and recipient phantoms refuse a stale input frame', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const change of ['monitoring', 'profile', 'selection', 'override', 'availability', 'metadata', 'new_monitor', 'new_artist', 'artist_delete', 'user_delete']) await scenario(t, async (c) => withFixtureLifecycle({ signal: c.signal }, async (scope) => {
      const active = await c.open(); const entered = gate({ signal: scope.signal }); const resume = gate({ signal: scope.signal });
      scope.onRelease(() => resume.release());
      const owner = c.makeService({ afterRead: async ({ index }) => { if (index === 1) { entered.release(); await resume.promise; } } });
      const pending = owner.reconcileWantedReleases(active.input);
      // The explicit rejection assertion below owns this expected failure.
      scope.track(pending.catch(() => {}));
      await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: scope.signal });
      t.diagnostic(`Observed initial ${change} decision frame before the competing writer`);
      let current; let mutationError;
      try {
      if (change === 'monitoring') await c.pool.query("UPDATE operator_artist_monitoring SET release_scope='future_only'");
      if (change === 'profile') await c.pool.query("UPDATE operator_artist_monitoring SET acquisition_profile_key='storage_saver'");
      if (change === 'selection') await createOperatorReleaseGroupSelectionStore({ getPoolFn: c.getPoolFn }).upsertOperatorReleaseGroupSelection({
        appUserId: c.users[0], metadataArtistId: c.metadata.metadataArtistId, metadataReleaseGroupId: c.metadata.metadataReleaseGroupId,
        resolvedMetadataReleaseId: c.metadata.metadataReleaseId, selectionState: 'unselected', selectionSource: 'manual', selectionOrigin: 'manual_inclusion' });
      if (change === 'override') await createOperatorTrackOverrideStore({ getPoolFn: c.getPoolFn }).upsertOperatorTrackOverride({
        appUserId: c.users[0], metadataArtistId: c.metadata.metadataArtistId, metadataReleaseGroupId: c.metadata.metadataReleaseGroupId,
        metadataReleaseId: c.metadata.metadataReleaseId,
        recordingMbid: (await c.pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1', [c.metadata.metadataRecordingId])).rows[0].musicbrainz_recording_id,
        mediumPosition: 1, trackPosition: 1, isDesired: false, remapStatus: 'resolved' });
      if (change === 'availability') await createLibraryReleaseReconciliationStore({ getPoolFn: c.getPoolFn }).replaceLibraryReleaseReconciliations({
        reconciliations: [{ metadataArtistId: c.metadata.metadataArtistId, metadataReleaseGroupId: c.metadata.metadataReleaseGroupId,
          metadataReleaseId: c.metadata.metadataReleaseId, reconciliationStatus: 'complete', expectedTrackCount: 1,
          matchedTrackCount: 1, missingTrackCount: 0, matchedFileCount: 1, duplicateTrackCount: 0 }] });
      if (change === 'metadata') await c.pool.query('UPDATE metadata_releases SET track_count=2,title=title||$1 WHERE id=$2', [' changed', c.metadata.metadataReleaseId]);
      if (change === 'new_monitor') await c.monitor(c.users[0], c.stale);
      if (change === 'new_artist') { const added = await seedMetadataReleaseFixture({ queryable: c.pool }); await c.monitor(c.users[0], added); }
      if (change === 'artist_delete') await c.pool.query('DELETE FROM metadata_artists WHERE id=$1', [c.metadata.metadataArtistId]);
      if (change === 'user_delete') await c.pool.query('DELETE FROM app_users WHERE id=$1', [c.users[1]]);
      current = await state(c);
      } catch (error) { mutationError = error; }
      finally { resume.release(); }
      if (mutationError) { await pending.catch(() => {}); throw mutationError; }
      await assert.rejects(pending, (error) => error.code === 'library_wanted_projection_stale');
      assert.deepEqual(await state(c), current); assert.deepEqual(owner.mutations, []);
      await active.runs.releaseLease({ runId: active.run.id, expectedLease: active.lease, status: 'failed' });
    }));
  });

  test('discovery and metadata workers forward original authority while direct refresh and explicit selection remain valid', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    for (const operationType of ['library_discovery_dispatch', 'metadata_artist_refresh']) {
      const runs = c.makeRuns(operationType); const run = await runs.createOperationRun({ status: 'pending', summary: {} });
      const done = gate(); const contexts = []; const owner = c.makeService();
      const reconcile = async (input) => { contexts.push(structuredClone(input)); return owner.reconcileWantedReleases(input); };
      const dependencies = { ...runs, releaseLease: async (input) => { try { return await runs.releaseLease(input); } finally { done.release(); } } };
      let worker;
      if (operationType === 'library_discovery_dispatch') worker = createLibraryDiscoveryWorker({ ...dependencies,
        reconcileWantedReleases: reconcile, dispatchDiscoveryRequests: async () => ({ results: [], attemptedCount: 0, dispatchedCount: 0 }) });
      else {
        const refresh = createMetadataRefreshService({
          metadataService: { storeArtist: async () => ({ id: c.metadata.metadataArtistId }) },
          musicBrainzClient: { lookupArtist: async () => ({ id: c.metadata.musicBrainzArtistId, name: 'Autechre' }),
            browseArtistReleaseGroups: async () => ({ 'release-groups': [], 'release-group-count': 0 }) },
          reconcileWantedReleases: reconcile,
        });
        worker = createMetadataArtistRefreshWorker({ ...dependencies, refreshMetadataArtist: refresh.refreshArtistCatalogById });
        await refresh.refreshArtistCatalogById({ musicBrainzArtistId: c.metadata.musicBrainzArtistId, runId: 'history-only' });
        assert.deepEqual(contexts.pop(), {});
      }
      await worker.startWorkerRun({ runId: run.id, metadataArtistId: c.metadata.metadataArtistId, musicBrainzArtistId: c.metadata.musicBrainzArtistId });
      await done.promise;
      assert.equal(contexts[0].workerContext.operationType, operationType); assert.equal(contexts[0].workerContext.runId, run.id);
      assert.equal(typeof contexts[0].workerContext.expectedLease.acquisitionId, 'string');
      assert.equal((await parent(c, run.id)).status, 'completed');
    }
    await c.pool.query("UPDATE operator_artist_monitoring SET wanted_automation_mode='manual_only',release_scope='track_only'");
    await createOperatorReleaseGroupSelectionStore({ getPoolFn: c.getPoolFn }).upsertOperatorReleaseGroupSelection({
      appUserId: c.users[0], metadataArtistId: c.metadata.metadataArtistId, metadataReleaseGroupId: c.metadata.metadataReleaseGroupId,
      resolvedMetadataReleaseId: c.metadata.metadataReleaseId, selectionState: 'selected', selectionSource: 'manual', selectionOrigin: 'manual_inclusion' });
    await c.makeService().reconcileWantedReleases();
    assert.deepEqual((await rows(c)).map((row) => row.app_user_id), [c.users[0]]);
    assert.equal((await rows(c))[0].evidence.selectionSource, 'manual');
  }));

  test('maintenance, cancellation and actual publication or wanted-row waits crossing expiry cannot publish', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const kind of ['maintenance', 'cancel', 'publication_wait', 'wanted_wait']) await scenario(t, async (c) => {
      const active = await c.open(); const original = await state(c); const owner = c.makeService();
      if (kind === 'maintenance') {
        const lock = await c.maintenance.acquireMaintenanceLock({ lockType: 'restore' });
        await assert.rejects(owner.reconcileWantedReleases(active.input)); await c.maintenance.releaseMaintenanceLock({ lockId: lock.id });
      } else if (kind === 'cancel') {
        await c.pool.query('UPDATE operation_runs SET cancel_requested_at=clock_timestamp() WHERE id=$1', [active.run.id]);
        await assert.rejects(owner.reconcileWantedReleases(active.input));
      } else {
        const held = await c.pool.connect(); await held.query('BEGIN');
        try {
          if (kind === 'publication_wait') await lockLibraryRequestProjection({ queryable: held });
          else await held.query('SELECT id FROM library_wanted_releases WHERE app_user_id=$1 AND metadata_release_id=$2 FOR UPDATE', [c.users[0], c.metadata.metadataReleaseId]);
          const holder = (await held.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
          await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '500 milliseconds' WHERE lease_key=$1", [active.lease.leaseKey]);
          const pending = owner.reconcileWantedReleases(active.input);
          await waitForBlock(c, holder); await pause(600); await held.query('COMMIT');
          await assert.rejects(pending, (error) => error.code === 'operation_run_lease_lost');
        } finally { await held.query('ROLLBACK'); held.release(); }
      }
      assert.deepEqual(await state(c), original);
      await active.runs.releaseLease({ runId: active.run.id, expectedLease: active.lease, status: 'failed' });
    });
  });

  test('raw wanted and discovery parent publishers serialize before mutations and retain exact shared links', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const first of ['wanted', 'discovery']) await scenario(t, async (c) => withFixtureLifecycle({ signal: c.signal }, async (scope) => {
      const entered = gate({ signal: scope.signal }); const resume = gate({ signal: scope.signal }); let holder; let paused = false; const secondMutations = [];
      scope.onRelease(() => resume.release());
      const wrappedPool = { connect: async () => {
        const client = await c.pool.connect(); return { release: () => client.release(), query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (!paused && /pg_advisory_xact_lock/u.test(sql) && values?.[0] === 'harmoniarr.library-request-projection') {
            paused = true; holder = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            entered.release(); await resume.promise;
          }
          return result;
        } };
      } };
      const desired = [wanted(c.users[0], c.metadata), wanted(c.users[1], c.metadata)];
      const firstPromise = first === 'wanted'
        ? createLibraryWantedReleaseStore({ getPoolFn: () => wrappedPool }).replaceLibraryWantedReleases({ wantedReleases: desired })
        : createLibraryDiscoveryRequestStore({ getPoolFn: () => wrappedPool }).replaceLibraryDiscoveryRequests({ discoveryRequests: [discovery(c.metadata)] });
      scope.track(firstPromise);
      await waitForFixtureReady({ ready: entered.promise, operation: firstPromise, signal: scope.signal });
      const secondPool = { connect: async () => {
        const client = await c.pool.connect(); return { release: () => client.release(), query: async (sql, values) => {
          if (/DELETE FROM library_(wanted_releases|discovery_requests)/u.test(sql)) secondMutations.push('delete');
          return client.query(sql, values);
        } };
      } };
      const secondPromise = first === 'wanted'
        ? createLibraryDiscoveryRequestStore({ getPoolFn: () => secondPool }).replaceLibraryDiscoveryRequests({ discoveryRequests: [discovery(c.metadata)] })
        : createLibraryWantedReleaseStore({ getPoolFn: () => secondPool }).replaceLibraryWantedReleases({ wantedReleases: desired });
      scope.track(secondPromise);
      await waitForBlock(c, holder); assert.deepEqual(secondMutations, []);
      resume.release(); await Promise.all([firstPromise, secondPromise]);
      const current = await state(c); assert.equal(current.wanted.length, 2); assert.equal(current.links.length, 2);
      assert.equal((await c.pool.query('SELECT * FROM library_discovery_requests')).rowCount, 1);
      assert.deepEqual(new Set(current.links.map((link) => link.wanted_release_id)), new Set(current.wanted.map((row) => row.id)));
    }));
  });

  test('DELETE, second bulk row, link sync, incomplete return and final source or lease faults roll the entire publication back', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const fault of ['delete', 'upsert', 'links', 'returning', 'final_source', 'final_lease']) await scenario(t, async (c) => {
      const active = await c.open();
      const secondUser = [...c.users].sort()[1];
      await c.pool.query('DELETE FROM library_discovery_request_wanted_release_links WHERE wanted_release_id=(SELECT id FROM library_wanted_releases WHERE app_user_id=$1 AND metadata_release_id=$2)', [secondUser, c.metadata.metadataReleaseId]);
      const previous = await state(c);
      if (['delete', 'upsert', 'returning', 'links'].includes(fault)) {
        const target = fault === 'links' ? 'library_discovery_request_wanted_release_links' : 'library_wanted_releases';
        const body = fault === 'returning' ? `IF NEW.app_user_id='${secondUser}'::uuid THEN RETURN NULL; END IF; RETURN NEW;`
          : fault === 'upsert' ? `IF NEW.app_user_id='${secondUser}'::uuid THEN RAISE EXCEPTION 'controlled second row failure'; END IF; RETURN NEW;`
            : "RAISE EXCEPTION 'controlled required publication failure';";
        await c.pool.query(`CREATE FUNCTION controlled_wanted_fault() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN ${body} END$$`);
        await c.pool.query(`CREATE TRIGGER controlled_wanted_fault BEFORE ${fault === 'delete' ? 'DELETE' : 'INSERT'} ON ${target} FOR EACH ROW EXECUTE FUNCTION controlled_wanted_fault()`);
      }
      const owner = c.makeService({ afterReplace: async ({ queryable }) => {
        if (fault === 'final_source') await queryable.query("UPDATE operator_artist_monitoring SET acquisition_profile_key='storage_saver'");
        if (fault === 'final_lease') await queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [active.lease.leaseKey]);
      } });
      await assert.rejects(owner.reconcileWantedReleases(active.input));
      assert.deepEqual(await state(c), previous);
      if (fault === 'final_source') assert.equal((await c.pool.query('SELECT acquisition_profile_key FROM operator_artist_monitoring')).rows.every((row) => row.acquisition_profile_key === 'balanced_library'), true);
      if (fault === 'final_lease') assert.equal((await c.pool.query('SELECT expires_at>clock_timestamp() AS live FROM job_leases WHERE lease_key=$1', [active.lease.leaseKey])).rows[0].live, true);
      await active.runs.releaseLease({ runId: active.run.id, expectedLease: active.lease, status: 'failed' });
    });
  });

  test('authorized raw restore remains valid under maintenance while malformed worker contexts and scoped discovery refuse', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const lock = await c.maintenance.acquireMaintenanceLock({ lockType: 'restore' });
    const restore = createBackupRestoreScopeApplyService({ replaceLibraryWantedReleases: c.raw.replaceLibraryWantedReleases });
    const restored = [wanted(c.users[0], c.stale)];
    const result = await restore.applyRestoreScopes({ artifactScope: ['wanted'], parsedPayload: { data: { scopeSettings: { wanted: { wantedReleases: restored } } } } });
    assert.deepEqual(result.appliedScopes, ['wanted']); assert.equal(result.wantedUpdated, true);
    assert.equal((await rows(c))[0].metadata_release_id, c.stale.metadataReleaseId);
    assert.equal((await links(c)).length, 1);
    const preserved = await state(c);
    const skipped = await restore.applyRestoreScopes({ artifactScope: ['wanted'], parsedPayload: { data: { scopeSettings: { wanted: { wantedReleases: [] } } } } });
    assert.deepEqual(skipped.skippedScopes, ['wanted']); assert.deepEqual(await state(c), preserved);
    await assert.rejects(c.makeService().reconcileWantedReleases()); assert.deepEqual(await state(c), preserved);
    await c.maintenance.releaseMaintenanceLock({ lockId: lock.id });
    for (const workerContext of [undefined, null, {}, { operationType: 'library_scan' }, { operationType: 'unknown', runId: randomUUID(), expectedLease: {} }]) {
      await assert.rejects(c.makeService().reconcileWantedReleases({ workerContext })); assert.deepEqual(await state(c), preserved);
    }
    const scoped = await c.open('library_discovery_dispatch', { triggerSource: 'music_queue_fallback_rediscovery' });
    await assert.rejects(c.makeService().reconcileWantedReleases(scoped.input)); assert.deepEqual(await state(c), preserved);
    await scoped.runs.releaseLease({ runId: scoped.run.id, expectedLease: scoped.lease, status: 'failed' });
    await c.makeService().reconcileWantedReleases(); assert.equal((await rows(c)).length, 2);
  }));

  test('raw restore canonicalizes accepted UUID spellings and equivalent duplicates without replacing row or link identity', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const original = await state(c);
    const retained = original.wanted.find((row) => row.app_user_id === c.users[0] && row.metadata_release_id === c.metadata.metadataReleaseId);
    const retainedLink = original.links.find((link) => link.wanted_release_id === retained.id);
    const lock = await c.maintenance.acquireMaintenanceLock({ lockType: 'restore' });
    const results = [];
    const restore = createBackupRestoreScopeApplyService({ replaceLibraryWantedReleases: async (input) => {
      const result = await c.raw.replaceLibraryWantedReleases(input); results.push(result); return result;
    } });
    const spellings = [
      (id) => id.toUpperCase(),
      (id) => `{${id}}`,
      (id) => id.replaceAll('-', ''),
    ];
    const alternate = (spell, marker) => {
      const row = wanted(c.users[0], c.metadata);
      for (const field of ['appUserId', 'metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId']) row[field] = spell(row[field]);
      return { ...row, evidence: { restoredSpelling: marker } };
    };
    const apply = async (wantedReleases) => {
      const result = await restore.applyRestoreScopes({ artifactScope: ['wanted'],
        parsedPayload: { data: { scopeSettings: { wanted: { wantedReleases } } } } });
      assert.equal(result.wantedUpdated, true);
      assert.deepEqual(results.at(-1).wantedKeys, [{ appUserId: c.users[0], metadataReleaseId: c.metadata.metadataReleaseId }]);
      assert.equal((await rows(c))[0].id, retained.id);
      assert.deepEqual(await links(c), [retainedLink]);
    };
    try {
      for (const [index, spell] of spellings.entries()) await apply([alternate(spell, index)]);
      assert.equal(results[0].deletedWantedKeys.length, 2);
      assert.equal(results[0].deletedWantedKeys.every((key) => original.wanted.some((row) => row.app_user_id === key.appUserId
        && row.metadata_release_id === key.metadataReleaseId && row.id !== retained.id)), true);
      const duplicates = [wanted(c.users[0], c.metadata), ...spellings.map((spell, index) => alternate(spell, index))];
      duplicates.at(-1).wantedStatus = 'partial'; duplicates.at(-1).expectedTrackCount = 4;
      duplicates.at(-1).matchedTrackCount = 1; duplicates.at(-1).missingTrackCount = 3;
      await apply(duplicates);
      const [saved] = await rows(c);
      assert.equal(saved.wanted_status, 'partial'); assert.equal(saved.expected_track_count, 4);
      assert.equal(saved.matched_track_count, 1); assert.equal(saved.missing_track_count, 3);
      assert.deepEqual(saved.evidence, { restoredSpelling: 2 });
      assert.deepEqual(results.at(-1).deletedWantedKeys, []);
    } finally { await c.maintenance.releaseMaintenanceLock({ lockId: lock.id }); }
  }));

  test('fixture readiness failures and cancellation drain the actual wanted transaction before teardown and preserve the primary error', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const mode of ['failure_before_ready', 'cancel_while_held']) await scenario(t, async (c) => {
      const previous = await state(c); const primary = new Error(`Controlled ${mode}`);
      const controller = new AbortController(); const entered = gate(); const order = [];
      const operation = withFixtureLifecycle({ signal: AbortSignal.any([c.signal, controller.signal]) }, async (scope) => {
        const resume = gate({ signal: scope.signal });
        scope.onRelease(() => { order.push('release'); resume.release(); throw new Error('Controlled secondary cleanup failure'); });
        const owner = c.makeService({ afterRead: async ({ index }) => {
          if (index !== 1) return;
          if (mode === 'failure_before_ready') throw primary;
          entered.release(); await resume.promise;
        } });
        const pending = scope.track(owner.reconcileWantedReleases());
        pending.then(() => order.push('transaction settled'), () => order.push('transaction settled'));
        await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: scope.signal });
        await pending;
      });
      operation.catch(() => {});
      if (mode === 'cancel_while_held') {
        await waitForFixtureReady({ ready: entered.promise, operation }); controller.abort(primary);
      }
      await assert.rejects(operation, (error) => error === primary);
      assert.equal(order.includes('release'), true); assert.equal(order.includes('transaction settled'), true);
      assert.deepEqual(await state(c), previous);
      assert.equal((await c.pool.query(`SELECT count(*)::integer AS count FROM pg_stat_activity
        WHERE datname=current_database() AND state='idle in transaction'`)).rows[0].count, 0);
    });
  });
});
