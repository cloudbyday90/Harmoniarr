/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';

import { createJobLeaseStore } from '../../src/server/job-lease-store.js';
import { assertNoPendingMigrations } from '../../src/server/migrations.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { buildPostgresAdminConnectionConfig } from '../../testing/postgres-temporary-database.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';
import { loadMigrationTemplateInputs } from '../../testing/integration/migration-template-inputs.js';
import { prepareMigrationTemplateDatabase } from '../../testing/integration/migration-template-preparation.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailable;
let env;
let admin;

function ownedDatabaseName(kind) {
  return `harmoniarr_${kind}_${randomUUID().replaceAll('-', '')}`;
}

function quotedName(name) {
  assert.match(name, /^[a-z][a-z0-9_]{0,62}$/u);
  return `"${name}"`;
}

async function databaseIdentity(name) {
  return (await admin.query('SELECT oid::text AS oid, datallowconn FROM pg_database WHERE datname=$1', [name])).rows[0] ?? null;
}

function poolFactory(databaseConfig) {
  return new pg.Pool({ ...databaseConfig, max: 2, connectionTimeoutMillis: config.poolConnectionTimeoutMs,
    idleTimeoutMillis: config.poolIdleTimeoutMs, allowExitOnIdle: config.poolAllowExitOnIdle });
}

async function createManager(t, options = {}) {
  const manager = await createPreparedPostgresTemplate({ env, createPool: poolFactory, ...options });
  let cleanupStarted = false;
  const cleanup = async () => {
    if (cleanupStarted) return;
    cleanupStarted = true;
    await manager.cleanup();
  };
  t.after(cleanup);
  return { manager, cleanup };
}

async function siblingDatabase(t) {
  const name = ownedDatabaseName('sibling');
  await admin.query(`CREATE DATABASE ${quotedName(name)} TEMPLATE template0`);
  const pool = poolFactory({ ...buildPostgresAdminConnectionConfig(env), database: name });
  t.after(async () => {
    try { await pool.end(); }
    finally { await admin.query(`DROP DATABASE ${quotedName(name)}`); }
  });
  await pool.query('CREATE TABLE controlled_sibling(value integer NOT NULL)');
  await pool.query('INSERT INTO controlled_sibling(value) VALUES (17)');
  const originalIdentity = await databaseIdentity(name);
  return {
    name,
    async assertUnchanged() {
      assert.deepEqual(await databaseIdentity(name), originalIdentity);
      assert.deepEqual((await pool.query('SELECT value FROM controlled_sibling')).rows, [{ value: 17 }]);
    },
  };
}

function skipIfUnavailable(t) {
  if (!unavailable) return false;
  t.skip(unavailable);
  return true;
}

suite('Owned migration-only PostgreSQL templates', () => {
  before(async () => {
    try {
      runtime = await createPostgresIntegrationRuntime({ config });
      await runtime.runIsolatedDatabase(async ({ databaseConfig }) => {
        env = { PGHOST: databaseConfig.host, PGPORT: String(databaseConfig.port),
          PGUSER: databaseConfig.user, PGPASSWORD: databaseConfig.password,
          PGDATABASE: 'postgres', PGMAINTENANCE_DB: 'postgres' };
      });
      admin = new pg.Client(buildPostgresAdminConnectionConfig(env));
      await admin.connect();
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });

  after(async () => {
    try { await admin?.end(); }
    finally { await runtime?.cleanup(); }
  }, { timeout: config.suiteTeardownTimeoutMs });

  test('one preparation serves independent clone rows, fault triggers and acquired leases', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    let preparationCount = 0;
    let sourceName;
    let sourcePool;
    const { manager, cleanup } = await createManager(t, {
      prepareDatabaseFn: async (input) => {
        preparationCount += 1;
        sourcePool = input.getPoolFn();
        sourceName = (await sourcePool.query('SELECT current_database() AS name')).rows[0].name;
        return prepareMigrationTemplateDatabase(input);
      },
    });
    assert.equal(manager.schemaMode, 'migration_template');
    for (const key of ['sourcePool', 'getPoolFn', 'databaseName', 'databaseConfig', 'source']) {
      assert.equal(Object.hasOwn(manager, key), false);
    }
    const cloneNames = [];
    const clonePools = [];
    await manager.runIsolatedDatabase(async ({ databaseName, getPoolFn, schemaMode }) => {
      assert.equal(schemaMode, 'migration_template');
      const pool = getPoolFn();
      cloneNames.push(databaseName); clonePools.push(pool);
      assert.notEqual(databaseName, sourceName); assert.notEqual(pool, sourcePool);
      assert.deepEqual((await assertNoPendingMigrations({ getPoolFn })).pending, []);
      await pool.query('CREATE TABLE controlled_clone_rows(value integer NOT NULL)');
      await pool.query('INSERT INTO controlled_clone_rows(value) VALUES (1)');
      await pool.query(`CREATE FUNCTION controlled_clone_fault() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'controlled clone-only failure'; END $$`);
      await pool.query(`CREATE TRIGGER controlled_clone_fault BEFORE INSERT ON controlled_clone_rows
        FOR EACH ROW EXECUTE FUNCTION controlled_clone_fault()`);
      await assert.rejects(pool.query('INSERT INTO controlled_clone_rows(value) VALUES (2)'), (error) => error.code === 'P0001');
      const lease = await createJobLeaseStore({ getPoolFn, ownerInstanceId: 'controlled-clone-owner' })
        .acquireLease({ jobType: 'library_scan', leaseKey: 'controlled-template-isolation' });
      assert.equal(typeof lease.acquisitionId, 'string');
      await pool.query('UPDATE schema_migrations SET application_version=$1', ['controlled-clone-only-version']);
    });
    await manager.runIsolatedDatabase(async ({ databaseName, getPoolFn }) => {
      const pool = getPoolFn();
      cloneNames.push(databaseName); clonePools.push(pool);
      assert.notEqual(databaseName, sourceName); assert.notEqual(pool, sourcePool);
      assert.deepEqual((await assertNoPendingMigrations({ getPoolFn })).pending, []);
      assert.equal((await pool.query("SELECT to_regclass('controlled_clone_rows') AS table_name")).rows[0].table_name, null);
      assert.equal((await pool.query("SELECT to_regprocedure('controlled_clone_fault()') AS function_name")).rows[0].function_name, null);
      assert.equal((await pool.query('SELECT count(*)::integer AS count FROM job_leases WHERE lease_key=$1', ['controlled-template-isolation'])).rows[0].count, 0);
      assert.equal((await pool.query('SELECT count(*)::integer AS count FROM schema_migrations WHERE application_version=$1',
        ['controlled-clone-only-version'])).rows[0].count, 0);
      await pool.query('CREATE TABLE controlled_clone_rows(value integer NOT NULL)');
      await pool.query('INSERT INTO controlled_clone_rows(value) VALUES (3)');
      assert.deepEqual((await pool.query('SELECT value FROM controlled_clone_rows')).rows, [{ value: 3 }]);
    });
    assert.equal(preparationCount, 1);
    assert.equal(new Set(cloneNames).size, 2);
    assert.equal(new Set(clonePools).size, 2);
    for (const name of cloneNames) assert.equal(await databaseIdentity(name), null);
    await cleanup();
    assert.equal(await databaseIdentity(sourceName), null);
  });

  test('the verified source refuses actual connections while clone connections remain usable', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    let sourceConfig;
    const { manager } = await createManager(t, {
      prepareDatabaseFn: async (input) => {
        sourceConfig = { ...buildPostgresAdminConnectionConfig(env), database: input.getPoolFn().options.database };
        return prepareMigrationTemplateDatabase(input);
      },
    });
    assert.equal((await databaseIdentity(sourceConfig.database)).datallowconn, false);
    const forbiddenClient = new pg.Client(sourceConfig);
    forbiddenClient.on('error', () => {});
    try { await assert.rejects(forbiddenClient.connect(), (error) => error.code === '55000'); }
    finally { await forbiddenClient.end(); }
    await manager.runIsolatedDatabase(async ({ getPoolFn }) => {
      assert.equal((await getPoolFn().query('SELECT 1 AS value')).rows[0].value, 1);
    });
  });

  test('failed schema preparation preserves its cause, drops only its acknowledged source and leaves a sibling intact', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const sibling = await siblingDatabase(t);
    const primary = new Error('Controlled migration preparation failure');
    let sourceName;
    await assert.rejects(createPreparedPostgresTemplate({ env, createPool: poolFactory,
      prepareDatabaseFn: async (input) => {
        sourceName = input.getPoolFn().options.database;
        await prepareMigrationTemplateDatabase(input);
        throw primary;
      },
    }), (error) => error === primary);
    assert.equal(await databaseIdentity(sourceName), null);
    await sibling.assertUnchanged();
  });

  test('an independent active source session prevents publication and its cleanup termination is observed', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    let sourceName;
    let activeClient;
    let terminationObserved = false;
    t.after(async () => { await activeClient?.end(); });
    await assert.rejects(createPreparedPostgresTemplate({ env, createPool: poolFactory,
      prepareDatabaseFn: async (input) => {
        await prepareMigrationTemplateDatabase(input);
        const sourceConfig = { ...buildPostgresAdminConnectionConfig(env), database: input.getPoolFn().options.database };
        sourceName = sourceConfig.database;
        activeClient = new pg.Client(sourceConfig);
        // Register before connecting; owned cleanup may terminate this deliberate
        // external session while refusing publication of a non-quiescent source.
        activeClient.on('error', () => { terminationObserved = true; });
        await activeClient.connect();
        await activeClient.query('SELECT 1');
      },
    }), (error) => error.code === 'fixture_template_not_quiescent');
    assert.equal(terminationObserved, true);
    assert.equal(await databaseIdentity(sourceName), null);
  });

  test('a CREATE name collision never authorizes termination or deletion of the existing sibling', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const sibling = await siblingDatabase(t);
    let preparationStarted = false;
    await assert.rejects(createPreparedPostgresTemplate({ env, createPool: poolFactory, databaseName: sibling.name,
      prepareDatabaseFn: async () => { preparationStarted = true; },
    }), (error) => error.code === '42P04');
    assert.equal(preparationStarted, false);
    await sibling.assertUnchanged();
  });

  test('changed source fingerprints refuse clone admission without fallback or scenario invocation', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    let originalInputs;
    let drift = false;
    let invoked = false;
    const { manager } = await createManager(t, {
      loadInputsFn: async (...args) => {
        originalInputs ??= await loadMigrationTemplateInputs(...args);
        return drift ? { ...originalInputs, sourceFingerprint: originalInputs.sourceFingerprint === 'f'.repeat(64)
          ? 'e'.repeat(64) : 'f'.repeat(64) } : originalInputs;
      },
    });
    drift = true;
    await assert.rejects(manager.runIsolatedDatabase(async () => { invoked = true; }),
      (error) => error.code === 'fixture_template_fingerprint_changed');
    assert.equal(invoked, false);
  });

  test('pre-abort forbids scenarios and original case errors survive secondary pool cleanup without affecting siblings', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    const sibling = await siblingDatabase(t);
    const primary = new Error('Controlled original clone scenario failure');
    const cancellation = new Error('Controlled clone cancellation');
    const secondary = new Error('Controlled clone pool cleanup failure');
    const pools = [];
    let sourceName;
    const { manager } = await createManager(t, {
      createPool: (databaseConfig) => {
        const pool = poolFactory(databaseConfig);
        const end = pool.end.bind(pool);
        pool.end = async () => {
          await end();
          if (databaseConfig.database !== sourceName) throw secondary;
        };
        pools.push(databaseConfig.database);
        return pool;
      },
      prepareDatabaseFn: async (input) => {
        sourceName = input.getPoolFn().options.database;
        return prepareMigrationTemplateDatabase(input);
      },
    });
    const controller = new AbortController();
    controller.abort(cancellation);
    let invoked = false;
    await assert.rejects(manager.runIsolatedDatabase(async () => { invoked = true; }, { signal: controller.signal }),
      (error) => error === cancellation);
    assert.equal(invoked, false); assert.equal(pools.length, 1);
    await assert.rejects(manager.runIsolatedDatabase(async ({ getPoolFn }) => {
      await getPoolFn().query('CREATE TABLE controlled_failed_case(value integer)');
      throw primary;
    }), (error) => error === primary);
    assert.equal(pools.length, 2);
    assert.equal(await databaseIdentity(pools[1]), null);
    await sibling.assertUnchanged();
  });

  test('observed replacement OID refuses cloning and owned cleanup leaves the replacement untouched', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (skipIfUnavailable(t)) return;
    let sourceName;
    const { manager, cleanup } = await createManager(t, {
      prepareDatabaseFn: async (input) => {
        sourceName = input.getPoolFn().options.database;
        return prepareMigrationTemplateDatabase(input);
      },
    });
    const original = await databaseIdentity(sourceName);
    await admin.query(`DROP DATABASE ${quotedName(sourceName)}`);
    await admin.query(`CREATE DATABASE ${quotedName(sourceName)} TEMPLATE template0`);
    const replacementPool = poolFactory({ ...buildPostgresAdminConnectionConfig(env), database: sourceName });
    t.after(async () => {
      try { await replacementPool.end(); }
      finally { await admin.query(`DROP DATABASE ${quotedName(sourceName)}`); }
    });
    await replacementPool.query('CREATE TABLE controlled_replacement(value integer NOT NULL)');
    await replacementPool.query('INSERT INTO controlled_replacement(value) VALUES (23)');
    const replacement = await databaseIdentity(sourceName);
    assert.notEqual(replacement.oid, original.oid);
    let invoked = false;
    await assert.rejects(manager.runIsolatedDatabase(async () => { invoked = true; }),
      (error) => error.code === 'fixture_template_identity_changed');
    assert.equal(invoked, false);
    await assert.rejects(cleanup(), (error) => error.code === 'fixture_template_identity_changed');
    assert.deepEqual(await databaseIdentity(sourceName), replacement);
    assert.deepEqual((await replacementPool.query('SELECT value FROM controlled_replacement')).rows, [{ value: 23 }]);
  });
});
