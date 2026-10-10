/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createScopedFixtureGate, startScopedFixtureWork } from '../../testing/integration/fixture-work-scope.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { createFixtureLockObserver, waitForFixturePostgresBlock } from '../../testing/integration/fixture-lock-observer.js';
import { startLibraryScanCatalogueFixtureWorker } from '../../testing/integration/library-scan-catalogue-worker-fixture.js';
import { withLibraryScanCatalogueScenario, snapshotCatalogueFixture as snapshot } from '../../testing/integration/library-scan-catalogue-scenario.js';
import { resolveLibraryTestSchemaMode } from '../../testing/integration/library-test-schema-policy.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
const gate = (c) => createScopedFixtureGate(c.scope);
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);

async function scenario(t, callback, options = {}) {
  if (unavailable) { t.skip(unavailable); return; }
  return withLibraryScanCatalogueScenario(runtime, t, callback, options);
}
async function start(c, runs, hooks = {}) {
  return startLibraryScanCatalogueFixtureWorker({ scope: c.scope, runs, runId: c.run.id, requestedRoot: c.requestedRoot,
    recordLibraryScanCatalogue: (hooks.owner ?? c.owner).recordLibraryScanCatalogue, afterWalk: hooks.afterWalk });
}
const waitForBlock = (c, holderPid, queryable, operation) => waitForFixturePostgresBlock({
  queryable, holderPid, operation, signal: c.scope.signal,
});

suite('Captured scan acquisition owns root, observations and missing-file tombstones', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config,
      schemaMode: resolveLibraryTestSchemaMode({ domain: 'catalogue', defaultMode: 'migration_template' }) }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('an actual old walk cannot overwrite sizes, new files, tags or tombstones after replacement persistence', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(c); const resume = gate(c);
    const first = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
    await first.waitForReady(entered.promise);
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
    const entered = gate(c); const resume = gate(c);
    const first = await start(c, c.a, { afterWalk: async (value) => { assert.equal(value.filesSeen, 0); entered.release(); await resume.promise; } });
    await first.waitForReady(entered.promise);
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
      const entered = gate(c); const resume = gate(c); const initial = await snapshot(c);
      const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
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
      const entered = gate(c); const resume = gate(c); const initial = await snapshot(c);
      const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
      await startScopedFixtureWork(c.scope, () => withRollbackFixtureClient(c.pool, async (holder) => {
        if (lock === 'root') await holder.query('SELECT id FROM library_roots WHERE id=$1 FOR UPDATE', [c.seed.libraryRootId]);
        else await holder.query('SELECT id FROM library_files WHERE canonical_path=$1 FOR UPDATE', [c.stable]);
        const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [job.lease().leaseKey]);
        resume.release(); await waitForBlock(c, holderPid, holder, job.done); await holder.query('SELECT pg_sleep(0.8)');
        await holder.query('COMMIT'); await job.done;
        assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
        assert.notEqual((await parent(c)).status, 'completed');
      }));
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
    c.scope.onAfterDrain(() => organizeRuns.releaseLease({ runId: organizeRun.id, expectedLease: lease, status: 'completed' }));
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
    const rootLocked = gate(c); const resume = gate(c); let scanPid; let observer;
    const owner = c.createOwner(async (input) => {
      scanPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const queryable = { query: async (sql, values) => {
        const result = await input.queryable.query(sql, values);
        if (sql.includes('INSERT INTO library_roots')) {
          observer = createFixtureLockObserver({ queryable: input.queryable, signal: c.scope.signal });
          rootLocked.release();
          try { await resume.promise; } finally { await observer.drain(); }
        }
        return result;
      } };
      return c.catalog.recordLibraryFiles({ ...input, queryable });
    });
    const job = await start(c, c.a, { owner }); await job.waitForReady(rootLocked.promise);
    const store = createLibraryOrganizeMutationStore();
    const organize = startScopedFixtureWork(c.scope, () => c.withTransaction((queryable) => store.lockContext({ prepared, queryable })));
    try { await waitForBlock(c, scanPid, observer, organize); } finally { resume.release(); }
    const context = await organize; await job.done;
    assert.equal(context.file.id, fileId); assert.equal(context.file.rootPath, c.rootPath);
    assert.equal((await parent(c)).status, 'completed'); assert.equal((await snapshot(c)).files.filter((file) => !file.deleted_at).length, 3);
  }));

  test('changed requested-root frame refuses the old successful walk without retargeting the catalogue', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = gate(c); const resume = gate(c); const initial = await snapshot(c);
    const job = await start(c, c.a, { afterWalk: async () => { entered.release(); await resume.promise; } });
    await job.waitForReady(entered.promise);
    await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{libraryRoot}',to_jsonb($2::text)) WHERE id=$1", [c.run.id, join(c.rootPath, 'changed')]);
    resume.release(); await job.done;
    assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.downstream, []);
    assert.notEqual((await parent(c)).status, 'completed');
  }));
});
