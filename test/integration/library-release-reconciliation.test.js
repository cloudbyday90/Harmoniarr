/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve, join, basename } from 'node:path';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';
import { createLibraryFileMatchService } from '../../src/server/library/library-file-match-service.js';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';
import { createLibraryTagSnapshotService } from '../../src/server/library/library-tag-snapshot-service.js';
import { captureTagSnapshotSource } from '../../src/server/library/library-tag-snapshot-policy.js';
import { createLibraryReleaseReconciliationStore } from '../../src/server/library/library-release-reconciliation-store.js';
import { createLibraryReleaseReconciliationService } from '../../src/server/library/library-release-reconciliation-service.js';
import { createLibraryReleaseReconciliationGuardStore } from '../../src/server/library/library-release-reconciliation-guard-store.js';
import { createLibraryReleaseCoverageStore } from '../../src/server/library/library-release-coverage-store.js';
import { mapReleaseCoverageRows } from '../../src/server/library/library-release-reconciliation-policy.js';
import { lockLibraryReleaseReconciliation } from '../../src/server/library/library-release-reconciliation-lock-store.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { deleteMetadataMediaByReleaseId, insertMetadataTrack, upsertMetadataArtist } from '../../src/server/metadata/metadata-repository.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
let reportedVersion = false;
function gate() {
  let release;
  const promise = new Promise((done) => { release = done; });
  return { promise, release };
}
const projection = async (c) => (await c.pool.query('SELECT * FROM library_release_reconciliations ORDER BY metadata_release_id')).rows;
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
const expire = (c, lease) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [lease.leaseKey]);
const matched = (file, metadata) => ({ libraryFileId: file.id, metadataArtistId: metadata.metadataArtistId,
  metadataReleaseGroupId: metadata.metadataReleaseGroupId, metadataReleaseId: metadata.metadataReleaseId,
  metadataMediumId: metadata.metadataMediumId, metadataTrackId: metadata.metadataTrackId,
  metadataRecordingId: metadata.metadataRecordingId, matchStatus: 'matched', confidence: 'high',
  matchedBy: 'controlled-reconciliation-fixture', evidence: { strategy: 'controlled-reconciliation-fixture' } });

async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn }); const pool = getPoolFn();
    if (!reportedVersion) { t.diagnostic((await pool.query('SELECT version() AS version')).rows[0].version); reportedVersion = true; }
    const base = resolve('.tmp', `release-reconciliation-${randomUUID()}`);
    const rootPath = join(base, 'first'); const otherRoot = join(base, 'second');
    const catalog = createLibraryCatalogStore({ getPoolFn }); const rawMatches = createLibraryFileMatchStore({ getPoolFn });
    const observation = (root, name = 'track.flac', state = 'observed') => ({ canonicalPath: join(root, name),
      filename: name, relativePath: name, extension: '.flac', fileState: state, sizeBytes: 100, modifiedAt: '2026-10-10T00:00:00.000Z' });
    const first = await catalog.recordLibraryFiles({ libraryRootPath: rootPath, files: [observation(rootPath)] });
    const second = await catalog.recordLibraryFiles({ libraryRootPath: otherRoot, files: [observation(otherRoot)] });
    const metadataA = await seedMetadataReleaseFixture({ queryable: pool });
    const metadataB = await seedMetadataReleaseFixture({ queryable: pool, releaseTitle: 'Second release' });
    const metadataC = await seedMetadataReleaseFixture({ queryable: pool, releaseTitle: 'Stale release' });
    const extraTrack = await insertMetadataTrack({ metadataMediumId: metadataB.metadataMediumId,
      position: 2, numberText: '2', title: 'Second track' }, pool);
    await rawMatches.writeLibraryFileMatchBatch({ matches: [matched(first.files[0], metadataA), matched(second.files[0], metadataB)] });
    const rawProjection = createLibraryReleaseReconciliationStore({ getPoolFn });
    const coverage = createLibraryReleaseCoverageStore();
    const current = mapReleaseCoverageRows(await coverage.loadLibraryReleaseCoverageRows({ queryable: pool }));
    await rawProjection.replaceLibraryReleaseReconciliations({ reconciliations: [...current,
      { ...current[0], metadataArtistId: metadataC.metadataArtistId, metadataReleaseGroupId: metadataC.metadataReleaseGroupId,
        metadataReleaseId: metadataC.metadataReleaseId }] });
    const makeRuns = (ownerInstanceId, operationType = 'library_scan') => createOperationRunStore({ getPoolFn,
      operationType, leaseJobType: operationType,
      createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }) });
    const a = makeRuns('reconciliation-owner'); const b = makeRuns('reconciliation-owner');
    const run = await a.createOperationRun({ status: 'pending', summary: { libraryRoot: rootPath } });
    const maintenance = createMaintenanceLockService({ getPoolFn });
    const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
    const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
    const assertMaintenanceWriteAllowed = ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable });
    const makeService = (hooks = {}) => {
      let reads = 0; const mutations = [];
      const service = createLibraryReleaseReconciliationService({ getPoolFn, assertMaintenanceWriteAllowed,
        withTransaction: async (work) => { await hooks.beforeTransaction?.(); return (hooks.withTransaction ?? withTransaction)(work); },
        store: hooks.store ?? createLibraryReleaseReconciliationGuardStore(),
        coverageStore: { loadLibraryReleaseCoverageRows: async (input) => {
          const rows = await coverage.loadLibraryReleaseCoverageRows(input); reads += 1;
          await hooks.afterCoverage?.({ ...input, rows, index: reads }); return rows;
        } },
        libraryReleaseReconciliationStore: { replaceLibraryReleaseReconciliations: async (input) => {
          const queryable = { query: async (sql, values) => {
            if (/DELETE FROM library_release_reconciliations/u.test(sql)) mutations.push('delete');
            if (/INSERT INTO library_release_reconciliations/u.test(sql)) mutations.push('upsert');
            return input.queryable.query(sql, values);
          } };
          const result = await rawProjection.replaceLibraryReleaseReconciliations({ ...input, queryable,
            beforeWrite: async (stage) => { await input.beforeWrite(stage); await hooks.beforeMutation?.(stage); } });
          await hooks.afterReplace?.({ ...input, result }); return result;
        } },
      });
      return { ...service, mutations, reads: () => reads };
    };
    const catalogueOwner = createLibraryScanCatalogueService({ recordLibraryFiles: catalog.recordLibraryFiles,
      withTransaction, assertMaintenanceWriteAllowed });
    const context = (runId, lease, root = rootPath, rootId = first.libraryRootId) => ({ runId, expectedLease: lease,
      requestedLibraryRoot: root, libraryRootPath: root, libraryRootId: rootId });
    await callback({ pool, getPoolFn, base, rootPath, otherRoot, first, second, metadataA, metadataB, metadataC,
      extraTrack, observation, catalog, rawMatches, rawProjection, coverage, a, b, run, makeRuns, maintenance,
      withTransaction, assertMaintenanceWriteAllowed, catalogueOwner, makeService, context });
  });
}
async function open(c, runs = c.a, root = c.rootPath) {
  const run = root === c.rootPath ? c.run : await runs.createOperationRun({ status: 'pending', summary: { libraryRoot: root } });
  const lease = await runs.acquireLease({ runId: run.id });
  assert.equal(await runs.markRunStarted({ runId: run.id, expectedLease: lease, summary: { libraryRoot: root } }), true);
  return { run, lease, input: c.context(run.id, lease, root, root === c.rootPath ? c.first.libraryRootId : c.second.libraryRootId) };
}
async function startWorker(c, runs, reconciler) {
  const released = gate(); const later = []; let lease;
  const worker = createLibraryScanWorker({ ...runs,
    acquireLease: async (input) => { lease = await runs.acquireLease(input); return lease; },
    executeScan: async ({ onFile }) => {
      await onFile(c.observation(c.rootPath));
      return { libraryRoot: c.rootPath, filesSeen: 1, filesMatched: 1, filesUnmatched: 0 };
    },
    recordLibraryScanCatalogue: c.catalogueOwner.recordLibraryScanCatalogue,
    reconcileLibraryReleases: reconciler,
    reconcileWantedReleases: async () => { later.push('wanted'); },
    reconcileDiscoveryRequests: async () => { later.push('discovery'); },
    releaseLease: async (input) => { try { return await runs.releaseLease(input); } finally { released.release(); } },
  });
  await worker.startWorkerRun({ runId: c.run.id, libraryRoot: c.rootPath });
  return { done: released.promise, later, lease: () => lease };
}
async function waitForBlock(c, holderPid) {
  for (let count = 0; count < 100; count += 1) {
    if ((await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid])).rowCount) return;
    await new Promise((done) => { setTimeout(done, 10); });
  }
  assert.fail('Expected an actual PostgreSQL projection/root lock wait');
}

suite('Original scan acquisition owns serialized global release reconciliation', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('an old scan body paused after preliminary coverage observation cannot overwrite or clear replacement publication', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const empty of [false, true]) await scenario(t, async (c) => {
      if (empty) await c.pool.query("UPDATE library_file_matches SET match_status='unmatched'");
      const entered = gate(); const resume = gate(); const oldOwner = c.makeService();
      const first = await startWorker(c, c.a, async (input) => {
        const diagnostic = await c.coverage.loadLibraryReleaseCoverageRows({ queryable: c.pool });
        assert.equal(diagnostic.length === 0, empty); entered.release(); await resume.promise;
        // This diagnostic read is never passed back as authority or a cached replacement.
        return oldOwner.reconcileLibraryReleases(input);
      });
      await entered.promise; await expire(c, first.lease());
      await c.pool.query("UPDATE library_file_matches SET match_status='matched'");
      const replacement = await startWorker(c, c.b, c.makeService().reconcileLibraryReleases); await replacement.done;
      const current = await projection(c); const completed = await parent(c);
      assert.equal(current.length, 2); assert.equal(completed.status, 'completed');
      assert.notEqual(first.lease().acquisitionId, replacement.lease().acquisitionId);
      resume.release(); await first.done;
      assert.deepEqual(await projection(c), current); assert.deepEqual(await parent(c), completed);
      assert.deepEqual(oldOwner.mutations, []); assert.deepEqual(first.later, []);
    });
  });

  test('current global complete, partial, duplicate and genuinely empty coverage publish verified identities', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const active = await open(c); const owner = c.makeService();
    const first = await owner.reconcileLibraryReleases(active.input);
    assert.deepEqual(new Set(first.metadataReleaseIds), new Set([c.metadataA.metadataReleaseId, c.metadataB.metadataReleaseId]));
    assert.deepEqual(first.deletedMetadataReleaseIds, [c.metadataC.metadataReleaseId]);
    let rows = await projection(c);
    assert.equal(rows.find((row) => row.metadata_release_id === c.metadataA.metadataReleaseId).reconciliation_status, 'complete');
    assert.equal(rows.find((row) => row.metadata_release_id === c.metadataB.metadataReleaseId).reconciliation_status, 'partial');
    const duplicate = await c.catalog.recordLibraryFiles({ libraryRootPath: c.otherRoot,
      files: [c.observation(c.otherRoot), c.observation(c.otherRoot, 'duplicate.flac')] });
    await c.rawMatches.writeLibraryFileMatch(matched(duplicate.files.find((file) => basename(file.canonicalPath) === 'duplicate.flac'), c.metadataB));
    await owner.reconcileLibraryReleases(active.input); rows = await projection(c);
    const duplicated = rows.find((row) => row.metadata_release_id === c.metadataB.metadataReleaseId);
    assert.equal(duplicated.reconciliation_status, 'duplicate'); assert.equal(duplicated.duplicate_track_count, 1);
    assert.equal(duplicated.missing_track_count, 1); assert.equal(duplicated.matched_file_count, 2);
    await c.pool.query('UPDATE library_files SET deleted_at=clock_timestamp()');
    const cleared = await owner.reconcileLibraryReleases(active.input);
    assert.deepEqual(cleared.metadataReleaseIds, []); assert.equal(cleared.deletedMetadataReleaseIds.length, 2);
    assert.deepEqual(await projection(c), []);
    await c.a.releaseLease({ runId: c.run.id, expectedLease: active.lease, status: 'completed' });
  }));

  test('other-root phantoms, metadata track changes, cascades and initially empty changes refuse the old aggregate', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const change of ['other_root', 'new_release', 'track', 'cascade', 'empty']) await scenario(t, async (c) => {
      const active = await open(c); const entered = gate(); const resume = gate(); const initial = await projection(c);
      if (change === 'empty') await c.pool.query("UPDATE library_file_matches SET match_status='unmatched'");
      const owner = c.makeService({ afterCoverage: async ({ index }) => { if (index === 1) { entered.release(); await resume.promise; } } });
      const pending = owner.reconcileLibraryReleases(active.input); await entered.promise;
      if (change === 'other_root') {
        const observed = await c.catalog.recordLibraryFiles({ libraryRootPath: c.otherRoot,
          files: [c.observation(c.otherRoot), c.observation(c.otherRoot, 'new-track.flac')] });
        await c.rawMatches.writeLibraryFileMatch({ ...matched(observed.files[1], c.metadataB), metadataTrackId: c.extraTrack.id });
      }
      if (change === 'new_release') {
        const root = join(c.base, 'third'); const file = await c.catalog.recordLibraryFiles({ libraryRootPath: root, files: [c.observation(root)] });
        await c.rawMatches.writeLibraryFileMatch(matched(file.files[0], c.metadataC));
      }
      if (change === 'track') await insertMetadataTrack({ metadataMediumId: c.metadataA.metadataMediumId, position: 2, numberText: '2', title: 'New expected track' }, c.pool);
      if (change === 'cascade') await deleteMetadataMediaByReleaseId(c.metadataA.metadataReleaseId, c.pool);
      if (change === 'empty') await c.pool.query("UPDATE library_file_matches SET match_status='matched'");
      resume.release(); await assert.rejects(pending, { code: 'library_release_reconciliation_stale' });
      assert.deepEqual(owner.mutations, []); assert.deepEqual(await projection(c), initial);
      await c.a.releaseLease({ runId: c.run.id, expectedLease: active.lease, status: 'completed' });
    });
  });

  test('real global-advisory, root-table, target-table and target-row waits crossing expiry roll back publication', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const wait of ['advisory', 'root_table', 'target_table', 'target_row']) await scenario(t, async (c) => {
      const active = await open(c); const initial = await projection(c); const holder = await c.pool.connect();
      try {
        await holder.query('BEGIN');
        if (wait === 'advisory') await lockLibraryReleaseReconciliation({ queryable: holder });
        if (wait === 'root_table') await holder.query('LOCK TABLE library_roots IN ACCESS EXCLUSIVE MODE');
        if (wait === 'target_table') await holder.query('LOCK TABLE library_release_reconciliations IN ACCESS EXCLUSIVE MODE');
        if (wait === 'target_row') await holder.query('SELECT metadata_release_id FROM library_release_reconciliations WHERE metadata_release_id=$1 FOR UPDATE', [c.metadataC.metadataReleaseId]);
        const pid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [active.lease.leaseKey]);
        const result = c.makeService().reconcileLibraryReleases(active.input);
        const settled = result.then((value) => ({ value }), (error) => ({ error }));
        await waitForBlock(c, pid); await c.pool.query('SELECT pg_sleep(0.8)'); await holder.query('COMMIT');
        assert.equal((await settled).error?.code, 'operation_run_lease_lost');
        assert.deepEqual(await projection(c), initial);
      } finally { await holder.query('ROLLBACK'); holder.release(); }
      await c.a.releaseLease({ runId: c.run.id, expectedLease: active.lease, status: 'completed' });
    });
  });

  test('different-root admission is serialized and a waiter overrides repeatable-read before fresh coverage and mutation timestamps', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const first = await open(c); const second = await open(c, c.b, c.otherRoot);
    const entered = gate(); const resume = gate(); const admitted = gate(); const allowRead = gate(); let holderPid;
    const ownerA = c.makeService({ afterCoverage: async ({ queryable, index }) => { if (index === 1) {
      holderPid = (await queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; entered.release(); await resume.promise;
    } } });
    const authority = createLibraryReleaseReconciliationGuardStore();
    const ownerB = c.makeService({
      withTransaction: (work) => c.withTransaction(async (queryable) => {
        await queryable.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'); return work(queryable);
      }),
      store: { ...authority, lockContext: async (input) => {
        const context = await authority.lockContext(input); admitted.release(); await allowRead.promise; return context;
      } },
      afterCoverage: async ({ queryable, rows, index }) => { if (index === 1) {
        assert.equal((await queryable.query('SHOW transaction_isolation')).rows[0].transaction_isolation, 'read committed');
        assert.equal(rows.find((row) => row.metadata_release_id === c.metadataB.metadataReleaseId).expected_track_count, 3);
      } },
    });
    const publicationA = ownerA.reconcileLibraryReleases(first.input); await entered.promise;
    const publicationB = ownerB.reconcileLibraryReleases(second.input); await waitForBlock(c, holderPid);
    assert.equal(ownerB.reads(), 0); resume.release(); await publicationA; const previousProjection = await projection(c);
    await admitted.promise;
    await insertMetadataTrack({ metadataMediumId: c.metadataB.metadataMediumId, position: 3, numberText: '3', title: 'Committed before waiter read' }, c.pool);
    allowRead.release(); await publicationB; const afterRows = await projection(c);
    const earlier = previousProjection.find((row) => row.metadata_release_id === c.metadataB.metadataReleaseId);
    const later = afterRows.find((row) => row.metadata_release_id === c.metadataB.metadataReleaseId);
    assert.equal(later.expected_track_count, 3); assert.ok(later.last_reconciled_at >= earlier.last_reconciled_at);
    await c.a.releaseLease({ runId: first.run.id, expectedLease: first.lease, status: 'completed' });
    await c.b.releaseLease({ runId: second.run.id, expectedLease: second.lease, status: 'completed' });
  }));

  test('cancellation, maintenance and root-frame changes stop reconciliation and subsequent worker stages', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const change of ['cancel', 'maintenance', 'requested', 'root']) await scenario(t, async (c) => {
      const entered = gate(); const resume = gate(); const initial = await projection(c);
      const owner = c.makeService({ beforeTransaction: async () => { entered.release(); await resume.promise; } });
      const job = await startWorker(c, c.a, owner.reconcileLibraryReleases); await entered.promise;
      if (change === 'cancel') await createOperationRunControlService({ getPoolFn: c.getPoolFn }).requestOperationRunCancellation({ runId: c.run.id, requestedByUserId: null });
      if (change === 'maintenance') await c.maintenance.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Controlled release pause' });
      if (change === 'requested') await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{libraryRoot}',to_jsonb($2::text)) WHERE id=$1", [c.run.id, join(c.base, 'changed')]);
      if (change === 'root') await c.pool.query('UPDATE library_roots SET canonical_path=$2 WHERE id=$1', [c.first.libraryRootId, join(c.base, 'changed')]);
      resume.release(); await job.done;
      assert.deepEqual(await projection(c), initial); assert.deepEqual(owner.mutations, []); assert.deepEqual(job.later, []);
      if (change === 'cancel' || change === 'maintenance') assert.equal((await parent(c)).status, change === 'cancel' ? 'cancelled' : 'pending');
      else assert.notEqual((await parent(c)).status, 'completed');
    });
  });

  test('DELETE faults, skipped deletion, second-row SQL failure, incomplete bulk and final guards restore the whole projection', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const failure of ['delete', 'skip_delete', 'bulk', 'skip_bulk', 'expiry', 'source']) await scenario(t, async (c) => {
      const active = await open(c); const initial = await projection(c);
      if (['delete', 'skip_delete', 'bulk', 'skip_bulk'].includes(failure)) await c.pool.query(`CREATE FUNCTION refuse_projection_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF ${failure.includes('delete') ? "TG_OP='DELETE'" : `NEW.metadata_release_id='${c.metadataB.metadataReleaseId}'::uuid`} THEN
          ${failure.startsWith('skip') ? 'RETURN NULL;' : "RAISE EXCEPTION 'Controlled projection SQL failure';"}
        END IF; RETURN ${failure.includes('delete') ? 'OLD' : 'NEW'}; END $$;
        CREATE TRIGGER refuse_projection_write BEFORE ${failure.includes('delete') ? 'DELETE' : 'INSERT'} ON library_release_reconciliations
        FOR EACH ROW EXECUTE FUNCTION refuse_projection_write()`);
      let provisional;
      const owner = c.makeService({ afterReplace: async ({ queryable }) => {
        provisional = (await queryable.query('SELECT COUNT(*)::integer AS count FROM library_release_reconciliations')).rows[0].count;
        if (failure === 'expiry') await queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [active.lease.leaseKey]);
        if (failure === 'source') await insertMetadataTrack({ metadataMediumId: c.metadataA.metadataMediumId, position: 2, numberText: '2', title: 'Changed after replacement' }, c.pool);
      } });
      const rejection = await owner.reconcileLibraryReleases(active.input).then(() => null, (error) => error);
      assert.ok(rejection);
      if (failure === 'delete' || failure === 'bulk') assert.match(rejection.message, /Controlled projection SQL failure/u);
      if (failure.startsWith('skip')) assert.equal(rejection.code, 'library_release_reconciliation_incomplete');
      if (failure === 'expiry') assert.equal(rejection.code, 'operation_run_lease_lost');
      if (failure === 'source') assert.equal(rejection.code, 'library_release_reconciliation_stale');
      if (failure === 'expiry' || failure === 'source') assert.equal(provisional, 2);
      assert.deepEqual(await projection(c), initial);
      await c.a.releaseLease({ runId: c.run.id, expectedLease: active.lease, status: 'completed' });
    });
  });

  test('source writers can progress without dependency locks and standalone projection writers share admission', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const active = await open(c); const entered = gate(); const resume = gate(); let pid;
    const owner = c.makeService({ afterCoverage: async ({ queryable, index }) => { if (index === 1) {
      pid = (await queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid; entered.release(); await resume.promise;
    } } });
    const pending = owner.reconcileLibraryReleases(active.input); await entered.promise;
    // A cooperating scan has a distinct acquisition even when observing the same root.
    const producerRuns = c.makeRuns('source-cooperator');
    const producerRun = await producerRuns.createOperationRun({ status: 'pending', summary: { libraryRoot: c.rootPath } });
    const producerLease = await producerRuns.acquireLease({ runId: producerRun.id });
    await producerRuns.markRunStarted({ runId: producerRun.id, expectedLease: producerLease });
    await c.catalog.recordLibraryFiles({ libraryRootPath: c.rootPath,
      files: [c.observation(c.rootPath), c.observation(c.rootPath, 'ignored.flac', 'ignored')] });
    const recording = (await c.pool.query('SELECT musicbrainz_recording_id FROM metadata_recordings WHERE id=$1', [c.metadataA.metadataRecordingId])).rows[0].musicbrainz_recording_id;
    const normalizedTags = { musicBrainz: { recordingId: recording }, title: 'Foil', track: { number: 1 } };
    const preparedTag = captureTagSnapshotSource({ ...c.context(producerRun.id, producerLease), file: c.first.files[0] });
    const tagOwner = createLibraryTagSnapshotService({ withTransaction: c.withTransaction,
      writeLibraryFileTagSnapshot: createLibraryTagSnapshotStore({ getPoolFn: c.getPoolFn }).writeLibraryFileTagSnapshot,
      assertMaintenanceWriteAllowed: c.assertMaintenanceWriteAllowed });
    await tagOwner.writeOwnedLibraryFileTagSnapshot({ prepared: preparedTag,
      payload: { status: 'extracted', extractor: 'coexisting-source', normalizedTags } });
    const matchOwner = createLibraryFileMatchService({ withTransaction: c.withTransaction,
      writeLibraryFileMatchBatch: c.rawMatches.writeLibraryFileMatchBatch, assertMaintenanceWriteAllowed: c.assertMaintenanceWriteAllowed });
    await createLibraryFileMatcherService({ getPoolFn: c.getPoolFn,
      writeOwnedLibraryFileMatchBatch: matchOwner.writeOwnedLibraryFileMatchBatch }).matchLibraryFiles({
      ...c.context(producerRun.id, producerLease), files: [{ ...c.first.files[0], tagPayload: normalizedTags }] });
    const artist = (await c.pool.query('SELECT * FROM metadata_artists WHERE id=$1', [c.metadataA.metadataArtistId])).rows[0];
    await upsertMetadataArtist({ sourceProvider: artist.source_provider, sourceArtistId: artist.source_artist_id,
      musicbrainzArtistId: artist.musicbrainz_artist_id, name: 'Changed label only' }, c.pool);
    const organizeRuns = c.makeRuns('organize-cooperator', 'library_organize_apply');
    const organizeRun = await organizeRuns.createOperationRun({ status: 'pending' });
    const organizeLease = await organizeRuns.acquireLease({ runId: organizeRun.id });
    await organizeRuns.markRunStarted({ runId: organizeRun.id, expectedLease: organizeLease });
    const file = c.first.files[0]; const destination = join(c.rootPath, 'organized.flac');
    const prepared = captureOrganizeMutation({ runId: organizeRun.id, expectedLease: organizeLease,
      file: { fileId: file.id, libraryRootId: c.first.libraryRootId, libraryRootPath: c.rootPath,
        currentPath: file.canonicalPath, proposedPath: destination, proposedRelativePath: 'organized.flac' },
      plan: createMediaFilesystemService().createExclusiveFileMutationPlan({ requestedMode: 'move', removeSourceAfterSuccess: true,
        sourcePath: file.canonicalPath, sourceRoot: c.rootPath, destinationPath: destination, destinationRoot: c.rootPath }) });
    await c.withTransaction((queryable) => createLibraryOrganizeMutationStore().lockContext({ prepared, queryable }));
    const currentRows = mapReleaseCoverageRows(await c.coverage.loadLibraryReleaseCoverageRows({ queryable: c.pool }));
    const rawPending = c.rawProjection.replaceLibraryReleaseReconciliations({ reconciliations: currentRows });
    await waitForBlock(c, pid); resume.release(); await pending; await rawPending;
    assert.equal((await projection(c)).length, 2);
    await c.a.releaseLease({ runId: c.run.id, expectedLease: active.lease, status: 'completed' });
    await producerRuns.releaseLease({ runId: producerRun.id, expectedLease: producerLease, status: 'completed' });
    await organizeRuns.releaseLease({ runId: organizeRun.id, expectedLease: organizeLease, status: 'completed' });
  }));
});
