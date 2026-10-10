/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';
import { assertNoPendingMigrations } from '../../src/server/migrations.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { buildPostgresAdminConnectionConfig } from '../../testing/postgres-temporary-database.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';
import { prepareMigrationTemplateDatabase } from '../../testing/integration/migration-template-preparation.js';
import { startLibraryTagSnapshotFixtureWorker } from '../../testing/integration/library-tag-snapshot-worker-fixture.js';
import { snapshotTagFixture, withLibraryTagSnapshotScenario } from '../../testing/integration/library-tag-snapshot-scenario.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let serverRuntime;
let env;
let unavailable;

async function explicitTemplateRuntime(t, options = {}) {
  const runtime = await createPostgresIntegrationRuntime({ config, env, schemaMode: 'migration_template', ...options });
  t.after(() => runtime.cleanup());
  assert.equal(runtime.schemaMode, 'migration_template');
  return runtime;
}

suite('Tag scenarios retain independent state under explicit migration templates', () => {
  before(async () => {
    try {
      serverRuntime = await createPostgresIntegrationRuntime({ config });
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

  test('failed clone with genuine tags, fault triggers and lease rows leaves the next native scenario pristine', { timeout: config.scenarioTimeoutMs }, async (t) => {
    if (unavailable) { t.skip(unavailable); return; }
    let preparationCount = 0;
    const runtime = await explicitTemplateRuntime(t, {
      createPreparedPostgresTemplateFn: (options) => createPreparedPostgresTemplate({ ...options,
        prepareDatabaseFn: async (input) => { preparationCount += 1; return prepareMigrationTemplateDatabase(input); },
      }),
    });
    const primary = new Error('Controlled failure after a genuine clone-local tag commit');
    let first;
    await assert.rejects(withLibraryTagSnapshotScenario(runtime, t, async (c) => {
      const job = await startLibraryTagSnapshotFixtureWorker(c, c.a); await job.done;
      const genuine = await snapshotTagFixture(c);
      assert.equal(genuine.history.length, 1); assert.equal(genuine.history[0].status, 'extracted');
      assert.equal(genuine.files[0].tag_payload.title, 'Original title');
      assert.equal(job.artwork.length, 1);
      first = { databaseName: c.databaseName, root: c.requestedRoot, rootId: c.rootId, fileId: c.file.id,
        runId: c.run.id, leaseKey: job.lease().leaseKey };
      assert.equal((await c.pool.query('SELECT released_at IS NOT NULL AS released FROM job_leases WHERE lease_key=$1',
        [first.leaseKey])).rows[0].released, true);
      await c.pool.query(`CREATE FUNCTION controlled_template_tag_fault() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'Controlled clone-local tag fault'; END; $$`);
      await c.pool.query(`CREATE TRIGGER controlled_template_tag_fault BEFORE INSERT ON file_tag_snapshots
        FOR EACH ROW EXECUTE FUNCTION controlled_template_tag_fault()`);
      await assert.rejects(c.rawTags.writeLibraryFileTagSnapshot({ libraryFileId: c.file.id,
        extractor: 'controlled-trigger-check', status: 'failed' }), (error) => error.code === 'P0001');
      assert.deepEqual(await snapshotTagFixture(c), genuine);
      throw primary;
    }), (error) => error === primary);

    await withLibraryTagSnapshotScenario(runtime, t, async (c) => {
      assert.notEqual(c.databaseName, first.databaseName); assert.notEqual(c.requestedRoot, first.root);
      assert.notEqual(c.rootId, first.rootId); assert.notEqual(c.file.id, first.fileId); assert.notEqual(c.run.id, first.runId);
      const initial = await snapshotTagFixture(c);
      assert.equal(initial.files.length, 1); assert.equal(initial.files[0].tag_payload, null); assert.deepEqual(initial.history, []);
      assert.equal((await c.pool.query("SELECT to_regprocedure('controlled_template_tag_fault()') AS fault")).rows[0].fault, null);
      assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM job_leases WHERE lease_key=$1', [first.leaseKey])).rows[0].count, 0);
      assert.equal((await c.pool.query('SELECT count(*)::integer AS count FROM operation_runs WHERE id=$1', [first.runId])).rows[0].count, 0);
      assert.deepEqual((await assertNoPendingMigrations({ getPoolFn: c.getPoolFn })).pending, []);
      const job = await startLibraryTagSnapshotFixtureWorker(c, c.a); await job.done;
      const current = await snapshotTagFixture(c);
      assert.equal(current.history.length, 1); assert.equal(current.history[0].status, 'extracted');
      assert.equal(current.files[0].tag_payload.title, 'Original title');
      assert.equal(current.files[0].sample_rate_hz, 8000); assert.equal(current.files[0].bit_depth, 16);
      assert.equal(job.artwork.length, 1);
    });
    assert.equal(preparationCount, 1);
  });

  test('a reopened source origin refuses tag clone admission before workspace or seed without an empty fallback', { timeout: config.scenarioTimeoutMs }, async (t) => {
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
      await admin.connect();
      await admin.query(`ALTER DATABASE "${sourceName}" ALLOW_CONNECTIONS true`);
      const phaseRecordStart = records.length; let workspaceStarted = false; let callbackInvoked = false;
      await assert.rejects(withLibraryTagSnapshotScenario(runtime, t, async () => { callbackInvoked = true; }, {
        workspaceOptions: { createDirectory: async () => {
          workspaceStarted = true; throw new Error('A refused source started workspace creation');
        } },
      }), (error) => error.code === 'fixture_template_not_quiescent');
      assert.equal(workspaceStarted, false); assert.equal(callbackInvoked, false);
      assert.equal(records.slice(phaseRecordStart).some((record) => record.phase === 'template_verify' && record.outcome === 'failed'), true);
      assert.equal(records.slice(phaseRecordStart).some((record) => ['schema_prepare', 'fixture_seed', 'scenario_work'].includes(record.phase)), false);
      assert.equal((await admin.query('SELECT datallowconn FROM pg_database WHERE datname=$1', [sourceName])).rows[0].datallowconn, true);
    } finally { await admin.end(); }
  });
});
