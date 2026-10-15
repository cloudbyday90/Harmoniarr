/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { after, afterEach, before, suite, test } from 'node:test';
import pg from 'pg';
import { assertNoPendingMigrations } from '../../src/server/migrations.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { buildPostgresAdminConnectionConfig } from '../../testing/postgres-temporary-database.js';
import { createOwnedPostgresServer } from '../../testing/integration/owned-postgres-server.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';
import { prepareMigrationTemplateDatabase } from '../../testing/integration/migration-template-preparation.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { withMusicQueueRecoveryScenario } from '../../testing/integration/music-queue-recovery-scenario.js';
import { seedMusicQueueRecoveryFixture, seedMusicQueueRecoveryReplacement, recoverMusicQueueFixture,
  createRecoveryFixtureOwner } from '../../testing/integration/music-queue-recovery-fixtures.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); const active = new Set(); let server;
function tracked(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });
async function currentDatabase(pool) {
  return (await pool.query('SELECT datname AS name,oid::text AS oid FROM pg_database WHERE datname=current_database()')).rows[0];
}

suite('Recovery scenarios retain fresh committed state under migration templates', () => {
  before(() => tracked((async () => { server = await createOwnedPostgresServer({ config, env: {} }); })()),
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await server?.close(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const primary of [new Error('controlled-after-committed-recovery'), null]) {
    test(`failed recovery clone retains ${primary === null ? 'null' : 'Error'} while the next clone has no users, runs, events or faults`, {
      timeout: config.scenarioTimeoutMs,
    }, t => tracked((async () => {
      let runtime; let preparations = 0; let first;
      await withWorkerTaskCleanup(async () => {
        runtime = await createPostgresIntegrationRuntime({ config, env: server.env, schemaMode: 'migration_template',
          createPreparedPostgresTemplateFn: options => createPreparedPostgresTemplate({ ...options, prepareDatabaseFn: async input => {
            preparations++; return prepareMigrationTemplateDatabase(input);
          } }),
        });
        await assert.rejects(withMusicQueueRecoveryScenario(runtime, t, async context => {
          first = await currentDatabase(context.pool);
          assert.equal(context.pool.options.max, config.poolMax);
          assert.equal(context.pool.options.connectionTimeoutMillis, config.poolConnectionTimeoutMs);
          const fixture = await seedMusicQueueRecoveryFixture(context, { shared: true, fallback: true });
          const replacement = await seedMusicQueueRecoveryReplacement(context, fixture);
          const result = await recoverMusicQueueFixture(context, fixture);
          assert.equal(result.recovered, true); assert.equal(result.nextCandidateId, replacement.id);
          assert.equal((await context.pool.query('SELECT count(*)::int AS count FROM operation_runs')).rows[0].count, 2);
          assert.ok((await context.pool.query('SELECT count(*)::int AS count FROM import_candidate_events')).rows[0].count > 0);
          await context.pool.query(`CREATE FUNCTION recovery_clone_fault() RETURNS trigger LANGUAGE plpgsql
            AS $$ BEGIN RAISE EXCEPTION 'Controlled clone-local recovery fault'; END $$`);
          await context.pool.query('CREATE TRIGGER recovery_clone_fault BEFORE INSERT ON app_users FOR EACH ROW EXECUTE FUNCTION recovery_clone_fault()');
          await assert.rejects(createRecoveryFixtureOwner(context.pool), error => error.code === 'P0001');
          throw primary;
        }), error => error === primary);
        await withMusicQueueRecoveryScenario(runtime, t, async context => {
          const second = await currentDatabase(context.pool); assert.notEqual(second.name, first.name); assert.notEqual(second.oid, first.oid);
          assert.equal((await context.pool.query('SELECT oid FROM pg_database WHERE datname=$1', [first.name])).rowCount, 0);
          for (const table of ['app_users', 'import_candidates', 'operation_runs', 'import_candidate_events', 'audit_events',
            'library_discovery_requests', 'library_wanted_releases']) {
            assert.equal((await context.pool.query(`SELECT count(*)::int AS count FROM ${table}`)).rows[0].count, 0, table);
          }
          assert.equal((await context.pool.query("SELECT to_regprocedure('recovery_clone_fault()') AS fault")).rows[0].fault, null);
          assert.deepEqual((await assertNoPendingMigrations({ getPoolFn: context.getPoolFn })).pending, []);
          const fixture = await seedMusicQueueRecoveryFixture(context); const replacement = await seedMusicQueueRecoveryReplacement(context, fixture);
          const result = await recoverMusicQueueFixture(context, fixture);
          assert.equal(result.recovered, true); assert.equal(result.nextCandidateId, replacement.id);
        });
        assert.equal(preparations, 1);
      }, async () => { await runtime?.cleanup(); });
    })()));
  }

  test('reopened recovery template refuses canonical admission before schema, context or scenario with no empty fallback', {
    timeout: config.scenarioTimeoutMs,
  }, t => tracked((async () => {
    let runtime; let admin; let sourceName; let sourceEnv; const records = [];
    await withWorkerTaskCleanup(async () => {
      runtime = await createPostgresIntegrationRuntime({ config, env: server.env, schemaMode: 'migration_template',
        phaseObserver: createFixturePhaseObserver({ onRecord: record => records.push(record) }),
        createPreparedPostgresTemplateFn: options => {
          sourceEnv = options.env;
          return createPreparedPostgresTemplate({ ...options, prepareDatabaseFn: async input => {
            sourceName = (await input.getPoolFn().query('SELECT current_database() AS name')).rows[0].name;
            return prepareMigrationTemplateDatabase(input);
          } });
        },
      });
      assert.match(sourceName, /^[a-z][a-z0-9_]{0,62}$/u);
      admin = new pg.Client(buildPostgresAdminConnectionConfig(sourceEnv)); await admin.connect();
      await admin.query(`ALTER DATABASE "${sourceName}" ALLOW_CONNECTIONS true`);
      const offset = records.length; let contextCreated = false; let invoked = false;
      await assert.rejects(withMusicQueueRecoveryScenario(runtime, t, () => { invoked = true; }, {
        createContext: () => { contextCreated = true; assert.fail('Refused template constructed a recovery context'); },
      }), { code: 'fixture_template_not_quiescent' });
      assert.equal(contextCreated, false); assert.equal(invoked, false);
      assert.equal(records.slice(offset).some(record => record.phase === 'template_verify' && record.outcome === 'failed'), true);
      assert.equal(records.slice(offset).some(record => ['schema_prepare', 'scenario_work'].includes(record.phase)), false);
      assert.equal((await admin.query('SELECT datallowconn FROM pg_database WHERE datname=$1', [sourceName])).rows[0].datallowconn, true);
    }, async () => {
      await withWorkerTaskCleanup(async () => { await admin?.end(); }, async () => { await runtime?.cleanup(); });
    });
  })()));
});
