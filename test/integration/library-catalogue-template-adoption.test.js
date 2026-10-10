/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';
import { assertNoPendingMigrations } from '../../src/server/migrations.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { buildPostgresAdminConnectionConfig } from '../../testing/postgres-temporary-database.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';
import { prepareMigrationTemplateDatabase } from '../../testing/integration/migration-template-preparation.js';
import { startLibraryScanCatalogueFixtureWorker } from '../../testing/integration/library-scan-catalogue-worker-fixture.js';
import { observeCatalogueFixtureFiles, snapshotCatalogueFixture,
  withLibraryScanCatalogueScenario } from '../../testing/integration/library-scan-catalogue-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let serverRuntime; let env; let unavailable;

async function explicitTemplateRuntime(t, options = {}) {
  const runtime = await createPostgresIntegrationRuntime({ config, env, schemaMode: 'migration_template', ...options });
  t.after(() => runtime.cleanup());
  assert.equal(runtime.schemaMode, 'migration_template');
  return runtime;
}

function start(c) {
  return startLibraryScanCatalogueFixtureWorker({ scope: c.scope, runs: c.a, runId: c.run.id,
    requestedRoot: c.requestedRoot, recordLibraryScanCatalogue: c.owner.recordLibraryScanCatalogue });
}

suite('Catalogue scenarios retain fresh data and files under explicit templates', () => {
  before(async () => {
    try {
      serverRuntime = await createPostgresIntegrationRuntime({ config, schemaMode: 'empty' });
      await serverRuntime.runIsolatedDatabase(async ({ databaseConfig }) => {
        env = { PGHOST: databaseConfig.host, PGPORT: String(databaseConfig.port),
          PGUSER: databaseConfig.user, PGPASSWORD: databaseConfig.password,
          PGDATABASE: 'postgres', PGMAINTENANCE_DB: 'postgres' };
      });
    } catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailable = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await serverRuntime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a failed clone with catalogue rows, tombstones and a real fault trigger leaves the next clone and workspace fresh', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    let preparationCount = 0;
    const runtime = await explicitTemplateRuntime(t, {
      createPreparedPostgresTemplateFn: (options) => createPreparedPostgresTemplate({ ...options,
        prepareDatabaseFn: async (input) => { preparationCount += 1; return prepareMigrationTemplateDatabase(input); },
      }),
    });
    const primary = new Error('Controlled failure after a genuine catalogue commit'); let first;
    await assert.rejects(withLibraryScanCatalogueScenario(runtime, t, async (c) => {
      await writeFile(c.stable, c.replacementBytes); await rm(c.old); await writeFile(c.newFile, c.replacementBytes);
      const job = await start(c); await job.done;
      const genuine = await snapshotCatalogueFixture(c);
      assert.ok(genuine.files.find((file) => file.canonical_path === c.old).deleted_at);
      assert.equal(genuine.files.find((file) => file.canonical_path === c.newFile).deleted_at, null);
      assert.equal(genuine.files.find((file) => file.canonical_path === c.stable).size_bytes, String(c.replacementBytes.length));
      assert.equal((await c.pool.query('SELECT status FROM operation_runs WHERE id=$1', [c.run.id])).rows[0].status, 'completed');
      first = { databaseName: c.databaseName, root: c.requestedRoot, rootId: c.seed.libraryRootId,
        fileIds: genuine.files.map((file) => file.id), runId: c.run.id, leaseKey: job.lease().leaseKey };
      assert.equal((await c.pool.query('SELECT released_at IS NOT NULL AS released FROM job_leases WHERE lease_key=$1',
        [first.leaseKey])).rows[0].released, true);
      await c.pool.query(`CREATE FUNCTION controlled_catalogue_clone_fault() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'Controlled catalogue clone fault'; END; $$`);
      await c.pool.query(`CREATE TRIGGER controlled_catalogue_clone_fault BEFORE INSERT OR UPDATE ON library_files
        FOR EACH ROW EXECUTE FUNCTION controlled_catalogue_clone_fault()`);
      const observed = await observeCatalogueFixtureFiles(c.requestedRoot);
      await assert.rejects(c.catalog.recordLibraryFiles({ libraryRootPath: observed.summary.libraryRoot, files: observed.files }),
        (error) => error.code === 'P0001');
      assert.deepEqual(await snapshotCatalogueFixture(c), genuine);
      throw primary;
    }), (error) => error === primary);

    await withLibraryScanCatalogueScenario(runtime, t, async (c) => {
      assert.notEqual(c.databaseName, first.databaseName); assert.notEqual(c.requestedRoot, first.root);
      assert.notEqual(c.seed.libraryRootId, first.rootId); assert.notEqual(c.run.id, first.runId);
      const initial = await snapshotCatalogueFixture(c);
      assert.equal(initial.files.length, 3); assert.equal(initial.files.every((file) => file.deleted_at === null), true);
      assert.equal(initial.files.every((file) => !first.fileIds.includes(file.id)), true);
      assert.equal(initial.files.find((file) => file.canonical_path === c.stable).size_bytes, String(c.oldBytes.length));
      assert.deepEqual(await readFile(c.stable), c.oldBytes); assert.deepEqual(await readFile(c.old), c.oldBytes);
      await assert.rejects(readFile(c.newFile), (error) => error.code === 'ENOENT');
      assert.equal((await c.pool.query("SELECT to_regprocedure('controlled_catalogue_clone_fault()') AS fault")).rows[0].fault, null);
      assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM job_leases WHERE lease_key=$1', [first.leaseKey])).rows[0].count, 0);
      assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM operation_runs WHERE id=$1', [first.runId])).rows[0].count, 0);
      assert.deepEqual((await assertNoPendingMigrations({ getPoolFn: c.getPoolFn })).pending, []);
      const job = await start(c); await job.done;
      const current = await snapshotCatalogueFixture(c);
      assert.equal(current.files.filter((file) => !file.deleted_at).length, 3);
      assert.equal((await c.pool.query('SELECT status FROM operation_runs WHERE id=$1', [c.run.id])).rows[0].status, 'completed');
      assert.equal(job.downstream.includes('discovery'), true);
    });
    assert.equal(preparationCount, 1);
  });

  test('reopening the verified source refuses catalogue admission before workspace or seed with no empty fallback', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    const records = []; let sourceName; let sourceEnv;
    const runtime = await explicitTemplateRuntime(t, {
      phaseObserver: createFixturePhaseObserver({ onRecord: (record) => records.push(record) }),
      createPreparedPostgresTemplateFn: (options) => {
        sourceEnv = { ...options.env };
        return createPreparedPostgresTemplate({ ...options, prepareDatabaseFn: async (input) => {
          sourceName = (await input.getPoolFn().query('SELECT current_database() AS name')).rows[0].name;
          return prepareMigrationTemplateDatabase(input);
        } });
      },
    });
    assert.match(sourceName, /^[a-z][a-z0-9_]{0,62}$/u);
    const admin = new pg.Client(buildPostgresAdminConnectionConfig(sourceEnv));
    try {
      await admin.connect(); await admin.query(`ALTER DATABASE "${sourceName}" ALLOW_CONNECTIONS true`);
      const phaseRecordStart = records.length; let workspaceStarted = false; let callbackInvoked = false;
      await assert.rejects(withLibraryScanCatalogueScenario(runtime, t, async () => { callbackInvoked = true; }, {
        workspaceOptions: { createDirectory: async () => {
          workspaceStarted = true; throw new Error('Refused catalogue source started a workspace');
        } },
      }), (error) => error.code === 'fixture_template_not_quiescent');
      assert.equal(workspaceStarted, false); assert.equal(callbackInvoked, false);
      assert.equal(records.slice(phaseRecordStart).some((record) => record.phase === 'template_verify' && record.outcome === 'failed'), true);
      assert.equal(records.slice(phaseRecordStart).some((record) => ['schema_prepare', 'fixture_seed', 'scenario_work'].includes(record.phase)), false);
      assert.equal((await admin.query('SELECT datallowconn FROM pg_database WHERE datname=$1', [sourceName])).rows[0].datallowconn, true);
    } finally { await admin.end(); }
  });
});
