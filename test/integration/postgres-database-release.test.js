/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, suite, test } from 'node:test';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withTemporaryPostgresDatabase } from '../../testing/postgres-temporary-database.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createPostgresFailureEvidence } from '../../testing/integration/postgres-failure-evidence.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const active = new Set();
let server; let connectionConfig; let admin; let sibling;
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
function quoted(name) { assert.match(name, /^[a-z][a-z0-9_]{0,62}$/u); return `"${name}"`; }
async function databaseOid(name) {
  return (await admin.query('SELECT oid::text AS oid FROM pg_database WHERE datname=$1', [name])).rows[0]?.oid;
}
async function roleOid(name) {
  return (await admin.query('SELECT oid::text AS oid FROM pg_roles WHERE rolname=$1', [name])).rows[0]?.oid;
}

suite('strict shared database release with native permission refusal', () => {
  before(async () => {
    server = await createPostgresIntegrationRuntime({ config, env: {}, failureEvidenceFactory: options => {
      connectionConfig = options.connectionConfig; return createPostgresFailureEvidence(options);
    } });
    admin = new pg.Client({ ...connectionConfig, connectionTimeoutMillis: config.poolConnectionTimeoutMs });
    await admin.connect();
    assert.equal(Math.floor(Number((await admin.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000), 18);
    sibling = new pg.Client({ ...connectionConfig, database: 'harmoniarr', connectionTimeoutMillis: config.poolConnectionTimeoutMs });
    await sibling.connect();
    await sibling.query('CREATE TABLE release_sibling(value integer NOT NULL)');
    await sibling.query('INSERT INTO release_sibling(value) VALUES (17)');
  }, { timeout: config.suiteSetupTimeoutMs });
  afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });
  after(async () => {
    await Promise.allSettled([...active]);
    await withWorkerTaskCleanup(() => sibling?.end(), () => withWorkerTaskCleanup(() => admin?.end(), () => server?.cleanup()));
  }, { timeout: config.suiteTeardownTimeoutMs });

  for (const scenario of ['success', 'null']) {
    test(`${scenario} scenario awaits final close and retains exact outcome after real DROP permission refusal`, {
      timeout: config.scenarioTimeoutMs,
    }, t => registered((async () => {
      const role = `hx_release_${randomUUID().replaceAll('-', '')}`;
      const entered = createFixtureGate({ signal: t.signal }); const hold = createFixtureGate({ signal: t.signal });
      let expectedRoleOid; let target; let targetOid; let runtime; let pending; let dropFailure; let closed = false; let settled = false;
      const siblingOid = await databaseOid('harmoniarr');
      await withWorkerTaskCleanup(async () => {
        await admin.query(`CREATE ROLE ${quoted(role)} NOLOGIN`); expectedRoleOid = await roleOid(role);
        assert.ok(expectedRoleOid);
        runtime = await createPostgresIntegrationRuntime({ config, env: {
          PGHOST: connectionConfig.host, PGPORT: String(connectionConfig.port), PGUSER: connectionConfig.user,
          PGPASSWORD: connectionConfig.password, PGMAINTENANCE_DB: 'postgres',
          HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS: 'off',
        }, createPostgresContainer: () => assert.fail('Borrowed server was acquired'),
        withTemporaryPostgresDatabaseFn: options => withTemporaryPostgresDatabase({ ...options,
          parentClientFactory: () => null, adminClientFactory: input => {
            const client = new pg.Client({ ...input, connectionTimeoutMillis: config.poolConnectionTimeoutMs });
            return { connect: () => client.connect(), query: async (sql, values) => {
              if (sql.startsWith('DROP DATABASE')) {
                await client.query(`SET ROLE ${quoted(role)}`);
                try { return await client.query(sql, values); } catch (error) { dropFailure = error; throw error; }
              }
              return client.query(sql, values);
            }, end: () => withWorkerTaskCleanup(() => client.end(), async () => {
              entered.release(); await hold.promise; closed = true;
            }) };
          },
        }),
        });
        pending = runtime.runIsolatedDatabase(async context => {
          target = context.databaseName; targetOid = await databaseOid(target); assert.ok(targetOid);
          const pool = context.getPoolFn(); assert.equal(pool.options.max, config.poolMax);
          assert.equal(pool.options.connectionTimeoutMillis, config.poolConnectionTimeoutMs);
          assert.equal((await pool.query('SELECT 42 AS answer')).rows[0].answer, 42);
          if (scenario === 'null') throw null;
          return 'complete';
        }, { signal: t.signal });
        pending.then(() => { settled = true; }, () => { settled = true; });
        await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
        assert.equal(dropFailure?.code, '42501'); assert.equal(settled, false); assert.equal(closed, false);
        assert.equal(await databaseOid(target), targetOid);
        hold.release(); await assert.rejects(pending, error => error === (scenario === 'null' ? null : dropFailure));
        assert.equal(closed, true); await runtime.cleanup();
        assert.equal(await databaseOid(target), targetOid); assert.equal(await databaseOid('harmoniarr'), siblingOid);
        assert.deepEqual((await sibling.query('SELECT value FROM release_sibling')).rows, [{ value: 17 }]);
        assert.equal((await admin.query('SELECT 43 AS answer')).rows[0].answer, 43);
      }, async () => {
        hold.release(); await pending?.catch(() => {});
        await withWorkerTaskCleanup(() => runtime?.cleanup(), async () => {
          // Only this independent test owner reaps its exact retained target after the failed borrower release.
          if (targetOid) {
            assert.equal(await databaseOid(target), targetOid);
            await admin.query(`DROP DATABASE ${quoted(target)}`); assert.equal(await databaseOid(target), undefined);
          }
          if (expectedRoleOid) {
            assert.equal(await roleOid(role), expectedRoleOid);
            await admin.query(`DROP ROLE ${quoted(role)}`); assert.equal(await roleOid(role), undefined);
          }
        });
      });
    })()));
  }
});
