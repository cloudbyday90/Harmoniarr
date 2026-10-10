/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { prepareLibraryTestSchema } from '../../testing/integration/library-test-schema-preparation.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { executeLibraryScan } from '../../src/server/library/library-scan-executor.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { createLibraryScanWorker } from '../../src/server/library/library-scan-worker.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
function gate() {
  let release;
  const promise = new Promise((done) => { release = done; });
  return { promise, release };
}
async function walk(libraryRoot) {
  const files = [];
  const summary = await executeLibraryScan({ libraryRoot, onFile: async (file) => { files.push(file); } });
  return { files, summary };
}
async function snapshot(c) {
  const root = (await c.pool.query('SELECT * FROM library_roots ORDER BY id')).rows;
  const files = (await c.pool.query('SELECT * FROM library_files ORDER BY id')).rows;
  return { root, files };
}
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);

async function scenario(t, callback, { empty = false } = {}) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn, phaseObserver }) => {
    await prepareLibraryTestSchema({ getPoolFn, phaseObserver, signal: t.signal });
    const requestedRoot = await mkdtemp(join(tmpdir(), 'harmoniarr-scan-catalogue-'));
    const rootPath = await realpath(requestedRoot);
    try {
      const fixture = await phaseObserver.measure('fixture_seed', async () => {
        const pool = getPoolFn();
        const stable = join(rootPath, 'stable.flac');
        const old = join(rootPath, 'old.flac');
        const newFile = join(rootPath, 'new.flac');
        const cover = join(rootPath, 'cover.jpg');
        const oldBytes = Buffer.from('Old observed bytes');
        const replacementBytes = Buffer.from('Current replacement bytes are longer');
        const catalog = createLibraryCatalogStore({ getPoolFn });
        let seed;
        if (!empty) {
          await writeFile(stable, oldBytes); await writeFile(old, oldBytes); await writeFile(cover, 'ignored cover fixture');
          const observed = await walk(requestedRoot);
          seed = await catalog.recordLibraryFiles({ libraryRootPath: observed.summary.libraryRoot, files: observed.files });
          await pool.query(`UPDATE library_files SET tag_payload='{"title":"Retained tag"}'::jsonb,
            tag_extracted_size_bytes=size_bytes,tag_extracted_modified_at=modified_at WHERE canonical_path=$1`, [stable]);
        }
        const makeRuns = (ownerInstanceId, operationType = 'library_scan') => createOperationRunStore({ getPoolFn,
          operationType, leaseJobType: operationType,
          createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }),
        });
        const a = makeRuns('scan-original'); const b = makeRuns('scan-replacement');
        const run = await a.createOperationRun({ status: 'pending', summary: { libraryRoot: requestedRoot } });
        const maintenance = createMaintenanceLockService({ getPoolFn });
        const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
        const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
        const createOwner = (recordLibraryFiles = catalog.recordLibraryFiles) => createLibraryScanCatalogueService({
          recordLibraryFiles, withTransaction,
          assertMaintenanceWriteAllowed: ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable }),
        });
        return { getPoolFn, pool, rootPath, requestedRoot, stable, old, newFile, cover, oldBytes,
          replacementBytes, seed, catalog, a, b, run, maintenance, guard, withTransaction, makeRuns, createOwner,
          owner: createOwner() };
      });
      await phaseObserver.measure('scenario_work', () => callback(fixture));
    } finally {
      const cleanupPath = resolve(requestedRoot); const delta = relative(resolve(tmpdir()), cleanupPath);
      assert.ok(delta && !delta.startsWith('..') && !isAbsolute(delta)
        && basename(cleanupPath).startsWith('harmoniarr-scan-catalogue-'), 'Cleanup stays in the test-owned temporary directory');
      await rm(cleanupPath, { recursive: true, force: true });
    }
  });
}

async function start(c, runs, hooks = {}) {
  const released = gate(); const downstream = []; let capturedLease;
  const worker = createLibraryScanWorker({ ...runs,
    acquireLease: async (input) => { capturedLease = await runs.acquireLease(input); return capturedLease; },
    executeScan: async (input) => {
      const result = await executeLibraryScan(input);
      await hooks.afterWalk?.(result);
      return result;
    },
    recordLibraryScanCatalogue: (hooks.owner ?? c.owner).recordLibraryScanCatalogue,
    extractLibraryFileTags: async ({ files }) => { downstream.push('tags'); return { files }; },
    captureLibrarySidecarArtwork: async () => { downstream.push('artwork'); },
    matchLibraryFiles: async () => { downstream.push('matching'); },
    reconcileLibraryReleases: async () => { downstream.push('releases'); },
    reconcileWantedReleases: async () => { downstream.push('wanted'); },
    reconcileDiscoveryRequests: async () => { downstream.push('discovery'); },
    releaseLease: async (input) => { try { return await runs.releaseLease(input); } finally { released.release(); } },
  });
  await worker.startWorkerRun({ runId: c.run.id, libraryRoot: c.requestedRoot });
  return { done: released.promise, downstream, lease: () => capturedLease };
}
async function waitForBlock(c, holderPid) {
  for (let count = 0; count < 100; count += 1) {
    const result = await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid]);
    if (result.rowCount) return;
    await new Promise((done) => { setTimeout(done, 10); });
  }
  assert.fail('Expected the actual PostgreSQL root/file lock wait');
}

suite('Captured scan acquisition owns root, observations and missing-file tombstones', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('an actual old walk cannot overwrite sizes, new files, tags or tombstones after replacement persistence', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate();
    const first = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
    await entered.promise;
    await writeFile(c.stable, c.replacementBytes); await rm(c.old); await writeFile(c.newFile, c.replacementBytes);
    await expire(c); const replacement = await start(c, c.b); await replacement.done;
    assert.notEqual(first.lease().acquisitionId, replacement.lease().acquisitionId);
    const current = await snapshot(c); const completed = await parent(c);
    assert.equal(completed.status, 'completed');
    assert.equal(current.files.find((file) => file.canonical_path === c.stable).size_bytes, String(c.replacementBytes.length));
    assert.equal(current.files.find((file) => file.canonical_path === c.newFile).deleted_at, null);
    assert.ok(current.files.find((file) => file.canonical_path === c.old).deleted_at);
    assert.deepEqual(current.files.find((file) => file.canonical_path === c.stable).tag_payload, { title: 'Retained tag' });
    resume.release(); await first.done;
    assert.deepEqual(await snapshot(c), current); assert.deepEqual(await parent(c), completed);
    assert.deepEqual(first.downstream, []); assert.ok(replacement.downstream.includes('discovery'));
    assert.deepEqual(await readFile(c.stable), c.replacementBytes);
  }));

  test('an old genuinely empty walk cannot tombstone files persisted by the replacement', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate();
    const first = await start(c, c.a, { afterWalk: async (value) => { assert.equal(value.filesSeen, 0); entered.release(); await resume.promise; } });
    await entered.promise;
    await writeFile(c.newFile, c.replacementBytes); await expire(c);
    const replacement = await start(c, c.b); await replacement.done;
    const current = await snapshot(c);
    assert.equal(current.files.length, 1); assert.equal(current.files[0].deleted_at, null);
    resume.release(); await first.done;
    assert.deepEqual(await snapshot(c), current); assert.deepEqual(first.downstream, []);
  }, { empty: true }));

  test('a current genuine empty scan commits missing-file tombstones and completes with zero observed files', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    await rm(c.stable); await rm(c.old); await rm(c.cover);
    const job = await start(c, c.a); await job.done;
    const current = await snapshot(c); const completed = await parent(c);
    assert.equal(completed.status, 'completed'); assert.equal(completed.summary.observedFileCount, 0);
    assert.equal(current.files.length, 3); assert.ok(current.files.every((file) => file.deleted_at));
    assert.deepEqual(job.downstream, ['releases', 'wanted', 'discovery']);
  }));

  test('cancellation and maintenance arriving after a real walk refuse catalogue writes and downstream work', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const reason of ['cancel', 'maintenance']) await scenario(t, async (c) => {
      const entered = gate(); const resume = gate(); const initial = await snapshot(c);
      const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
      await entered.promise;
      if (reason === 'cancel') await createOperationRunControlService({ getPoolFn: c.getPoolFn })
        .requestOperationRunCancellation({ runId: c.run.id, requestedByUserId: null });
      else await c.maintenance.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Controlled scan pause' });
      resume.release(); await job.done;
      assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
      const stopped = await parent(c); assert.equal(stopped.status, reason === 'cancel' ? 'cancelled' : 'pending');
    });
  });

  test('lease expiry across real root and file lock waits rolls back all provisional catalogue writes', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const lock of ['root', 'file']) await scenario(t, async (c) => {
      const entered = gate(); const resume = gate(); const initial = await snapshot(c);
      const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
      await entered.promise; const holder = await c.pool.connect();
      try {
        await holder.query('BEGIN');
        if (lock === 'root') await holder.query('SELECT id FROM library_roots WHERE id=$1 FOR UPDATE', [c.seed.libraryRootId]);
        else await holder.query('SELECT id FROM library_files WHERE canonical_path=$1 FOR UPDATE', [c.stable]);
        const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [job.lease().leaseKey]);
        resume.release(); await waitForBlock(c, holderPid); await c.pool.query('SELECT pg_sleep(0.8)');
        await holder.query('COMMIT'); await job.done;
        assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
        assert.notEqual((await parent(c)).status, 'completed');
      } finally { await holder.query('ROLLBACK'); holder.release(); }
    });
  });

  test('expiry after writes, batch or tombstone faults and incomplete results roll back the whole catalogue transaction', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const failure of ['expiry', 'batch', 'tombstone', 'incomplete']) await scenario(t, async (c) => {
      const initial = await snapshot(c); await rm(c.old); await writeFile(c.newFile, c.replacementBytes);
      if (failure === 'batch' || failure === 'tombstone') await c.pool.query(`CREATE FUNCTION reject_scan_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF ${failure === 'batch' ? "NEW.filename='new.flac'" : 'NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL'} THEN
          RAISE EXCEPTION 'Controlled scan ${failure} failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_scan_write BEFORE INSERT OR UPDATE ON library_files FOR EACH ROW EXECUTE FUNCTION reject_scan_write()`);
      const owner = c.createOwner(async (input) => {
        const result = await c.catalog.recordLibraryFiles(input);
        if (failure === 'expiry') await input.queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);
        if (failure === 'incomplete') return { ...result, files: result.files.slice(1) };
        return result;
      });
      const job = await start(c, c.a, { owner }); await job.done;
      assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
      const stopped = await parent(c); assert.notEqual(stopped.status, 'completed');
      if (failure === 'batch' || failure === 'tombstone') assert.match(stopped.error_message, /Controlled scan/u);
    });
  });

  test('current scan persistence and organize snapshot share root-first order and complete without deadlock', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const organizeRuns = c.makeRuns('organize-coexisting', 'library_organize_apply');
    const organizeRun = await organizeRuns.createOperationRun({ status: 'pending' });
    const lease = await organizeRuns.acquireLease({ runId: organizeRun.id });
    assert.equal(await organizeRuns.markRunStarted({ runId: organizeRun.id, expectedLease: lease }), true);
    const fileId = c.seed.files.find((file) => file.canonicalPath === c.stable).id;
    const destination = join(c.rootPath, 'organized.flac');
    const media = createMediaFilesystemService();
    const prepared = captureOrganizeMutation({ runId: organizeRun.id, expectedLease: lease,
      file: { fileId, libraryRootId: c.seed.libraryRootId, libraryRootPath: c.rootPath, currentPath: c.stable,
        proposedPath: destination, proposedRelativePath: 'organized.flac' },
      plan: media.createExclusiveFileMutationPlan({ requestedMode: 'move', removeSourceAfterSuccess: true,
        sourcePath: c.stable, sourceRoot: c.rootPath, destinationPath: destination, destinationRoot: c.rootPath }) });
    assert.ok(prepared);
    const rootLocked = gate(); const resume = gate(); let scanPid;
    const owner = c.createOwner(async (input) => {
      scanPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const queryable = { query: async (sql, values) => {
        const result = await input.queryable.query(sql, values);
        if (sql.includes('INSERT INTO library_roots')) { rootLocked.release(); await resume.promise; }
        return result;
      } };
      return c.catalog.recordLibraryFiles({ ...input, queryable });
    });
    const job = await start(c, c.a, { owner }); await rootLocked.promise;
    const store = createLibraryOrganizeMutationStore();
    const organize = c.withTransaction((queryable) => store.lockContext({ prepared, queryable }));
    try { await waitForBlock(c, scanPid); } finally { resume.release(); }
    const context = await organize; await job.done;
    assert.equal(context.file.id, fileId); assert.equal(context.file.rootPath, c.rootPath);
    assert.equal((await parent(c)).status, 'completed'); assert.equal((await snapshot(c)).files.filter((file) => !file.deleted_at).length, 3);
    await organizeRuns.releaseLease({ runId: organizeRun.id, expectedLease: lease, status: 'completed' });
  }));

  test('changed requested-root frame refuses the old successful walk without retargeting the catalogue', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate(); const initial = await snapshot(c);
    const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
    await entered.promise;
    await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{libraryRoot}',to_jsonb($2::text)) WHERE id=$1", [c.run.id, join(c.rootPath, 'changed')]);
    resume.release(); await job.done;
    assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
    assert.notEqual((await parent(c)).status, 'completed');
  }));
});
