/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '/app/server-dist/schema-bootstrap.js';
import { renderSchemaSnapshot } from '/app/server-dist/schema-snapshot-renderer.js';
import { assertMigrationPreparationSafe } from '/app/server-dist/migration-preparation-service.js';
import { loadMigrationManifest, checksumSql } from '/app/server-dist/migration-manifest.js';
import { databasePreparationLockKey } from '/app/server-dist/database-preparation-lock-store.js';
import { buildDatabaseMigrationStateReport } from '/app/server-dist/schema-migration-state-service.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { createMigrationCommitProxy } from '../../testing/server/migration-commit-proxy.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
test('snapshot DDL and all lineage receipts commit together or roll back across real interruption and COMMIT loss', { timeout: 120_000 }, async t => {
  const admin = getPool(), baseline = await loadMigrationManifest(), results = []; let databasesRetired = 0;
  async function until(probe, label) {
    const deadline = Date.now() + 10_000;
    while (!await probe()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, label); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  async function database(run) {
    const name = 'owned_snapshot_' + randomUUID().replaceAll('-', '');
    assert.match(name, /^owned_snapshot_[a-f0-9]{32}$/u);
    await admin.query('CREATE DATABASE ' + name);
    const config = { ...buildConnectionConfig(), database: name, max: 1, connectionTimeoutMillis: 5_000 };
    const writer = new pg.Pool({ ...config, application_name: 'atomic-snapshot-owner' }), observer = new pg.Pool(config);
    writer.on('error', () => {}); observer.on('error', () => {});
    const ownerGone = async () => (await admin.query(`SELECT count(*)::integer AS count FROM pg_locks WHERE locktype='advisory'
      AND database=(SELECT oid FROM pg_database WHERE datname=$3) AND classid=$1::oid AND objid=$2::oid AND objsubid=2`, [...databasePreparationLockKey, name])).rows[0].count === 0;
    const state = async (queryable = observer) => (await queryable.query(`SELECT
      to_regclass('public.schema_migrations')::text AS ledger,
      to_regprocedure('public.harmoniarr_generate_uuid()')::text AS uuid_function,
      (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','f','v','m','S')) AS relations,
      EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto') AS crypto`)).rows[0];
    const receipts = async (expected = baseline) => {
      const rows = (await observer.query('SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows.map(result => result.row);
      assert.equal(rows.length, expected.length); assert.equal(buildDatabaseMigrationStateReport({ databaseRows: rows, repoMigrations: expected }).current, true);
      return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    };
    const bootstrap = (extra = [], overrides = {}) => {
      const manifest = [...baseline, ...extra];
      return bootstrapDatabaseSchemaFromSnapshot({ getPoolFn: () => writer,
        assertMigrationPreparationSafeFn: options => assertMigrationPreparationSafe({ ...options, loadMigrationManifestFn: async () => manifest }),
        readFileFn: async () => renderSchemaSnapshot({ migrations: manifest }), ...overrides });
    };
    await withWorkerTaskCleanup(() => run({ name, config, writer, observer, ownerGone, state, receipts, bootstrap }), async () => {
      await withWorkerTaskCleanup(() => Promise.all([writer.end(), observer.end()]), async () => {
        assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=$1', [name])).rows[0].count, 0);
        await admin.query('DROP DATABASE ' + name);
        assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_database WHERE datname=$1', [name])).rows[0].count, 0);
        databasesRetired++;
      });
    });
  }
  const extra = sql => ({ filename: '20990101_000001_atomic_snapshot_fixture.sql', migrationKey: '20990101_000001', description: 'owned fixture', sql, checksum: checksumSql(sql) });
  await withWorkerTaskCleanup(async () => {
    for (const mode of ['commit', 'terminate']) await database(async f => {
      const before = await f.state(), gate = await f.observer.connect(); let operation, settled, locked = false;
      const tail = extra('SELECT pg_advisory_xact_lock(741925,1); CREATE TABLE fixture_snapshot_tail(value integer); INSERT INTO fixture_snapshot_tail VALUES(7);');
      await withWorkerTaskCleanup(async () => {
        await gate.query('SELECT pg_advisory_lock(741925,1)'); locked = true;
        operation = f.bootstrap([tail]).then(value => ({ value }), error => ({ failed: true, error })).then(result => { settled = result; return result; });
        await until(async () => {
          if (settled) throw settled.failed ? settled.error : new Error('Snapshot completed before fixture gate');
          return (await admin.query("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND application_name='atomic-snapshot-owner' AND wait_event='advisory'", [f.name])).rows.length === 1;
        }, 'full snapshot must reach the real tail lock wait');
        assert.deepEqual(await f.state(gate), before); assert.equal(await f.ownerGone(), false);
        if (mode === 'terminate') {
          const pid = (await admin.query("SELECT pid FROM pg_stat_activity WHERE datname=$1 AND application_name='atomic-snapshot-owner'", [f.name])).rows[0].pid;
          assert.equal((await admin.query('SELECT pg_terminate_backend($1) AS stopped', [pid])).rows[0].stopped, true);
        }
        await gate.query('SELECT pg_advisory_unlock(741925,1)'); locked = false;
        const result = await operation;
        if (mode === 'commit') { assert.equal(result.value.bootstrapped, true); }
        else { assert.equal(result.failed, true); assert.deepEqual(await f.state(gate), before); }
      }, async () => {
        await withWorkerTaskCleanup(async () => { if (locked) await gate.query('SELECT pg_advisory_unlock(741925,1)'); }, async () => {
          gate.release(true); if (operation) await operation;
        });
      });
      await until(f.ownerGone, 'snapshot owner must retire before reviewed replay');
      if (mode === 'terminate') assert.equal((await f.bootstrap([tail])).bootstrapped, true);
      await f.receipts([...baseline, tail]); assert.deepEqual((await f.observer.query('SELECT value FROM fixture_snapshot_tail')).rows, [{ value: 7 }]);
      results.push({ mode, fullSchemaAndReceiptsInvisibleBeforeCommit: true, finalReceipts: 116, interruptedRollback: mode === 'terminate' });
    });
    for (const mode of ['body-error', 'lineage-error']) await database(async f => {
      const before = await f.state();
      const tail = extra(mode === 'body-error' ? 'SELECT 1/0;' : `DELETE FROM schema_migrations WHERE filename='${baseline[0].filename}';`);
      await assert.rejects(f.bootstrap([tail]), { code: mode === 'body-error' ? '22012' : 'snapshot_migration_state_invalid' });
      assert.deepEqual(await f.state(), before); assert.equal(await f.ownerGone(), true);
      assert.equal((await f.bootstrap()).bootstrapped, true); await f.receipts();
      results.push({ mode, entireSnapshotRolledBack: true, noOutsideFailedReceipt: true, reviewedRetryReceipts: 115 });
    });
    await database(async f => {
      const before = await f.state();
      for (const source of [renderSchemaSnapshot({ migrations: baseline }) + '-- altered', renderSchemaSnapshot({ migrations: baseline.slice(0, -1) })]) {
        await assert.rejects(f.bootstrap([], { readFileFn: async () => source }), { code: 'snapshot_provenance_invalid' });
        assert.deepEqual(await f.state(), before);
      }
      results.push({ mode: 'provenance', tamperAndOldPrefixRefusedBeforeDdl: true });
    });
    for (const mode of ['before-dispatch', 'after-commit']) await database(async f => {
      const before = await f.state(), proxy = await createMigrationCommitProxy(mode);
      const proxied = new pg.Pool({ ...f.config, port: proxy.port, ssl: false }); proxied.on('error', () => {}); let facts;
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(f.bootstrap([], { getPoolFn: () => proxied }), { code: 'snapshot_commit_outcome_unknown' });
        facts = proxy.facts(); assert.equal(proxied.totalCount, 0);
      }, async () => { await withWorkerTaskCleanup(() => proxied.end(), () => proxy.close()); });
      await until(f.ownerGone, 'uncertain snapshot owner must retire before independent inspection');
      let committed;
      if (mode === 'before-dispatch') assert.deepEqual(await f.state(), before);
      else committed = await f.receipts();
      assert.equal((await f.bootstrap()).bootstrapped, mode === 'before-dispatch');
      const after = await f.receipts(); if (committed) assert.equal(after, committed);
      results.push({ mode, ...facts, clientDestroyed: true, reviewedReplayBootstrapped: mode === 'before-dispatch', finalReceipts: 115, appliedHistoryPreserved: true });
    });
  }, closePool);
  t.diagnostic(JSON.stringify({ results, realPostgresTailWait: true, realProtocolLoss: true, historicalMigrations: baseline.length,
    databasesRetired, databaseCreationAcknowledged: true }));
});
