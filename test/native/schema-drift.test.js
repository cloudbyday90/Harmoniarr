/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import test from 'node:test';
import pg from 'pg';
import { createServer } from 'node:net';
import { createSchemaObservationConnection } from '/app/server-dist/schema-observation-connection-service.js';
import { startSchemaDiagnosticTask } from '/app/server-dist/schema-diagnostic-task-service.js';
import { getPool, closePool, buildConnectionConfig } from '/app/server-dist/database.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '/app/server-dist/schema-bootstrap.js';
import { inspectDatabaseSchemaDrift } from '/app/server-dist/schema-drift-service.js';
import { withSchemaObservation } from '/app/server-dist/schema-observation-owner-service.js';
import { withDatabasePreparation } from '/app/server-dist/database-preparation-owner-service.js';
import { databasePreparationLockKey } from '/app/server-dist/database-preparation-lock-store.js';
import { withWorkerTaskCleanup } from '/app/server-dist/worker-task-cleanup.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';

await requireDeploymentMemoryProfile();
const execute = promisify(execFile);
test('restricted read-only schema diagnosis detects drift without repair and coordinates with real preparers', { timeout: 120_000 }, async t => {
  const admin = getPool(), token = randomUUID().replaceAll('-', '');
  const database = 'schema_drift_' + token, emptyDatabase = 'schema_empty_' + token, role = 'schema_reader_' + token;
  const databases = []; let roleCreated = false, owner, reader, empty, guard;
  const results = [];
  async function cli({ source = false, target = database } = {}) {
    const args = [source ? '/app/scripts/diagnose-schema.js' : '/app/server-dist/diagnose-schema.js'];
    const options = { env: { ...process.env, PGDATABASE: target, PGUSER: role }, timeout: 20_000, maxBuffer: 64 * 1024, windowsHide: true };
    try { return { code: 0, ...await execute(process.execPath, args, options) }; }
    catch (error) { assert.equal(error.killed, false); assert.equal(error.signal, null); assert.equal(typeof error.code, 'number'); return { code: error.code, stdout: error.stdout, stderr: error.stderr }; }
  }
  async function fingerprint() {
    const ledger = (await owner.query('SELECT row_to_json(s) AS row FROM schema_migrations s ORDER BY filename')).rows;
    const catalog = (await owner.query(`SELECT c.oid::text,c.xmin::text,c.relname,c.relkind FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.oid`)).rows;
    const functions = (await owner.query(`SELECT p.oid::text,p.xmin::text,pg_get_functiondef(p.oid) AS definition FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid`)).rows;
    return createHash('sha256').update(JSON.stringify({ ledger, catalog, functions })).digest('hex');
  }
  const locksGone = async () => (await admin.query(`SELECT count(*)::integer AS count FROM pg_locks WHERE locktype='advisory'
    AND database=(SELECT oid FROM pg_database WHERE datname=$3) AND classid=$1::oid AND objid=$2::oid AND objsubid=2`, [...databasePreparationLockKey, database])).rows[0].count === 0;
  await withWorkerTaskCleanup(async () => {
    for (const name of [database, emptyDatabase]) {
      assert.match(name, /^schema_(?:drift|empty)_[a-f0-9]{32}$/u); await admin.query('CREATE DATABASE ' + name); databases.push(name);
    }
    owner = new pg.Pool({ ...buildConnectionConfig(), database, max: 3 }); owner.on('error', () => {});
    assert.equal((await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn: () => owner })).bootstrapped, true);
    await admin.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`); roleCreated = true;
    await admin.query(`ALTER ROLE ${role} SET default_transaction_read_only=on`);
    await admin.query(`ALTER ROLE ${role} SET default_transaction_isolation='repeatable read'`);
    await owner.query(`GRANT USAGE ON SCHEMA public TO ${role}`); await owner.query(`GRANT SELECT ON schema_migrations TO ${role}`);
    reader = new pg.Pool({ ...buildConnectionConfig(), database, user: role, max: 2 }); reader.on('error', () => {});
    empty = new pg.Pool({ ...buildConnectionConfig(), database: emptyDatabase, user: role }); empty.on('error', () => {});
    const options = { createConnectionFn: () => createSchemaObservationConnection({ config: reader.options }) }, before = await fingerprint();
    const permission = (await reader.query("SELECT current_setting('transaction_read_only') AS readonly,rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user")).rows[0];
    assert.deepEqual(permission, { readonly: 'on', rolsuper: false, rolcreatedb: false, rolcreaterole: false });
    assert.equal((await inspectDatabaseSchemaDrift(options)).current, true);
    for (const source of [false, true]) { const result = await cli({ source }); assert.equal(result.code, 0); assert.match(result.stdout, /Migration lineage: current/u); }
    assert.equal(await fingerprint(), before); results.push('restricted-current-and-cli-wrappers');

    await withSchemaObservation(options, async client => {
      const settings = (await client.query("SELECT current_setting('transaction_read_only') AS readonly,current_setting('transaction_isolation') AS isolation,current_setting('lock_timeout') AS lock,current_setting('statement_timeout') AS statement,current_setting('transaction_timeout') AS transaction")).rows[0];
      assert.deepEqual(settings, { readonly: 'on', isolation: 'read committed', lock: '2s', statement: '5s', transaction: '15s' });
      assert.equal((await inspectDatabaseSchemaDrift(options)).current, true);
      await assert.rejects(withDatabasePreparation({ getPoolFn: () => owner }, async () => assert.fail('writer entered')), { code: 'database_preparation_busy' });
    });
    assert.equal(await locksGone(), true); results.push('concurrent-readers-refuse-preparer');
    await withDatabasePreparation({ getPoolFn: () => owner }, async () => {
      await assert.rejects(inspectDatabaseSchemaDrift(options), { code: 'schema_observation_busy' });
      const result = await cli(); assert.equal(result.code, 1); assert.match(result.stderr, /preparation is active/u);
    });
    assert.equal(await locksGone(), true); results.push('preparer-refuses-observers');

    const indexDefinition = (await owner.query("SELECT pg_get_indexdef('public.operation_runs_pending_dispatch_idx'::regclass) AS definition")).rows[0].definition;
    const corruptions = [
      ['missing-index', 'DROP INDEX operation_runs_pending_dispatch_idx', indexDefinition],
      ['nullable-column', 'ALTER TABLE operation_runs ALTER COLUMN status DROP NOT NULL', 'ALTER TABLE operation_runs ALTER COLUMN status SET NOT NULL'],
      ['disabled-trigger', 'ALTER TABLE app_users DISABLE TRIGGER app_users_root_authority_admission', 'ALTER TABLE app_users ENABLE TRIGGER app_users_root_authority_admission'],
    ];
    for (const [name, sql, restore] of corruptions) {
      await owner.query(sql); const changed = await fingerprint();
      await withWorkerTaskCleanup(async () => {
        const report = await inspectDatabaseSchemaDrift(options); assert.equal(report.lineage.state, 'current'); assert.equal(report.anchors.state, 'drift');
        const output = await cli(); assert.equal(output.code, 1); assert.match(output.stdout, /Schema diagnostics: attention/u);
        assert.doesNotMatch(output.stdout + output.stderr, /CREATE|pg_get_|functionDefinition/u); assert.equal(await fingerprint(), changed);
      }, () => owner.query(restore));
      assert.equal((await inspectDatabaseSchemaDrift(options)).current, true);
      results.push(name);
    }
    const filename = (await owner.query('SELECT filename FROM schema_migrations ORDER BY filename LIMIT 1')).rows[0].filename;
    await owner.query("UPDATE schema_migrations SET status='failed',error_message='private diagnostic error' WHERE filename=$1", [filename]);
    const failed = await inspectDatabaseSchemaDrift(options); assert.equal(failed.lineage.state, 'not_current'); assert.equal(failed.anchors.state, 'current');
    const failedCli = await cli(); assert.equal(failedCli.code, 1); assert.doesNotMatch(failedCli.stdout + failedCli.stderr, /private diagnostic error/u);
    await owner.query("UPDATE schema_migrations SET status='applied',error_message=NULL WHERE filename=$1", [filename]); results.push('lineage-distinct-from-drift');

    await owner.query(`REVOKE SELECT ON schema_migrations FROM ${role}`);
    const denied = await cli(); assert.equal(denied.code, 1); assert.match(denied.stderr, /Schema diagnostics unavailable/u); assert.doesNotMatch(denied.stderr, /permission denied|SELECT|schema_migrations/u);
    await owner.query(`GRANT SELECT ON schema_migrations TO ${role}`); results.push('permission-denied-unavailable');
    const blank = await inspectDatabaseSchemaDrift({ createConnectionFn: () => createSchemaObservationConnection({ config: empty.options }) });
    assert.equal(blank.lineage.state, 'unavailable'); assert.equal(blank.anchors.missing.length, 164);
    assert.equal((await cli({ target: emptyDatabase })).code, 1); results.push('empty-not-repaired');

    guard = await owner.connect(); await guard.query('BEGIN'); await guard.query('LOCK TABLE schema_migrations IN ACCESS EXCLUSIVE MODE');
    const start = Date.now(); await assert.rejects(inspectDatabaseSchemaDrift(options), { code: 'schema_diagnostics_unavailable' });
    assert.ok(Date.now() - start < 10_000); await guard.query('ROLLBACK'); guard.release(); guard = null;
    assert.equal(await locksGone(), true); results.push('real-lock-timeout');
    await assert.rejects(withSchemaObservation(options, async client => {
      await client.query('CREATE TABLE forbidden_diagnostic_write(id integer)');
    }), error => error.code === '25006');
    assert.equal((await owner.query("SELECT to_regclass('public.forbidden_diagnostic_write') AS name")).rows[0].name, null);
    assert.equal(await locksGone(), true); results.push('write-refused-and-lock-retired');
    const killed = new pg.Pool({ ...buildConnectionConfig(), database, user: role, max: 1 }); killed.on('error', () => {});
    await withWorkerTaskCleanup(async () => {
      await assert.rejects(withSchemaObservation({ createConnectionFn: () => createSchemaObservationConnection({ config: killed.options }) }, async client => {
        const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        assert.equal((await admin.query('SELECT pg_terminate_backend($1) AS stopped', [pid])).rows[0].stopped, true);
        await client.query('SELECT 1');
      }));
      assert.equal(killed.totalCount, 0);
      const deadline = Date.now() + 5_000;
      while (!await locksGone()) { t.signal.throwIfAborted(); assert.ok(Date.now() < deadline); await new Promise(resolve => { setTimeout(resolve, 10); }); }
      results.push('terminated-backend-discarded');
    }, () => killed.end());

    // Saturating the ordinary reader pool cannot queue the single-use observer.
    const held = await Promise.all([reader.connect(), reader.connect()]);
    await withWorkerTaskCleanup(async () => {
      assert.equal((await inspectDatabaseSchemaDrift(options)).current, true);
      assert.equal(reader.waitingCount, 0); results.push('saturated-pool-bypassed');
    }, () => { for (const client of held) client.release(); });

    for (const reason of ['cancel', 'deadline']) {
      const controller = new AbortController(), started = Promise.withResolvers(); let pid;
      const task = startSchemaDiagnosticTask(scope => withSchemaObservation({ ...options, scope }, async client => {
        pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const query = client.query('SELECT pg_sleep(30)'); started.resolve(); return query;
      }), { signal: controller.signal, timeoutMs: reason === 'deadline' ? 3_000 : 10_000 });
      const refused = assert.rejects(task.result, { code: 'schema_diagnostics_unavailable' });
      await Promise.race([started.promise, task.result]);
      if (reason === 'cancel') controller.abort();
      await refused; await task.drained;
      const limit = Date.now() + 5_000;
      while ((await admin.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE pid=$1', [pid])).rows[0].count) {
        t.signal.throwIfAborted(); assert.ok(Date.now() < limit); await new Promise(resolve => { setTimeout(resolve, 10); });
      }
      assert.equal(await locksGone(), true); results.push(reason + '-query-backend-and-lock-retired');
    }

    // A peer accepting TCP without PostgreSQL startup must not hold a diagnostic.
    const sockets = new Set();
    const blackhole = createServer(socket => { sockets.add(socket); socket.resume(); socket.once('close', () => sockets.delete(socket)); });
    await new Promise(resolve => { blackhole.listen(0, '127.0.0.1', resolve); });
    await withWorkerTaskCleanup(async () => {
      const started = Date.now();
      await assert.rejects(withSchemaObservation({ createConnectionFn: () => createSchemaObservationConnection({
        config: { ...buildConnectionConfig(), host: '127.0.0.1', port: blackhole.address().port, ssl: false }, connectionTimeoutMs: 100,
      }) }, () => assert.fail('startup stall admitted')));
      assert.ok(Date.now() - started < 5_000);
      await new Promise(resolve => { setImmediate(resolve); });
      results.push('startup-stall-bounded');
    }, async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => { blackhole.close(resolve); }); assert.equal(sockets.size, 0); });
  }, async () => {
    await withWorkerTaskCleanup(async () => {
      if (guard) { try { await guard.query('ROLLBACK'); } finally { guard.release(true); } }
      await Promise.all([owner?.end(), reader?.end(), empty?.end()]);
    }, async () => {
      for (const name of databases) {
        assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_stat_activity WHERE datname=$1', [name])).rows[0].count, 0);
        await admin.query('DROP DATABASE ' + name);
        assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_database WHERE datname=$1', [name])).rows[0].count, 0);
      }
      if (roleCreated) { await admin.query('DROP ROLE ' + role); assert.equal((await admin.query('SELECT count(*)::integer AS count FROM pg_roles WHERE rolname=$1', [role])).rows[0].count, 0); }
      await closePool();
    });
  });
  t.diagnostic(JSON.stringify({ results, restrictedRole: true, readonly: true, actualChildClose: true,
    databasesRetired: databases.length, roleRetired: roleCreated, preparationKeyReleased: true }));
});
