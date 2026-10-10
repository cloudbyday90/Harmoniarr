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
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withTemporaryPostgresDatabase } from '../../testing/postgres-temporary-database.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createFixtureGate, waitForFixtureReady, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';

const records = []; let runtime;
const phaseObserver = createFixturePhaseObserver({ onRecord: (record) => records.push(record) });
const environment = (config) => ({ PGDATABASE: config.database, PGMAINTENANCE_DB: 'postgres',
  PGHOST: config.host, PGUSER: config.user, PGPASSWORD: config.password, PGPORT: String(config.port) });

suite('Observed fixture phases retain PostgreSQL ownership and cooperative cleanup', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ phaseObserver }); });
  after(async () => { await runtime?.cleanup(); });

  test('an existing database survives a refused creation with its live connection and row intact', async () => {
    await runtime.runIsolatedDatabase(async ({ databaseConfig, databaseName, getPoolFn }) => {
      const pool = getPoolFn();
      await pool.query('CREATE TABLE fixture_guard(value text NOT NULL); INSERT INTO fixture_guard VALUES(\'retained\')');
      const start = records.length;
      await assert.rejects(withTemporaryPostgresDatabase({ databaseName, env: environment(databaseConfig),
        phaseObserver: phaseObserver.child(), run: () => assert.fail('Refused creation must not run a scenario') }), { code: '42P04' });
      assert.equal((await pool.query('SELECT value FROM fixture_guard')).rows[0].value, 'retained');
      assert.ok(!records.slice(start).some((record) => ['backend_drain', 'database_drop'].includes(record.phase)));
    });
  });

  test('a primary failure releases and drains a borrowed client before owned database cleanup without touching a sibling', async () => {
    let admin; let sibling; let siblingCreated = false; let ownedName;
    const siblingName = `harmoniarr_fixture_guard_${randomUUID().replaceAll('-', '')}`;
    try {
      await runtime.runIsolatedDatabase(async ({ databaseConfig, databaseName, getPoolFn, phaseObserver: observer }) => {
        ownedName = databaseName;
        admin = new pg.Client({ ...databaseConfig, database: 'postgres' }); await admin.connect();
        await admin.query(`CREATE DATABASE "${siblingName}"`); siblingCreated = true;
        sibling = new pg.Client({ ...databaseConfig, database: siblingName }); await sibling.connect();
        await sibling.query('CREATE TABLE fixture_guard(value text NOT NULL); INSERT INTO fixture_guard VALUES(\'sibling\')');
        const primary = new Error('Controlled original fixture failure'); const order = [];
        await assert.rejects(observer.measure('scenario_work', () => withFixtureLifecycle({}, async (scope) => {
          const ready = createFixtureGate(); const held = createFixtureGate({ signal: scope.signal });
          scope.onRelease(() => held.release());
          const operation = scope.track((async () => {
            const client = await getPoolFn().connect();
            try { await client.query('SELECT 1'); ready.release(); await held.promise; }
            finally { client.release(); order.push('released'); }
          })());
          await waitForFixtureReady({ ready: ready.promise, operation });
          throw primary;
        })), (error) => error === primary);
        assert.deepEqual(order, ['released']);
        assert.equal((await getPoolFn().query('SELECT 1 AS healthy')).rows[0].healthy, 1);
      });
      assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1', [ownedName])).rowCount, 0);
      assert.equal((await sibling.query('SELECT value FROM fixture_guard')).rows[0].value, 'sibling');
      assert.ok(records.some((record) => record.phase === 'scenario_work' && record.outcome === 'failed'));
    } finally {
      await sibling?.end();
      if (siblingCreated) await admin.query(`DROP DATABASE "${siblingName}"`);
      await admin?.end();
    }
  });
});
