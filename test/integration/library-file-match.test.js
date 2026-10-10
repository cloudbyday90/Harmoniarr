/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
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
import { executeLibraryScan } from '../../src/server/library/library-scan-executor.js';
import { createLibraryCatalogStore } from '../../src/server/library/library-catalog-store.js';
import { createLibraryScanCatalogueService } from '../../src/server/library/library-scan-catalogue-service.js';
import { createLibraryTagSnapshotStore } from '../../src/server/library/library-tag-snapshot-store.js';
import { createLibraryTagSnapshotService } from '../../src/server/library/library-tag-snapshot-service.js';
import { captureTagSnapshotSource } from '../../src/server/library/library-tag-snapshot-policy.js';
import { createLibraryFileMatchStore } from '../../src/server/library/library-file-match-store.js';
import { createLibraryFileMatchService } from '../../src/server/library/library-file-match-service.js';
import { createLibraryFileMatcherService } from '../../src/server/library/library-file-matcher-service.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { startLibraryScanFixtureWorker } from '../../testing/integration/library-scan-worker-fixture.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
let reportedDatabaseVersion = false;
const tags = (title = 'Foil') => ({ album: 'Amber', albumArtist: 'Autechre', artist: 'Autechre',
  musicBrainz: {}, title, track: { number: 1 }, artists: ['Autechre'] });
function gate(c) {
  const controlled = createFixtureGate({ signal: c.scope.signal });
  c.scope.onRelease(() => controlled.release());
  return controlled;
}
async function walk(root) {
  const files = [];
  const summary = await executeLibraryScan({ libraryRoot: root, onFile: async (file) => { files.push(file); } });
  return { files, summary };
}
async function snapshot(c) {
  return { files: (await c.pool.query('SELECT * FROM library_files ORDER BY id')).rows,
    matches: (await c.pool.query('SELECT * FROM library_file_matches ORDER BY library_file_id')).rows };
}
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);

async function scenario(t, callback, { scoped = false, twoFiles = false, nullTags = false } = {}) {
  if (unavailable) { t.skip(unavailable); return; }
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const requestedRoot = await mkdtemp(join(tmpdir(), 'harmoniarr-file-match-'));
    const rootPath = await realpath(requestedRoot);
    try {
      const pool = getPoolFn(); const path = join(rootPath, '01-original.flac');
      if (!reportedDatabaseVersion) {
        t.diagnostic((await pool.query('SELECT version() AS version')).rows[0].version);
        reportedDatabaseVersion = true;
      }
      await writeFile(path, 'Test-owned source observations; controlled tags, no media quality claim.');
      if (twoFiles) await writeFile(join(rootPath, '02-second.flac'), 'Second test-owned observation.');
      const catalog = createLibraryCatalogStore({ getPoolFn }); const initial = await walk(requestedRoot);
      const seed = await catalog.recordLibraryFiles({ libraryRootPath: initial.summary.libraryRoot, files: initial.files });
      const metadataA = await seedMetadataReleaseFixture({ queryable: pool });
      const metadataB = await seedMetadataReleaseFixture({ queryable: pool, trackTitle: 'Montreal' });
      const rawTags = createLibraryTagSnapshotStore({ getPoolFn });
      const rawMatches = createLibraryFileMatchStore({ getPoolFn });
      for (const file of seed.files) await rawTags.writeLibraryFileTagSnapshot({ libraryFileId: file.id,
        extractor: 'controlled-fixture', status: 'extracted', normalizedTags: nullTags ? null : tags(),
        sourceSizeBytes: file.sizeBytes, sourceModifiedAt: file.modifiedAt });
      await rawMatches.writeLibraryFileMatchBatch({ matches: seed.files.map((file) => ({ libraryFileId: file.id,
        matchStatus: 'unmatched', confidence: 'low', matchedBy: 'seeded_control', evidence: { reason: 'seeded_control' } })) });
      const releaseHints = scoped ? [{ canonicalPath: path, metadataReleaseId: metadataA.metadataReleaseId }] : [];
      const makeRuns = (ownerInstanceId, operationType = 'library_scan') => createOperationRunStore({ getPoolFn,
        operationType, leaseJobType: operationType,
        createJobLeaseStoreFn: () => createJobLeaseStore({ getPoolFn, ownerInstanceId, leaseDurationMs: 60_000 }) });
      const a = makeRuns('matching-owner'); const b = makeRuns('matching-owner');
      const run = await a.createOperationRun({ status: 'pending', summary: { libraryRoot: requestedRoot, releaseHints } });
      const maintenance = createMaintenanceLockService({ getPoolFn });
      const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
      const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
      const assertMaintenanceWriteAllowed = ({ queryable }) => guard.assertNoActiveWriteLocks({ queryable });
      const scanCatalogue = createLibraryScanCatalogueService({ recordLibraryFiles: catalog.recordLibraryFiles,
        withTransaction, assertMaintenanceWriteAllowed });
      const tagOwner = createLibraryTagSnapshotService({ writeLibraryFileTagSnapshot: rawTags.writeLibraryFileTagSnapshot,
        withTransaction, assertMaintenanceWriteAllowed });
      const createOwner = (writeLibraryFileMatchBatch = rawMatches.writeLibraryFileMatchBatch) => createLibraryFileMatchService({
        writeLibraryFileMatchBatch, withTransaction, assertMaintenanceWriteAllowed });
      await withFixtureLifecycle({ signal: t.signal }, (scope) => callback({
        getPoolFn, pool, requestedRoot, rootPath, path, seed, metadataA, metadataB, rawTags, rawMatches,
        releaseHints, a, b, run, maintenance, catalog, makeRuns, withTransaction, scanCatalogue, tagOwner,
        createOwner, owner: createOwner(), scope,
      }));
    } finally {
      const cleanupPath = resolve(requestedRoot); const delta = relative(resolve(tmpdir()), cleanupPath);
      assert.ok(delta && !delta.startsWith('..') && !isAbsolute(delta)
        && basename(cleanupPath).startsWith('harmoniarr-file-match-'), 'Cleanup stays in the test-owned temporary directory');
      await rm(cleanupPath, { recursive: true, force: true });
    }
  });
}
async function start(c, runs, hooks = {}) {
  const reconciliations = []; let capturedLease; let sidecarCount = 0;
  const matcher = createLibraryFileMatcherService({ getPoolFn: () => ({ query: async (...args) => {
    const result = await c.pool.query(...args); await hooks.afterLookup?.(result); return result;
  } }), writeOwnedLibraryFileMatchBatch: (hooks.owner ?? c.owner).writeOwnedLibraryFileMatchBatch });
  const callbacks = { ...runs,
    acquireLease: async (input) => { capturedLease = await runs.acquireLease(input); return capturedLease; },
    recordLibraryScanCatalogue: c.scanCatalogue.recordLibraryScanCatalogue,
    ...(hooks.extract ? { extractLibraryFileTags: async (input) => {
      const prepared = input.files.map((file) => captureTagSnapshotSource({ ...input, file }));
      for (const source of prepared) await c.tagOwner.writeOwnedLibraryFileTagSnapshot({ prepared: source,
        payload: { status: 'extracted', extractor: 'controlled-match-fixture', normalizedTags: tags(hooks.title) } });
      return { files: input.files.map((file) => ({ ...file, tagPayload: tags(hooks.title) })) };
    } } : {}),
    captureLibrarySidecarArtwork: async () => { sidecarCount += 1; },
    matchLibraryFiles: matcher.matchLibraryFiles,
    reconcileLibraryReleases: async () => { reconciliations.push('releases'); },
    reconcileWantedReleases: async () => { reconciliations.push('wanted'); },
    reconcileDiscoveryRequests: async () => { reconciliations.push('discovery'); },
  };
  const job = await startLibraryScanFixtureWorker({ callbacks, signal: c.scope.signal, track: (operation) => c.scope.track(operation),
    run: { runId: c.run.id, libraryRoot: c.requestedRoot, releaseHints: c.releaseHints } });
  return { ...job, reconciliations, lease: () => capturedLease, sidecars: () => sidecarCount };
}
async function waitForBlock(c, holderPid) {
  for (let count = 0; count < 100; count += 1) {
    if ((await c.pool.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid])).rowCount) return;
    await new Promise((done) => { setTimeout(done, 10); });
  }
  assert.fail('Expected the actual PostgreSQL root/file lock wait');
}

suite('Captured source, tags and scan acquisition own file-match persistence', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a lookup held across same-owner acquisition replacement cannot overwrite the newer real match or reconcile', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(c); const resume = gate(c);
    const first = await start(c, c.a, { afterLookup: async () => { entered.release(); await resume.promise; } });
    await first.waitForReady(entered.promise);
    await writeFile(c.path, 'New replacement source with a changed length and modified timestamp.');
    await expire(c); const replacement = await start(c, c.b, { extract: true, title: 'Montreal' }); await replacement.done;
    assert.equal(first.lease().ownerInstanceId, replacement.lease().ownerInstanceId);
    assert.notEqual(first.lease().acquisitionId, replacement.lease().acquisitionId);
    const current = await snapshot(c); const completed = await parent(c);
    assert.equal(current.matches[0].metadata_release_id, c.metadataB.metadataReleaseId);
    assert.equal(current.matches[0].match_status, 'matched'); assert.equal(completed.status, 'completed');
    resume.release(); await first.done;
    assert.deepEqual(await snapshot(c), current); assert.deepEqual(await parent(c), completed);
    assert.deepEqual(first.reconciliations, []); assert.equal(first.sidecars(), 1);
  }));

  test('source, tag and relevant scope drift after actual metadata lookup refuse old proposals', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['path', 'root', 'root_path', 'size', 'mtime', 'ignored', 'deleted', 'tags', 'scope', 'requested']) await scenario(t, async (c) => {
      const entered = gate(c); const resume = gate(c); const file = c.seed.files[0];
      const job = await start(c, c.a, { afterLookup: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
      if (drift === 'path') await c.pool.query('UPDATE library_files SET canonical_path=$2 WHERE id=$1', [file.id, join(c.rootPath, 'changed.flac')]);
      if (drift === 'root') {
        const root = (await c.pool.query("INSERT INTO library_roots(name,path,canonical_path) VALUES('Other',$1,$1) RETURNING id", [join(c.rootPath, 'other')])).rows[0].id;
        await c.pool.query('UPDATE library_files SET library_root_id=$2 WHERE id=$1', [file.id, root]);
      }
      if (drift === 'root_path') await c.pool.query('UPDATE library_roots SET canonical_path=$2 WHERE id=$1', [c.seed.libraryRootId, join(c.rootPath, 'changed')]);
      if (drift === 'size') await c.pool.query('UPDATE library_files SET size_bytes=size_bytes+1 WHERE id=$1', [file.id]);
      if (drift === 'mtime') await c.pool.query("UPDATE library_files SET modified_at=modified_at+INTERVAL '1 second' WHERE id=$1", [file.id]);
      if (drift === 'ignored') await c.pool.query("UPDATE library_files SET file_state='ignored' WHERE id=$1", [file.id]);
      if (drift === 'deleted') await c.pool.query('UPDATE library_files SET deleted_at=clock_timestamp() WHERE id=$1', [file.id]);
      if (drift === 'tags') await c.pool.query('UPDATE library_files SET tag_payload=$2::jsonb WHERE id=$1', [file.id, JSON.stringify(tags('Montreal'))]);
      if (drift === 'scope') await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{releaseHints}',$2::jsonb) WHERE id=$1",
        [c.run.id, JSON.stringify([{ canonicalPath: c.path, metadataReleaseId: c.metadataB.metadataReleaseId }])]);
      if (drift === 'requested') await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{libraryRoot}',to_jsonb($2::text)) WHERE id=$1", [c.run.id, join(c.rootPath, 'changed')]);
      const changed = await snapshot(c); resume.release(); await job.done;
      assert.deepEqual(await snapshot(c), changed, drift); assert.deepEqual(job.reconciliations, []);
      assert.notEqual((await parent(c)).status, 'completed');
    });
  });

  test('current cancellation and maintenance after lookup stop the batch and later reconciliation', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const reason of ['cancel', 'maintenance']) await scenario(t, async (c) => {
      const entered = gate(c); const resume = gate(c);
      const job = await start(c, c.a, { afterLookup: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise); const initial = await snapshot(c);
      if (reason === 'cancel') await createOperationRunControlService({ getPoolFn: c.getPoolFn })
        .requestOperationRunCancellation({ runId: c.run.id, requestedByUserId: null });
      else await c.maintenance.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Controlled matching pause' });
      resume.release(); await job.done;
      assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.reconciliations, []);
      assert.equal((await parent(c)).status, reason === 'cancel' ? 'cancelled' : 'pending');
    });
  });

  test('expiry across real root and file lock waits leaves every match unchanged', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const lock of ['root', 'file']) await scenario(t, async (c) => {
      const entered = gate(c); const resume = gate(c);
      const job = await start(c, c.a, { afterLookup: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise); const initial = await snapshot(c); const holder = await c.pool.connect();
      try {
        await holder.query('BEGIN');
        await holder.query(lock === 'root' ? 'SELECT id FROM library_roots WHERE id=$1 FOR UPDATE'
          : 'SELECT id FROM library_files WHERE id=$1 FOR UPDATE', [lock === 'root' ? c.seed.libraryRootId : c.seed.files[0].id]);
        const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [job.lease().leaseKey]);
        resume.release(); await waitForBlock(c, holderPid); await c.pool.query('SELECT pg_sleep(0.8)');
        await holder.query('COMMIT'); await job.done;
        assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.reconciliations, []);
      } finally { await holder.query('ROLLBACK'); holder.release(); }
    });
  });

  test('SQL faults, a partial CAS, final expiry and incomplete return identities roll back the entire two-file batch', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const failure of ['sql', 'cas', 'expiry', 'incomplete']) await scenario(t, async (c) => {
      const second = c.seed.files[1].id; let initial; let writes = 0; let provisional;
      if (failure === 'sql') await c.pool.query(`CREATE FUNCTION reject_match_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.library_file_id='${second}'::uuid THEN RAISE EXCEPTION 'Controlled matching SQL failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_match_write BEFORE INSERT ON library_file_matches FOR EACH ROW EXECUTE FUNCTION reject_match_write()`);
      const owner = c.createOwner(async (input) => {
        writes += 1; initial = await snapshot(c);
        const result = await c.rawMatches.writeLibraryFileMatchBatch({ ...input, beforeWrite: async (stage) => {
          await input.beforeWrite(stage);
          if (failure === 'cas') await input.queryable.query('UPDATE library_files SET tag_payload=$2::jsonb WHERE id=$1', [second, JSON.stringify(tags('Montreal'))]);
        } });
        provisional = (await input.queryable.query("SELECT COUNT(*)::integer AS count FROM library_file_matches WHERE match_status='matched'")).rows[0].count;
        if (failure === 'expiry') await input.queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);
        return failure === 'incomplete' ? { libraryFileIds: result.libraryFileIds.slice(1) } : result;
      });
      const job = await start(c, c.a, { owner }); await job.done;
      assert.equal(writes, 1); assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.reconciliations, []);
      if (failure === 'expiry' || failure === 'incomplete') assert.equal(provisional, 2);
      if (failure === 'sql') assert.match((await parent(c)).error_message, /Controlled matching SQL failure/u);
      assert.notEqual((await parent(c)).status, 'completed');
    }, { twoFiles: true });
  });

  test('current nullable tags match as missing while JSON null and an empty object cannot be adopted as the old SQL null', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const change of ['none', 'json_null', 'object']) {
      t.diagnostic(`Controlled nullable-tag variant: ${change}`);
      await scenario(t, async (c) => {
      const entered = gate(c); const resume = gate(c);
      const job = await start(c, c.a, { afterLookup: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
      if (change !== 'none') await c.pool.query('UPDATE library_files SET tag_payload=$2::jsonb WHERE id=$1', [c.seed.files[0].id, change === 'json_null' ? 'null' : '{}']);
      const initial = await snapshot(c); resume.release(); await job.done;
      if (change === 'none') {
        assert.equal((await snapshot(c)).matches[0].matched_by, 'missing_tag_payload');
        assert.equal((await parent(c)).status, 'completed');
      } else {
        assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.reconciliations, []);
        assert.notEqual((await parent(c)).status, 'completed');
      }
      }, { nullTags: true });
    }
  });

  test('equivalent JSON key order, unrelated hints and post-extraction presentation stamps preserve current matches', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const positive of ['json_order', 'unrelated_hint', 'new_stamps', 'scoped']) await scenario(t, async (c) => {
      if (positive === 'new_stamps') await c.pool.query('UPDATE library_files SET tag_extracted_size_bytes=NULL,tag_extracted_modified_at=NULL WHERE id=$1', [c.seed.files[0].id]);
      const job = await start(c, c.a, { extract: positive === 'new_stamps', afterLookup: async () => {
        if (positive === 'json_order') await c.pool.query('UPDATE library_files SET tag_payload=$2::jsonb WHERE id=$1',
          [c.seed.files[0].id, JSON.stringify(Object.fromEntries(Object.entries(tags()).reverse()))]);
        if (positive === 'unrelated_hint') await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{releaseHints}',$2::jsonb) WHERE id=$1",
          [c.run.id, JSON.stringify([{ canonicalPath: join(c.rootPath, 'unrelated.flac'), metadataReleaseId: c.metadataB.metadataReleaseId }])]);
      } });
      await job.done; const current = await snapshot(c);
      assert.equal(current.matches[0].metadata_release_id, c.metadataA.metadataReleaseId);
      assert.equal(current.matches[0].matched_by, 'conventional_tags');
      assert.equal(current.matches[0].confidence, positive === 'scoped' ? 'high' : 'medium');
      assert.equal((await parent(c)).status, 'completed'); assert.deepEqual(job.reconciliations, ['releases', 'wanted', 'discovery']);
      if (positive === 'new_stamps') assert.equal(current.files[0].tag_extracted_size_bytes, current.files[0].size_bytes);
    }, { scoped: positive === 'scoped' });
  });

  test('match persistence serializes with current catalogue, tag and organize root-first writers without deadlock', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const other of ['catalogue', 'tag', 'organize']) await scenario(t, async (c) => {
      const entered = gate(c); const resume = gate(c); let matchPid;
      const owner = c.createOwner(async (input) => {
        matchPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const queryable = { query: async (sql, values) => {
          const result = await input.queryable.query(sql, values);
          if (sql.includes('INSERT INTO library_file_matches')) { entered.release(); await resume.promise; }
          return result;
        } };
        return c.rawMatches.writeLibraryFileMatchBatch({ ...input, queryable });
      });
      const organizeRuns = c.makeRuns('matching-organize-coexistence', 'library_organize_apply');
      const organizeRun = await organizeRuns.createOperationRun({ status: 'pending' });
      const lease = await organizeRuns.acquireLease({ runId: organizeRun.id }); await organizeRuns.markRunStarted({ runId: organizeRun.id, expectedLease: lease });
      const destination = join(c.rootPath, 'organized.flac'); const media = createMediaFilesystemService();
      const prepared = captureOrganizeMutation({ runId: organizeRun.id, expectedLease: lease,
        file: { fileId: c.seed.files[0].id, libraryRootId: c.seed.libraryRootId, libraryRootPath: c.rootPath,
          currentPath: c.path, proposedPath: destination, proposedRelativePath: 'organized.flac' },
        plan: media.createExclusiveFileMutationPlan({ requestedMode: 'move', removeSourceAfterSuccess: true,
          sourcePath: c.path, sourceRoot: c.rootPath, destinationPath: destination, destinationRoot: c.rootPath }) });
      const tagRuns = c.makeRuns('matching-tag-coexistence');
      const tagRun = await tagRuns.createOperationRun({ status: 'pending', summary: { libraryRoot: c.requestedRoot } });
      const tagLease = await tagRuns.acquireLease({ runId: tagRun.id });
      await tagRuns.markRunStarted({ runId: tagRun.id, expectedLease: tagLease });
      const tagPrepared = captureTagSnapshotSource({ runId: tagRun.id, expectedLease: tagLease,
        requestedLibraryRoot: c.requestedRoot, libraryRootPath: c.rootPath, libraryRootId: c.seed.libraryRootId, file: c.seed.files[0] });
      const job = await start(c, c.a, { owner }); await job.waitForReady(entered.promise);
      const contender = other === 'catalogue' ? c.catalog.recordLibraryFiles({ libraryRootPath: c.rootPath, files: c.seed.files })
        : other === 'tag' ? c.tagOwner.writeOwnedLibraryFileTagSnapshot({ prepared: tagPrepared,
          payload: { status: 'extracted', extractor: 'coexisting-control', normalizedTags: tags() } })
          : c.withTransaction((queryable) => createLibraryOrganizeMutationStore().lockContext({ prepared, queryable }));
      c.scope.track(contender);
      try { await waitForBlock(c, matchPid); } finally { resume.release(); }
      await contender; await job.done;
      assert.equal((await snapshot(c)).matches[0].match_status, 'matched'); assert.equal((await parent(c)).status, 'completed');
      await organizeRuns.releaseLease({ runId: organizeRun.id, expectedLease: lease, status: 'completed' });
      await tagRuns.releaseLease({ runId: tagRun.id, expectedLease: tagLease, status: 'completed' });
    });
  });
});
