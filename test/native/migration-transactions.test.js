/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import pg from 'pg';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { applyPendingMigrations } from '/app/server-dist/migrations.js';
import { checksumSql, loadMigrationManifest } from '/app/server-dist/migration-manifest.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createMigrationCommitProxy } from '../../testing/server/migration-commit-proxy.js';

await requireDeploymentMemoryProfile();
test('migration DDL and applied receipts share visibility, rollback and real lost-COMMIT outcomes', { timeout: 120_000 }, async t => {
  const pool = getPool(), baseline = await loadMigrationManifest(), results = [];
  const filename = '20990101_000001_fixture_atomic.sql', table = 'fixture_migration_atomic';
  const migration = sql => ({ filename, migrationKey: '20990101_000001', description: 'fixture atomic', sql, checksum: checksumSql(sql) });
  const sql = 'BEGIN; CREATE TABLE fixture_migration_atomic(value integer); INSERT INTO fixture_migration_atomic VALUES(7); COMMIT;';
  const manifest = extra => async () => [...baseline, extra];
  const state = async () => ({ table: (await pool.query("SELECT to_regclass('fixture_migration_atomic') AS name")).rows[0].name,
    rows: (await pool.query('SELECT status FROM schema_migrations WHERE filename=$1', [filename])).rows });
  async function clear() { await pool.query('DROP TABLE IF EXISTS ' + table); await pool.query('DELETE FROM schema_migrations WHERE filename=$1', [filename]); }
  async function until(probe, label) {
    const deadline = Date.now() + 10_000;
    while (!await probe()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, label); await new Promise(done => { setTimeout(done, 10); }); }
  }
  await withWorkerTaskCleanup(async () => {
    await pool.query(`CREATE FUNCTION fixture_migration_receipt_gate() RETURNS trigger LANGUAGE plpgsql AS $gate$
      BEGIN IF NEW.filename='20990101_000001_fixture_atomic.sql' AND NEW.status='applied' THEN
        PERFORM pg_advisory_xact_lock(741923,1);
      END IF; RETURN NEW; END $gate$;
      CREATE TRIGGER fixture_migration_receipt_gate BEFORE UPDATE ON schema_migrations
      FOR EACH ROW EXECUTE FUNCTION fixture_migration_receipt_gate();`);
    for (const mode of ['commit', 'terminate-before-commit']) {
      const gate = await pool.connect(), writer = new pg.Pool({ ...buildConnectionConfig(), application_name: 'fixture-migration-owner' });
      writer.on('error', () => {});
      let operation, settled, locked = false;
      await withWorkerTaskCleanup(async () => {
        await gate.query('SELECT pg_advisory_lock(741923,1)'); locked = true;
        operation = applyPendingMigrations({ getPoolFn: () => writer, loadMigrationManifestFn: manifest(migration(sql)) })
          .then(value => ({ value }), error => ({ error, failed: true })).then(result => { settled = result; return result; });
        await until(async () => {
          if (settled) throw settled.failed ? settled.error : new Error('Migration completed before the receipt gate.');
          return (await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name='fixture-migration-owner' AND wait_event='advisory'")).rows.length === 1;
        }, 'receipt must reach real PostgreSQL lock wait');
        assert.deepEqual(await state(), { table: null, rows: [] });
        if (mode === 'terminate-before-commit') {
          const pid = (await pool.query("SELECT pid FROM pg_stat_activity WHERE application_name='fixture-migration-owner'")).rows[0].pid;
          assert.equal((await pool.query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated, true);
        }
        await gate.query('SELECT pg_advisory_unlock(741923,1)'); locked = false;
        const result = await operation;
        if (mode === 'commit') { assert.deepEqual(result.value, [filename]); assert.deepEqual((await state()).rows, [{ status: 'applied' }]); }
        else {
          assert.equal(result.failed, true); assert.deepEqual(await state(), { table: null, rows: [] });
          assert.deepEqual(await applyPendingMigrations({ loadMigrationManifestFn: manifest(migration(sql)) }), [filename]);
        }
        assert.equal((await pool.query('SELECT value FROM ' + table)).rows[0].value, 7);
        results.push({ mode, uncommittedDdlAndReceiptInvisible: true, finalAppliedTogether: true });
      }, async () => {
        await withWorkerTaskCleanup(async () => {
          if (locked) await gate.query('SELECT pg_advisory_unlock(741923,1)');
        }, async () => {
          // Destroying this owned session also releases its gate if unlock failed.
          gate.release(true);
          await withWorkerTaskCleanup(async () => { if (operation) await operation; }, () => writer.end());
        });
      });
      await clear();
    }
    const failedSql = 'BEGIN; CREATE TABLE fixture_migration_atomic(value integer); SELECT 1/0; COMMIT;';
    await assert.rejects(applyPendingMigrations({ loadMigrationManifestFn: manifest(migration(failedSql)) }), error => error.code === '22012');
    assert.deepEqual(await state(), { table: null, rows: [{ status: 'failed' }] });
    results.push({ mode: 'body-error', ddlRolledBack: true, failedReceiptAfterRollback: true }); await clear();
    for (const mode of ['before-dispatch', 'after-commit']) {
      const proxy = await createMigrationCommitProxy(mode), writer = new pg.Pool({ ...buildConnectionConfig(), port: proxy.port, ssl: false, connectionTimeoutMillis: 5_000 });
      writer.on('error', () => {}); let facts;
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(applyPendingMigrations({ getPoolFn: () => writer, loadMigrationManifestFn: manifest(migration(sql)) }), { code: 'migration_commit_outcome_unknown' });
        facts = proxy.facts();
        await until(() => writer.totalCount === 0, 'uncertain client must be destroyed');
        if (mode === 'after-commit') assert.deepEqual((await state()).rows, [{ status: 'applied' }]);
        else {
          await until(async () => (await state()).table === null, 'disconnected transaction must roll back');
          assert.deepEqual(await state(), { table: null, rows: [] });
        }
      }, async () => { await writer.end(); await proxy.close(); });
      const replay = await applyPendingMigrations({ loadMigrationManifestFn: manifest(migration(sql)) });
      assert.equal(replay.length, mode === 'after-commit' ? 0 : 1);
      assert.deepEqual((await state()).rows, [{ status: 'applied' }]);
      assert.equal((await pool.query('SELECT value FROM ' + table)).rows[0].value, 7);
      results.push({ ...facts, uncertainConnectionDestroyed: true, replay: replay.length, noFailedReceiptOverwrite: true });
      await clear();
    }
    await pool.query('DROP TRIGGER fixture_migration_receipt_gate ON schema_migrations; DROP FUNCTION fixture_migration_receipt_gate()');
  }, closePool);
  t.diagnostic(JSON.stringify({ results, historicalMigrations: baseline.length, actualPostgresLockWait: true, realProtocolLoss: true }));
});
