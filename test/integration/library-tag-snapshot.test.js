/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseFile } from 'music-metadata';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';
import { createOperationRunControlService } from '../../src/server/operation-run-control-service.js';
import { createLibraryTagExtractionService } from '../../src/server/library/library-tag-extraction-service.js';
import { createLibraryOrganizeMutationStore } from '../../src/server/library/library-organize-mutation-store.js';
import { captureOrganizeMutation } from '../../src/server/library/library-organize-mutation-policy.js';
import { createMediaFilesystemService } from '../../src/server/media/media-filesystem-service.js';
import { createScopedFixtureGate, startScopedFixtureWork } from '../../testing/integration/fixture-work-scope.js';
import { withRollbackFixtureClient } from '../../testing/integration/fixture-transaction-client.js';
import { startLibraryTagSnapshotFixtureWorker as start } from '../../testing/integration/library-tag-snapshot-worker-fixture.js';
import { observeTagFixtureFiles as observed, snapshotTagFixture as snapshot, taggedWav,
  withLibraryTagSnapshotScenario } from '../../testing/integration/library-tag-snapshot-scenario.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
const parent = async (c) => (await c.pool.query('SELECT * FROM operation_runs WHERE id=$1', [c.run.id])).rows[0];
const expire = (c) => c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);

async function scenario(t, callback) {
  if (unavailable) { t.skip(unavailable); return; }
  await withLibraryTagSnapshotScenario(runtime, t, callback);
}
function heldObserver(queryable, signal) {
  let inFlight = Promise.resolve();
  return { query: (...args) => {
    if (signal.aborted) throw signal.reason;
    inFlight = queryable.query(...args); return inFlight;
  }, drain: () => inFlight.then(() => undefined, () => undefined) };
}
async function waitForBlock(c, holderPid, queryable = c.pool, operation) {
  let outcome;
  operation?.then(() => { outcome = { completed: true }; }, (error) => { outcome = { error }; });
  const assertPending = () => {
    if (c.scope.signal.aborted) throw c.scope.signal.reason;
    if (outcome && Object.hasOwn(outcome, 'error')) throw outcome.error;
    if (outcome?.completed) throw Object.assign(new Error('Fixture operation completed before the required lock wait'), {
      code: 'fixture_operation_completed_before_ready',
    });
  };
  for (let count = 0; count < 100; count += 1) {
    assertPending();
    await queryable.query('SELECT pg_stat_clear_snapshot()');
    assertPending();
    const result = await queryable.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid]);
    assertPending();
    if (result.rowCount) return;
    await new Promise((done) => { setTimeout(done, 10); });
  }
  assert.fail('Expected the actual PostgreSQL root/file lock wait');
}

suite('Captured scan source and acquisition own native tag snapshot persistence', () => {
  before(async () => {
    try { runtime = await createPostgresIntegrationRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('old native parsing released after replacement persistence creates no history, metadata overwrite or artwork', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope);
    const first = await start(c, c.a, { afterParse: async (_path, metadata) => {
      assert.equal(metadata.common.title, 'Original title'); entered.release(); await resume.promise;
    } });
    await first.waitForReady(entered.promise);
    await writeFile(c.path, taggedWav('Replacement title with different length', 1600));
    await expire(c); const replacement = await start(c, c.b); await replacement.done;
    assert.notEqual(first.lease().acquisitionId, replacement.lease().acquisitionId);
    const current = await snapshot(c); const completed = await parent(c);
    assert.equal(current.history.length, 1); assert.equal(current.history[0].status, 'extracted');
    assert.equal(current.files[0].tag_payload.title, 'Replacement title with different length');
    assert.equal(current.files[0].sample_rate_hz, 8000); assert.equal(current.files[0].bit_depth, 16);
    assert.equal(completed.status, 'completed'); assert.equal(replacement.artwork.length, 1);
    resume.release(); await first.done;
    assert.deepEqual(await snapshot(c), current); assert.deepEqual(await parent(c), completed);
    assert.deepEqual(first.artwork, []); assert.deepEqual(first.downstream, []);
  }));

  test('changed source, root, state, deletion or requested frame refuse parsed results without failed fallback', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const drift of ['path', 'root_id', 'root_path', 'size', 'mtime', 'ignored', 'deleted', 'requested']) await scenario(t, async (c) => {
      const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope);
      const job = await start(c, c.a, { afterParse: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise);
      if (drift === 'path') await c.pool.query('UPDATE library_files SET canonical_path=$2 WHERE id=$1', [c.file.id, join(c.rootPath, 'changed.wav')]);
      if (drift === 'root_id') {
        const other = (await c.pool.query("INSERT INTO library_roots(name,path,canonical_path) VALUES('Other',$1,$1) RETURNING id", [join(c.rootPath, 'other')])).rows[0].id;
        await c.pool.query('UPDATE library_files SET library_root_id=$2 WHERE id=$1', [c.file.id, other]);
      }
      if (drift === 'root_path') await c.pool.query('UPDATE library_roots SET canonical_path=$2 WHERE id=$1', [c.rootId, join(c.rootPath, 'changed')]);
      if (drift === 'size') await c.pool.query('UPDATE library_files SET size_bytes=size_bytes+1 WHERE id=$1', [c.file.id]);
      if (drift === 'mtime') await c.pool.query("UPDATE library_files SET modified_at=modified_at+INTERVAL '1 second' WHERE id=$1", [c.file.id]);
      if (drift === 'ignored') await c.pool.query("UPDATE library_files SET file_state='ignored' WHERE id=$1", [c.file.id]);
      if (drift === 'deleted') await c.pool.query('UPDATE library_files SET deleted_at=clock_timestamp() WHERE id=$1', [c.file.id]);
      if (drift === 'requested') await c.pool.query("UPDATE operation_runs SET summary=jsonb_set(summary,'{libraryRoot}',to_jsonb($2::text)) WHERE id=$1", [c.run.id, join(c.rootPath, 'changed')]);
      const changed = await snapshot(c); resume.release(); await job.done;
      assert.deepEqual(await snapshot(c), changed, drift); assert.equal(changed.history.length, 0);
      assert.deepEqual(job.artwork, []); assert.deepEqual(job.downstream, []);
      assert.notEqual((await parent(c)).status, 'completed');
    });
  });

  test('current cancellation and maintenance after native parsing use outer handlers without snapshot or artwork', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const reason of ['cancel', 'maintenance']) await scenario(t, async (c) => {
      const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope);
      const job = await start(c, c.a, { afterParse: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise); const initial = await snapshot(c);
      if (reason === 'cancel') await createOperationRunControlService({ getPoolFn: c.getPoolFn })
        .requestOperationRunCancellation({ runId: c.run.id, requestedByUserId: null });
      else await c.maintenance.acquireMaintenanceLock({ lockType: 'maintenance', reason: 'Controlled tag pause' });
      resume.release(); await job.done;
      assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.artwork, []); assert.deepEqual(job.downstream, []);
      assert.equal((await parent(c)).status, reason === 'cancel' ? 'cancelled' : 'pending');
    });
  });

  test('expiry after actual root or file lock waits refuses both history and current fields', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const lock of ['root', 'file']) await scenario(t, async (c) => {
      const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope);
      const job = await start(c, c.a, { afterParse: async () => { entered.release(); await resume.promise; } });
      await job.waitForReady(entered.promise); const initial = await snapshot(c);
      await startScopedFixtureWork(c.scope, () => withRollbackFixtureClient(c.pool, async (holder) => {
        await holder.query(lock === 'root' ? 'SELECT id FROM library_roots WHERE id=$1 FOR UPDATE'
          : 'SELECT id FROM library_files WHERE id=$1 FOR UPDATE', [lock === 'root' ? c.rootId : c.file.id]);
        const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await c.pool.query("UPDATE job_leases SET expires_at=clock_timestamp()+INTERVAL '700 milliseconds' WHERE lease_key=$1", [job.lease().leaseKey]);
        resume.release(); await waitForBlock(c, holderPid, holder, job.done); await holder.query('SELECT pg_sleep(0.8)');
        await holder.query('COMMIT'); await job.done;
        assert.deepEqual(await snapshot(c), initial); assert.deepEqual(job.artwork, []); assert.deepEqual(job.downstream, []);
      }));
    });
  });

  test('history INSERT, current UPDATE, zero-row CAS, final expiry and incomplete results roll back together once', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const failure of ['insert', 'update', 'cas', 'expiry', 'incomplete']) await scenario(t, async (c) => {
      if (failure === 'insert' || failure === 'update') await c.pool.query(`CREATE FUNCTION reject_tag_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'Controlled tag ${failure} failure'; END $$;
        CREATE TRIGGER reject_tag_write BEFORE ${failure === 'insert' ? 'INSERT ON file_tag_snapshots' : 'UPDATE ON library_files'}
        FOR EACH ROW EXECUTE FUNCTION reject_tag_write()`);
      let writes = 0; let initial;
      const owner = c.createTagOwner(async (input) => {
        writes += 1;
        initial = await snapshot(c);
        const result = await c.rawTags.writeLibraryFileTagSnapshot({ ...input, beforeWrite: async (stage) => {
          await input.beforeWrite(stage);
          if (failure === 'cas' && stage.stage === 'file_update') await input.queryable.query('UPDATE library_files SET size_bytes=size_bytes+1 WHERE id=$1', [c.file.id]);
        } });
        if (failure === 'expiry') await input.queryable.query("UPDATE job_leases SET expires_at=clock_timestamp()-INTERVAL '1 second' WHERE lease_key=$1", [`library_scan:${c.run.id}`]);
        return failure === 'incomplete' ? { ...result, snapshotId: 'invalid' } : result;
      });
      // The UPDATE fault is installed after the successful catalogue transaction.
      if (failure === 'update') await c.pool.query('ALTER TABLE library_files DISABLE TRIGGER reject_tag_write');
      const job = await start(c, c.a, { owner, afterParse: async () => {
        if (failure === 'update') await c.pool.query('ALTER TABLE library_files ENABLE TRIGGER reject_tag_write');
      } });
      await job.done;
      assert.equal(writes, 1); assert.deepEqual(await snapshot(c), initial);
      assert.equal((await snapshot(c)).history.length, 0); assert.deepEqual(job.artwork, []); assert.deepEqual(job.downstream, []);
      assert.notEqual((await parent(c)).status, 'completed');
    });
  });

  test('a genuine native parser failure persists once under current authority and preserves successful source stamps', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const lease = await c.a.acquireLease({ runId: c.run.id });
    if (lease) c.scope.onAfterDrain(() => c.a.releaseLease({ runId: c.run.id, expectedLease: lease, status: 'completed' }));
    assert.equal(await c.a.markRunStarted({ runId: c.run.id, expectedLease: lease, summary: { libraryRoot: c.requestedRoot } }), true);
    const artwork = [];
    const extraction = createLibraryTagExtractionService({ writeOwnedLibraryFileTagSnapshot: c.tagOwner.writeOwnedLibraryFileTagSnapshot,
      libraryEmbeddedArtworkService: { captureEmbeddedArtwork: async (input) => { artwork.push(input); } } });
    const context = { runId: c.run.id, expectedLease: lease, requestedLibraryRoot: c.requestedRoot,
      libraryRootPath: c.rootPath, libraryRootId: c.rootId };
    await extraction.extractLibraryFileTags({ ...context, files: [c.file] });
    const successful = (await snapshot(c)).files[0];
    assert.equal(successful.tag_payload.title, 'Original title'); assert.equal(artwork.length, 1);
    await writeFile(c.path, Buffer.from('RIFF'));
    await assert.rejects(parseFile(c.path), 'The truncated RIFF fixture must produce a genuine native parser error');
    const current = await observed(c.requestedRoot);
    const changed = await c.catalog.recordLibraryFiles({ libraryRootPath: c.rootPath, files: current.files });
    const result = await extraction.extractLibraryFileTags({ ...context, files: changed.files });
    const final = await snapshot(c);
    assert.equal(final.history.length, 2); assert.deepEqual(final.history.map((item) => item.status).sort(), ['extracted', 'failed']);
    assert.equal(result.files[0].tagPayload, null); assert.equal(final.files[0].tag_payload, null);
    assert.equal(final.files[0].audio_codec, null); assert.equal(final.files[0].file_state, 'observed');
    assert.equal(final.files[0].tag_extracted_size_bytes, successful.tag_extracted_size_bytes);
    assert.deepEqual(final.files[0].tag_extracted_modified_at, successful.tag_extracted_modified_at);
    assert.equal(artwork.length, 1);
  }));

  test('tag transactions serialize before catalogue and organize root/file snapshots without deadlock', { timeout: config.scenarioTimeoutMs }, async (t) => {
    for (const other of ['catalogue', 'organize']) await scenario(t, async (c) => {
      const entered = createScopedFixtureGate(c.scope); const resume = createScopedFixtureGate(c.scope); let tagPid;
      const owner = c.createTagOwner(async (input) => {
        tagPid = (await input.queryable.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const observer = heldObserver(input.queryable, c.scope.signal);
        const queryable = { query: async (sql, values) => {
          const result = await input.queryable.query(sql, values);
          if (sql.includes('INSERT INTO file_tag_snapshots')) {
            entered.release(observer);
            try { await resume.promise; } finally { await observer.drain(); }
          }
          return result;
        } };
        return c.rawTags.writeLibraryFileTagSnapshot({ ...input, queryable });
      });
      const organizeRuns = c.makeRuns('tag-organize-coexistence', 'library_organize_apply');
      const organizeRun = await organizeRuns.createOperationRun({ status: 'pending' });
      const lease = await organizeRuns.acquireLease({ runId: organizeRun.id });
      if (lease) c.scope.onAfterDrain(() => organizeRuns.releaseLease({ runId: organizeRun.id, expectedLease: lease, status: 'completed' }));
      await organizeRuns.markRunStarted({ runId: organizeRun.id, expectedLease: lease });
      const destination = join(c.rootPath, 'organized.wav'); const media = createMediaFilesystemService();
      const prepared = captureOrganizeMutation({ runId: organizeRun.id, expectedLease: lease,
        file: { fileId: c.file.id, libraryRootId: c.rootId, libraryRootPath: c.rootPath,
          currentPath: c.path, proposedPath: destination, proposedRelativePath: 'organized.wav' },
        plan: media.createExclusiveFileMutationPlan({ requestedMode: 'move', removeSourceAfterSuccess: true,
          sourcePath: c.path, sourceRoot: c.rootPath, destinationPath: destination, destinationRoot: c.rootPath }) });
      const job = await start(c, c.a, { owner }); const tagConnection = await job.waitForReady(entered.promise);
      const contender = startScopedFixtureWork(c.scope, () => other === 'catalogue'
        ? c.catalog.recordLibraryFiles({ libraryRootPath: c.rootPath, files: [c.file] })
        : c.withTransaction((queryable) => createLibraryOrganizeMutationStore().lockContext({ prepared, queryable })));
      try { await waitForBlock(c, tagPid, tagConnection, contender); } finally { resume.release(); }
      await contender; await job.done;
      assert.equal((await snapshot(c)).history.length, 1); assert.equal((await parent(c)).status, 'completed');
    });
  });

  test('a later file refusal leaves the earlier genuine tag commit and stops later matching or reconciliation', { timeout: config.scenarioTimeoutMs }, async (t) => scenario(t, async (c) => {
    const second = join(c.rootPath, '02-second.wav'); await writeFile(second, taggedWav('Second title'));
    const job = await start(c, c.a, { afterParse: async (path) => {
      if (path === second) await c.pool.query("UPDATE library_files SET file_state='ignored' WHERE canonical_path=$1", [second]);
    } });
    await job.done; const final = await snapshot(c);
    assert.equal(final.history.length, 1); assert.equal(final.history[0].library_file_id, c.file.id);
    assert.equal(final.files.find((file) => file.id === c.file.id).tag_payload.title, 'Original title');
    assert.equal(final.files.find((file) => file.canonical_path === second).file_state, 'ignored');
    assert.equal(job.artwork.length, 1); assert.deepEqual(job.downstream, []); assert.notEqual((await parent(c)).status, 'completed');
  }));
});
