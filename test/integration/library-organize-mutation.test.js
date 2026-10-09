/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { seedMetadataReleaseFixture } from '../../testing/integration/metadata-fixtures.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { createOperationRunStore } from '../../src/server/operation-run-store.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { createLibraryNamingService } from '../../src/server/library/library-naming-service.js';
import { createLibraryOrganizePreviewStore } from '../../src/server/library/library-organize-preview-store.js';
import { createLibraryOrganizePreviewService } from '../../src/server/library/library-organize-preview-service.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createLibraryOrganizeMutationService } from '../../src/server/library/library-organize-mutation-service.js';
import { createLibraryOrganizeApplyWorker } from '../../src/server/library/library-organize-apply-worker.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
const gate = () => {
  let release;
  const promise = new Promise((done) => { release = done; });
  return { promise, release };
};
const exists = async (path) => stat(path).then(() => true, (error) => {
  if (error.code === 'ENOENT') return false;
  throw error;
});

async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const rootPath = await mkdtemp(join(tmpdir(), 'harmoniarr-organize-'));
    try {
      const pool = getPoolFn();
      const bytes = Buffer.from('Test-owned organize fixture: exclusive verified movement.\n');
      const source = join(rootPath, 'incoming', 'Original.flac');
      await mkdir(dirname(source), { recursive: true });
      await writeFile(source, bytes);
      const rootId = (await pool.query(`INSERT INTO library_roots(name,path,canonical_path)
        VALUES('Organize fixture',$1,$1) RETURNING id`, [rootPath])).rows[0].id;
      const fileId = (await pool.query(`INSERT INTO library_files(library_root_id,canonical_path,relative_path,filename,extension,size_bytes)
        VALUES($1,$2,'incoming/Original.flac','Original.flac','flac',$3) RETURNING id`, [rootId, source, bytes.length])).rows[0].id;
      const metadata = await seedMetadataReleaseFixture({ queryable: pool });
      await pool.query(`INSERT INTO library_file_matches(library_file_id,metadata_artist_id,metadata_release_group_id,
        metadata_release_id,metadata_medium_id,metadata_track_id,metadata_recording_id,match_status,confidence,matched_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,'matched','high','controlled-fixture')`,
      [fileId, metadata.metadataArtistId, metadata.metadataReleaseGroupId, metadata.metadataReleaseId,
        metadata.metadataMediumId, metadata.metadataTrackId, metadata.metadataRecordingId]);
      const preview = createLibraryOrganizePreviewService({
        libraryOrganizePreviewStore: createLibraryOrganizePreviewStore({ getPoolFn }),
        libraryNamingService: createLibraryNamingService({ loadSettingsFn: async () => ({}) }),
      });
      const file = (await preview.buildLibraryOrganizePreview()).files[0];
      assert.equal(file.status.code, 'rename_required');
      assert.equal(file.libraryRootId, rootId);
      const makeRuns = (ownerInstanceId) => createOperationRunStore({ getPoolFn,
        operationType: 'library_organize_apply', leaseJobType: 'library_organize_apply',
        createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }),
      });
      const a = makeRuns('organize-original');
      const b = makeRuns('organize-replacement');
      const run = await a.createOperationRun({ status: 'pending', summary: { plannedRenameCount: 1 } });
      const maintenance = createMaintenanceLockService({ getPoolFn });
      const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
      await callback({ getPoolFn, pool, rootPath, rootId, fileId, bytes, source, destination: file.proposedPath,
        file, preview, a, b, run, maintenance, guard, withTransaction: createDatabaseTransactionRunner({ getPoolFn }) });
    } finally {
      const cleanupPath = resolve(rootPath);
      const delta = relative(resolve(tmpdir()), cleanupPath);
      assert.ok(delta && !delta.startsWith('..') && !isAbsolute(delta)
        && basename(cleanupPath).startsWith('harmoniarr-organize-'), 'Cleanup remains inside the test-owned temporary directory');
      await rm(cleanupPath, { recursive: true, force: true });
    }
  });
}

function native(c, hooks = {}) {
  const effects = { mkdir: 0, copy: 0, remove: 0 };
  const service = createMediaFilesystemService({
    statFn: async (path) => {
      const result = await stat(path);
      await hooks.afterStat?.(path, result);
      return result;
    },
    mkdirFn: async (...args) => { effects.mkdir += 1; return mkdir(...args); },
    copyFileFn: async (...args) => {
      effects.copy += 1;
      await copyFile(...args);
      await hooks.afterCopy?.(...args);
    },
    removeFileFn: async (...args) => { effects.remove += 1; return rm(...args); },
  });
  const owner = createLibraryOrganizeMutationService({
    store: hooks.store ?? createLibraryOrganizeMutationStore(),
    withTransaction: c.withTransaction,
    assertMaintenanceWriteAllowed: ({ queryable }) => c.guard.assertNoActiveWriteLocks({ queryable }),
    applyExclusiveFileMutationPlan: service.applyExclusiveFileMutationPlan,
  });
  return { ...service, ...owner, effects };
}

async function start(c, runs, transport, hooks = {}) {
  const released = gate();
  const notifications = [];
  const activity = [];
  let capturedLease;
  const worker = createLibraryOrganizeApplyWorker({
    ...runs,
    acquireLease: async (input) => {
      capturedLease = await runs.acquireLease(input);
      await hooks.afterAcquire?.(capturedLease);
      return capturedLease;
    },
    applyOrganizeMutation: transport.applyOrganizeMutation,
    createExclusiveFileMutationPlan: transport.createExclusiveFileMutationPlan,
    buildLibraryOrganizePreview: async () => {
      const result = await c.preview.buildLibraryOrganizePreview();
      await hooks.afterPreview?.(result);
      return result;
    },
    onReleaseAddedFn: async (value) => { notifications.push(value); },
    recordActivityEventFn: async (value) => { activity.push(value); },
    releaseLease: async (input) => { try { return await runs.releaseLease(input); } finally { released.release(); } },
  });
  await worker.startWorkerRun({ runId: c.run.id, plannedRenameCount: 1 });
  return { done: released.promise, notifications, activity, lease: () => capturedLease };
}

const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_organize_apply:${c.run.id}`]);
const pathRow = async (c) => (await c.pool.query('SELECT canonical_path,relative_path,filename FROM library_files WHERE id=$1', [c.fileId])).rows[0];
const runRow = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
async function assertUntouched(c, job, transport) {
  assert.deepEqual(transport.effects, { mkdir: 0, copy: 0, remove: 0 });
  assert.equal((await pathRow(c)).canonical_path, c.source);
  assert.deepEqual(await readFile(c.source), c.bytes);
  assert.equal(await exists(c.destination), false);
  assert.equal(job.notifications.length, 0);
  assert.equal(job.activity.length, 0);
}
async function waitForFileBlock(c, holderPid) {
  for (let count = 0; count < 100; count += 1) {
    const result = await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid]);
    if (result.rowCount) return;
    await new Promise((done) => { setTimeout(done, 10); });
  }
  assert.fail('Expected the real file/root row-lock wait');
}

suite('Guarded organize movement with real PostgreSQL and test-owned files', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('replacement after real preview prevents every old mutation and completes a verified real move', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate(); const replacementEntered = gate(); const replacementResume = gate();
    const firstNative = native(c); const replacementNative = native(c);
    const first = await start(c, c.a, firstNative, { afterPreview: async () => { entered.release(); await resume.promise; } });
    await entered.promise;
    await expire(c);
    const replacement = await start(c, c.b, replacementNative, { afterAcquire: async () => { replacementEntered.release(); await replacementResume.promise; } });
    await replacementEntered.promise;
    assert.notEqual(first.lease().acquisitionId, replacement.lease().acquisitionId);
    resume.release(); await first.done;
    await assertUntouched(c, first, firstNative);
    assert.equal((await c.b.getLease({ runId: c.run.id })).acquisitionId, replacement.lease().acquisitionId);
    replacementResume.release(); await replacement.done;
    assert.equal(await exists(c.source), false);
    assert.deepEqual(await readFile(c.destination), c.bytes);
    assert.equal((await pathRow(c)).canonical_path, c.destination);
    const completed = await runRow(c);
    assert.equal(completed.status, 'completed'); assert.equal(completed.summary.movedCount, 1);
    assert.equal(completed.summary.fileResults[0].verification.sourceRemoved, true);
    assert.equal(completed.summary.fileResults[0].verification.sourceExistsAfterSuccess, false);
    assert.equal(completed.summary.fileResults[0].transport, 'copy_then_remove');
    assert.equal(replacement.notifications.length, 1); assert.equal(replacement.activity.length, 1);
  }));

  test('takeover during actual native source inspection is caught before mkdir or copying', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate(); let delayed = false;
    const transport = native(c, { afterStat: async (path) => {
      if (path === c.source && !delayed) { delayed = true; entered.release(); await resume.promise; }
    } });
    const job = await start(c, c.a, transport); await entered.promise;
    await expire(c); const replacementLease = await c.b.acquireLease({ runId: c.run.id });
    resume.release(); await job.done;
    await assertUntouched(c, job, transport);
    assert.equal((await c.b.getLease({ runId: c.run.id })).acquisitionId, replacementLease.acquisitionId);
    await c.b.releaseLease({ runId: c.run.id, expectedLease: replacementLease, status: 'completed' });
  }));

  test('takeover after exclusive copy retains both byte sets and refuses source cleanup and catalogue success', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate();
    const transport = native(c, { afterCopy: async () => { entered.release(); await resume.promise; } });
    const job = await start(c, c.a, transport); await entered.promise;
    assert.deepEqual(await readFile(c.destination), c.bytes);
    await expire(c); const replacementLease = await c.b.acquireLease({ runId: c.run.id });
    resume.release(); await job.done;
    assert.equal(transport.effects.copy, 1); assert.equal(transport.effects.remove, 0);
    assert.deepEqual(await readFile(c.source), c.bytes); assert.deepEqual(await readFile(c.destination), c.bytes);
    assert.equal((await pathRow(c)).canonical_path, c.source);
    assert.equal(job.notifications.length, 0); assert.equal(job.activity.length, 0);
    assert.notEqual((await runRow(c)).status, 'completed');
    await c.b.releaseLease({ runId: c.run.id, expectedLease: replacementLease, status: 'completed' });
  }));

  test('cancellation and real maintenance locks during preflight use their outer handlers without file effects', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const reason of ['cancel', 'maintenance']) await scenario(t, async (c) => {
      const entered = gate(); const resume = gate(); let delayed = false;
      const transport = native(c, { afterStat: async (path) => {
        if (path === c.source && !delayed) { delayed = true; entered.release(); await resume.promise; }
      } });
      const job = await start(c, c.a, transport); await entered.promise;
      if (reason === 'cancel') await createOperationRunControlService({ getPoolFn: c.getPoolFn })
        .requestOperationRunCancellation({ runId: c.run.id, requestedByUserId: null });
      else await c.maintenance.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Controlled organize pause' });
      resume.release(); await job.done;
      await assertUntouched(c, job, transport);
      const stopped = await runRow(c);
      assert.equal(stopped.status, reason === 'cancel' ? 'cancelled' : 'pending');
      assert.equal(stopped.summary.movedCount ?? 0, 0);
      if (reason === 'maintenance') assert.equal(stopped.summary.pauseCode, 'maintenance_lock_active');
    });
  });

  test('source or root catalogue drift refuses the captured plan before any filesystem mutation', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['source', 'root']) await scenario(t, async (c) => {
      const entered = gate(); const resume = gate();
      const transport = native(c);
      const job = await start(c, c.a, transport, { afterPreview: async () => { entered.release(); await resume.promise; } });
      await entered.promise;
      const changed = join(c.rootPath, 'changed');
      if (drift === 'source') await c.pool.query('UPDATE library_files SET canonical_path=$2 WHERE id=$1', [c.fileId, changed]);
      else await c.pool.query('UPDATE library_roots SET canonical_path=$2 WHERE id=$1', [c.rootId, changed]);
      resume.release(); await job.done;
      assert.deepEqual(transport.effects, { mkdir: 0, copy: 0, remove: 0 });
      assert.deepEqual(await readFile(c.source), c.bytes); assert.equal(await exists(c.destination), false);
      assert.equal((await pathRow(c)).canonical_path, drift === 'source' ? changed : c.source);
      assert.equal((await runRow(c)).summary.movedCount, 0);
      assert.equal((await runRow(c)).summary.fileResults[0].status, 'failed');
      assert.equal(job.notifications.length, 0); assert.equal(job.activity.length, 0);
    });
  });

  test('exclusive destination collision and size verification keep source bytes and prevent catalogue success', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const failure of ['collision', 'verification']) await scenario(t, async (c) => {
      const sentinel = Buffer.from('Existing different bytes');
      if (failure === 'collision') {
        await mkdir(dirname(c.destination), { recursive: true }); await writeFile(c.destination, sentinel);
      }
      const transport = native(c, { afterCopy: failure === 'verification' ? async () => { await writeFile(c.destination, sentinel); } : undefined });
      const job = await start(c, c.a, transport); await job.done;
      assert.deepEqual(await readFile(c.source), c.bytes); assert.deepEqual(await readFile(c.destination), sentinel);
      assert.equal(transport.effects.remove, 0); assert.equal(transport.effects.copy, failure === 'collision' ? 0 : 1);
      assert.equal((await pathRow(c)).canonical_path, c.source);
      assert.equal((await runRow(c)).summary.movedCount, 0);
      assert.equal(job.notifications.length, 0); assert.equal(job.activity.length, 0);
    });
  });

  test('the owning clock refresh after a real file-row lock wait rejects a now expired acquisition', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(); const resume = gate();
    const transport = native(c);
    const job = await start(c, c.a, transport, { afterPreview: async () => { entered.release(); await resume.promise; } });
    await entered.promise;
    const holder = await c.pool.connect();
    try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM library_files WHERE id=$1 FOR UPDATE', [c.fileId]);
      const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [job.lease().leaseKey]);
      resume.release(); await waitForFileBlock(c, holderPid);
      await c.pool.query('SELECT pg_sleep(0.8)');
      await holder.query('COMMIT'); await job.done;
      await assertUntouched(c, job, transport);
      assert.notEqual((await runRow(c)).status, 'completed');
    } finally { await holder.query('ROLLBACK'); holder.release(); }
  }));

  test('expiry at the final catalogue CAS yields no moved count or notification after verified filesystem movement', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const actual = createLibraryOrganizeMutationStore();
    let rowsChanged;
    const store = { ...actual, updateCanonicalPath: async (input) => {
      await input.queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [input.prepared.expectedLease.leaseKey]);
      rowsChanged = await actual.updateCanonicalPath(input);
      return rowsChanged;
    } };
    const transport = native(c, { store });
    const job = await start(c, c.a, transport); await job.done;
    assert.equal(rowsChanged, false);
    assert.equal(await exists(c.source), false); assert.deepEqual(await readFile(c.destination), c.bytes);
    assert.equal((await pathRow(c)).canonical_path, c.source);
    assert.equal((await runRow(c)).summary.movedCount, 0);
    assert.equal(job.notifications.length, 0); assert.equal(job.activity.length, 0);
  }));

  test('actual catalogue root upsert and organize snapshot serialize root before file without a deadlock', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const lease = await c.a.acquireLease({ runId: c.run.id });
    assert.equal(await c.a.markRunStarted({ runId: c.run.id, expectedLease: lease }), true);
    const media = createMediaFilesystemService();
    const prepared = captureOrganizeMutation({ runId: c.run.id, expectedLease: lease, file: c.file,
      plan: media.createExclusiveFileMutationPlan({ requestedMode: 'move', removeSourceAfterSuccess: true,
        sourcePath: c.source, sourceRoot: c.rootPath, destinationPath: c.destination, destinationRoot: c.rootPath }) });
    assert.ok(prepared);
    const rootLocked = gate(); const releaseScan = gate();
    let scanPid;
    const catalog = createLibraryCatalogStore({ getPoolFn: () => ({ connect: async () => {
      const client = await c.pool.connect();
      scanPid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      return {
        query: async (sql, values) => {
          const result = await client.query(sql, values);
          if (sql.includes('INSERT INTO library_roots')) {
            rootLocked.release(); await releaseScan.promise;
          }
          return result;
        },
        release: () => client.release(),
      };
    } }) });
    const scan = catalog.recordLibraryFiles({ libraryRootPath: c.rootPath, files: [{ canonicalPath: c.source,
      relativePath: 'incoming/Original.flac', filename: 'Original.flac', extension: 'flac', sizeBytes: c.bytes.length }] });
    await rootLocked.promise;
    const store = createLibraryOrganizeMutationStore();
    const organize = c.withTransaction((queryable) => store.lockContext({ prepared, queryable }));
    try { await waitForFileBlock(c, scanPid); } finally { releaseScan.release(); }
    const results = await Promise.allSettled([scan, organize]);
    const failures = results.filter((result) => result.status === 'rejected');
    assert.deepEqual(failures.map((result) => ({ code: result.reason.code, message: result.reason.message })), [],
      'Both actual store transactions must complete without a root/file lock-order cycle');
    assert.equal(results[0].value.libraryRootId, c.rootId);
    assert.equal(results[1].value.file.id, c.fileId);
    assert.equal(results[1].value.file.libraryRootId, c.rootId);
    assert.equal((await pathRow(c)).canonical_path, c.source);
    assert.deepEqual(await readFile(c.source), c.bytes); assert.equal(await exists(c.destination), false);
    await c.a.releaseLease({ runId: c.run.id, expectedLease: lease, status: 'completed' });
  }));
});
