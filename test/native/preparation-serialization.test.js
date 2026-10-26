/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { withDatabasePreparation } from '/app/server-dist/database-preparation-owner-service.js';
import { databasePreparationLockKey } from '/app/server-dist/database-preparation-lock-store.js';
import { prepareDatabase } from '/app/server-dist/database-preparation.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '/app/server-dist/schema-bootstrap.js';
import { applyPendingMigrations } from '/app/server-dist/migrations.js';
import { checksumSql, loadMigrationManifest } from '/app/server-dist/migration-manifest.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { createPreparationLockProxy } from '../../testing/server/preparation-lock-proxy.js';

await requireDeploymentMemoryProfile();
const execute = promisify(execFile);
test('cooperating preparers share one database-local owner across bootstrap, commits, verification and lost replies', { timeout: 120_000 }, async t => {
  const admin = getPool(), owned = [], pools = new Set(), results = [], baseline = await loadMigrationManifest();
  const config = buildConnectionConfig();
  function pool(database, extra = {}) {
    const value = new pg.Pool({ ...config, database, max: 1, connectionTimeoutMillis: 5_000, ...extra });
    value.on('error', () => {}); pools.add(value); return value;
  }
  async function end(value) { await value.end(); pools.delete(value); }
  async function create() {
    const name = 'owned_preparation_' + randomUUID().replaceAll('-', '');
    assert.match(name, /^owned_preparation_[a-f0-9]{32}$/u);
    await admin.query('CREATE DATABASE ' + name); owned.push(name); return name;
  }
  async function until(probe, label) {
    const deadline = Date.now() + 10_000;
    while (!await probe()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline, label); await new Promise(resolve => { setTimeout(resolve, 10); }); }
  }
  async function unlocked(database) {
    return (await admin.query(`SELECT count(*)::integer AS count FROM pg_locks WHERE locktype='advisory' AND granted
      AND database=(SELECT oid FROM pg_database WHERE datname=$3) AND classid=$1::oid AND objid=$2::oid AND objsubid=2`, [...databasePreparationLockKey, database])).rows[0].count === 0;
  }
  async function held(start, inspect) {
    const gate = Promise.withResolvers(), entered = Promise.withResolvers();
    const operation = start(async context => { entered.resolve(context); await gate.promise; })
      .then(value => ({ value }), error => ({ failed: true, error }));
    return withWorkerTaskCleanup(async () => {
      const context = await Promise.race([entered.promise, operation.then(result => { throw result.failed ? result.error : new Error('Owner finished before fixture gate'); })]);
      await inspect(context); gate.resolve(); return operation;
    }, async () => { gate.resolve(); await operation; });
  }
  await withWorkerTaskCleanup(async () => {
    const database = await create(), writer = pool(database), observer = pool(database), contender = pool(database);
    const getPoolFn = () => writer;
    const composed = await held(hold => prepareDatabase({ getPoolFn,
      applyPendingMigrationsFn: async options => { await hold(options.preparation); return applyPendingMigrations(options); },
    }), async () => {
      assert.equal(await unlocked(database), false); assert.equal(writer.totalCount, 1);
      assert.equal((await observer.query('SELECT count(*)::integer AS count FROM schema_migrations')).rows[0].count, 115);
      for (const action of [() => bootstrapDatabaseSchemaFromSnapshot({ getPoolFn: () => contender }),
        () => applyPendingMigrations({ getPoolFn: () => contender, loadMigrationManifestFn: () => assert.fail('busy manifest observation') }),
        () => prepareDatabase({ getPoolFn: () => contender })]) await assert.rejects(action(), { code: 'database_preparation_busy' });
      for (const entry of ['migrate', 'prepare-database']) {
        await assert.rejects(execute(process.execPath, ['/app/server-dist/' + entry + '.js'], {
          env: { ...process.env, PGDATABASE: database, POSTGRES_DB: database, HARMONIARR_PG_POOL_MAX: '1' }, maxBuffer: 64 * 1024,
        }), error => error.code === 1 && /Another database preparer is active/u.test(error.stderr));
      }
    });
    assert.equal(composed.failed, undefined); assert.equal(composed.value.bootstrap.bootstrapped, true);
    assert.equal(composed.value.status.applied, 115); assert.equal(writer.totalCount, 1); assert.equal(await unlocked(database), true);
    results.push({ scenario: 'composed', poolMax: 1, oneCapturedClient: true, busyEntryPoints: 3, busyActualClis: 2, bootstrapAndFinalStatusCovered: true });

    const filename = '20990101_000001_preparation_fixture.sql', secondName = '20990101_000002_preparation_fixture.sql';
    const migration = (name, sql) => ({ filename: name, migrationKey: name.slice(0, 15), description: 'owned fixture', sql, checksum: checksumSql(sql) });
    const first = migration(filename, 'CREATE TABLE fixture_preparation_values(value integer); INSERT INTO fixture_preparation_values VALUES(1);');
    const second = migration(secondName, 'SELECT pg_advisory_xact_lock(741924,1); INSERT INTO fixture_preparation_values VALUES(2);');
    const manifest = rows => async () => [...baseline, ...rows];
    const clear = async () => { await observer.query('DROP TABLE IF EXISTS fixture_preparation_values'); await observer.query('DELETE FROM schema_migrations WHERE filename=ANY($1)', [[filename, secondName]]); };
    const gate = await observer.connect(); let operation, locked = false, settled;
    await withWorkerTaskCleanup(async () => {
      await gate.query('SELECT pg_advisory_lock(741924,1)'); locked = true;
      operation = applyPendingMigrations({ getPoolFn, loadMigrationManifestFn: manifest([first, second]) })
        .then(value => ({ value }), error => ({ failed: true, error })).then(result => { settled = result; return result; });
      await until(async () => {
        if (settled) throw settled.failed ? settled.error : new Error('Writer finished before second migration gate');
        return (await admin.query('SELECT pid FROM pg_stat_activity WHERE datname=$1 AND wait_event=$2', [database, 'advisory'])).rows.length === 1;
      }, 'second migration must reach real lock wait');
      assert.equal(await unlocked(database), false);
      assert.deepEqual((await gate.query('SELECT value FROM fixture_preparation_values')).rows, [{ value: 1 }]);
      await assert.rejects(applyPendingMigrations({ getPoolFn: () => contender,
        loadMigrationManifestFn: () => assert.fail('must lock before capturing history') }), { code: 'database_preparation_busy' });
      const other = await create(), otherPool = pool(other);
      assert.equal((await prepareDatabase({ getPoolFn: () => otherPool })).status.applied, 115);
      await gate.query('SELECT pg_advisory_unlock(741924,1)'); locked = false;
      assert.deepEqual((await operation).value, [filename, secondName]);
    }, async () => {
      await withWorkerTaskCleanup(async () => { if (locked) await gate.query('SELECT pg_advisory_unlock(741924,1)'); }, async () => {
        gate.release(true); if (operation) await operation;
      });
    });
    assert.deepEqual((await observer.query('SELECT value FROM fixture_preparation_values ORDER BY value')).rows, [{ value: 1 }, { value: 2 }]);
    assert.deepEqual(await applyPendingMigrations({ getPoolFn: () => contender, loadMigrationManifestFn: manifest([first, second]) }), []);
    results.push({ scenario: 'commits', realSecondMigrationLockWait: true, firstCommitVisible: true, contenderRefusedBeforeManifest: true, databaseLocal: true, replay: 0 }); await clear();

    const terminated = await held(hold => withDatabasePreparation({ getPoolFn }, hold), async context => {
      let ended = false; const onEnd = () => { ended = true; };
      context.client.once('end', onEnd);
      await withWorkerTaskCleanup(async () => {
        assert.equal((await admin.query('SELECT pg_terminate_backend($1) AS stopped', [context.client.processID])).rows[0].stopped, true);
        await until(() => unlocked(database), 'terminated backend must release its session lock');
        await until(() => ended, 'owned client must observe backend end');
      }, () => context.client.off('end', onEnd));
    });
    assert.equal(terminated.failed, true); assert.equal(terminated.error.code, 'database_preparation_connection_unavailable');
    assert.equal(writer.totalCount, 0);
    await withDatabasePreparation({ getPoolFn }, async () => {});
    results.push({ scenario: 'termination', realBackendTermination: true, lockReleased: true, clientDestroyed: true, subsequentOwnerSucceeded: true });

    const inherited = await writer.connect();
    await inherited.query('SELECT pg_advisory_lock($1::integer,$2::integer)', databasePreparationLockKey); inherited.release();
    await assert.rejects(withDatabasePreparation({ getPoolFn }, () => assert.fail('inherited owner work')), { code: 'database_preparation_lock_inherited' });
    assert.equal(writer.totalCount, 0); await until(() => unlocked(database), 'discarded inherited owner must retire');
    results.push({ scenario: 'inherited', refusedBeforeWork: true, clientDestroyed: true, lockReleased: true });

    for (const mode of ['acquire', 'unlock']) {
      const proxy = await createPreparationLockProxy(mode), proxied = pool(database, { port: proxy.port, ssl: false });
      let loads = 0, facts;
      await withWorkerTaskCleanup(async () => {
        await assert.rejects(applyPendingMigrations({ getPoolFn: () => proxied, loadMigrationManifestFn: async () => { loads++; return [...baseline, first]; } }),
          error => mode === 'unlock' ? error.code === 'database_preparation_unlock_unknown' : error instanceof Error);
        facts = proxy.facts(); assert.equal(proxied.totalCount, 0); assert.equal(loads, mode === 'acquire' ? 0 : 1);
      }, async () => { await withWorkerTaskCleanup(() => end(proxied), () => proxy.close()); });
      await until(() => unlocked(database), 'lost reply session must release its lock');
      const rows = (await observer.query('SELECT status FROM schema_migrations WHERE filename=$1', [filename])).rows;
      assert.deepEqual(rows, mode === 'acquire' ? [] : [{ status: 'applied' }]);
      const replay = await applyPendingMigrations({ getPoolFn, loadMigrationManifestFn: manifest([first]) });
      assert.equal(replay.length, mode === 'acquire' ? 1 : 0);
      results.push({ scenario: 'lost-' + mode, ...facts, clientDestroyed: true, manifestReads: loads, replay: replay.length, appliedHistoryPreserved: true }); await clear();
    }
  }, async () => {
    await withWorkerTaskCleanup(() => Promise.all([...pools].map(end)), async () => {
      await withWorkerTaskCleanup(async () => {
        for (const name of owned.toReversed()) {
          assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=$1', [name])).rows[0].count, 0);
          await admin.query('DROP DATABASE ' + name);
          assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_database WHERE datname=$1', [name])).rows[0].count, 0);
        }
      }, closePool);
    });
  });
  t.diagnostic(JSON.stringify({ results, actualChildClose: true, ownedDatabases: owned.length, databaseCreationAcknowledged: true, databasesRetired: true }));
});
