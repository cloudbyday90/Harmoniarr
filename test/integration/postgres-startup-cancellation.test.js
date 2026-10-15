/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createPreparedPostgresTemplate } from '../../testing/integration/postgres-migration-template.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const executeFile = promisify(execFile); const active = new Set();
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

function startServer() {
  assert.equal(config.useContainerReuse, false);
  return new PostgreSqlContainer(config.postgresImage).withStartupTimeout(config.startupTimeoutMs)
    .withDatabase('harmoniarr').withUsername('harmoniarr').withPassword('harmoniarr').start();
}
function serverConfig(owner) {
  return { database: 'postgres', host: owner.getHost(), port: owner.getPort(), user: owner.getUsername(),
    password: owner.getPassword(), connectionTimeoutMillis: config.poolConnectionTimeoutMs };
}
async function assertRetired(owner) {
  const { stdout } = await executeFile('docker', ['container', 'ls', '--all', '--no-trunc', '--quiet', '--filter', `id=${owner.getId()}`],
    { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
  assert.equal(stdout.trim(), '');
}

for (const schemaMode of ['empty', 'migration_template']) {
  test(`${schemaMode} cancelled real start drains acknowledgement and shutdown before rejecting`, {
    timeout: config.suiteSetupTimeoutMs + config.suiteTeardownTimeoutMs,
  }, t => registered((async () => {
    const reason = schemaMode === 'empty' ? new Error('controlled-abort') : null;
    const controller = new AbortController(); const started = createFixtureGate({ signal: t.signal });
    const startHold = createFixtureGate({ signal: t.signal }); const stopping = createFixtureGate({ signal: t.signal });
    const stopHold = createFixtureGate({ signal: t.signal });
    let owner; let pending; let runtime; let observer; let observerClosed = false; let settled = false;
    let stops = 0; let retired = false; let metadata = 0; let prepared = false;
    await withWorkerTaskCleanup(async () => {
      pending = createPostgresIntegrationRuntime({ config, schemaMode, signal: controller.signal,
        env: { HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS: 'off' },
        createPostgresContainer: () => ({ start: async () => {
          owner = await startServer(); started.release(); await startHold.promise;
          return { getDatabase: () => { metadata++; return owner.getDatabase(); }, getHost: () => owner.getHost(),
            getPassword: () => owner.getPassword(), getPort: () => owner.getPort(), getUsername: () => owner.getUsername(),
            getId: () => owner.getId(), stop: async options => {
              stops++; assert.equal(options.timeout, config.containerStopTimeoutMs);
              stopping.release(); await stopHold.promise; await owner.stop(options); retired = true;
              throw new Error('secondary-post-stop');
            } };
        } }), createPreparedPostgresTemplateFn: () => { prepared = true; assert.fail('Cancelled start prepared a template'); },
      });
      pending.then(value => { runtime = value; settled = true; }, () => { settled = true; });
      await waitForFixtureReady({ ready: started.promise, operation: pending, signal: t.signal });
      controller.abort(reason); await Promise.resolve(); assert.equal(settled, false); assert.equal(stops, 0);
      startHold.release(); await waitForFixtureReady({ ready: stopping.promise, operation: pending, signal: t.signal });
      assert.equal(settled, false); assert.equal(stops, 1); assert.equal(metadata, 0); assert.equal(retired, false);
      observer = new pg.Client(serverConfig(owner)); await observer.connect();
      assert.equal(Math.floor(Number((await observer.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000), 18);
      assert.equal((await observer.query('SELECT 42 AS answer')).rows[0].answer, 42);
      await observer.end(); observerClosed = true;
      stopHold.release(); await assert.rejects(pending, error => error === reason);
      assert.equal(stops, 1); assert.equal(retired, true); assert.equal(prepared, false); await assertRetired(owner);
    }, async () => {
      await withWorkerTaskCleanup(async () => { if (observer && !observerClosed) await observer.end(); }, async () => {
        startHold.release(); stopHold.release(); await pending?.catch(() => {}); await runtime?.cleanup().catch(() => {});
        if (owner && stops === 0) await owner.stop({ timeout: config.containerStopTimeoutMs });
      });
    });
  })()));
}

for (const borrowed of [false, true]) {
  test(`cancelled ${borrowed ? 'borrowed' : 'owned'} prepared runtime releases the real template before publication`, {
    timeout: config.suiteSetupTimeoutMs + config.suiteTeardownTimeoutMs,
  }, t => registered((async () => {
    const reason = borrowed ? null : new Error('controlled-abort'); const controller = new AbortController();
    const prepared = createFixtureGate({ signal: t.signal }); const prepareHold = createFixtureGate({ signal: t.signal });
    const closing = createFixtureGate({ signal: t.signal }); const closeHold = createFixtureGate({ signal: t.signal });
    const databaseName = `harmoniarr_template_${randomUUID().replaceAll('-', '')}`;
    let owner; let observer; let observerClosed = false; let pending; let runtime; let manager;
    let stops = 0; let closes = 0; let settled = false; let released = false;
    await withWorkerTaskCleanup(async () => {
      owner = await startServer(); observer = new pg.Client(serverConfig(owner)); await observer.connect();
      const connection = serverConfig(owner);
      const env = borrowed ? { PGDATABASE: 'postgres', PGMAINTENANCE_DB: 'postgres', PGHOST: connection.host,
        PGPORT: String(connection.port), PGUSER: connection.user, PGPASSWORD: connection.password } : {};
      pending = createPostgresIntegrationRuntime({ config, env, schemaMode: 'migration_template', signal: controller.signal,
        createPostgresContainer: () => {
          assert.equal(borrowed, false);
          return { start: async () => ({ getDatabase: () => owner.getDatabase(), getHost: () => owner.getHost(),
            getPassword: () => owner.getPassword(), getPort: () => owner.getPort(), getUsername: () => owner.getUsername(),
            getId: () => owner.getId(), stop: async options => {
              stops++; assert.equal(options.timeout, config.containerStopTimeoutMs); assert.equal(released, true);
              assert.equal((await observer.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
              await observer.end(); observerClosed = true; await owner.stop(options);
              throw new Error('secondary-post-stop');
            } }) };
        },
        createPreparedPostgresTemplateFn: async options => {
          manager = await createPreparedPostgresTemplate({ ...options, databaseName });
          prepared.release(); await prepareHold.promise;
          return { runIsolatedDatabase: () => assert.fail('Cancelled runtime admitted a clone'), cleanup: async () => {
            closes++; closing.release(); await closeHold.promise; await manager.cleanup(); released = true;
            throw new Error('secondary-post-template-close');
          } };
        },
      });
      pending.then(value => { runtime = value; settled = true; }, () => { settled = true; });
      await waitForFixtureReady({ ready: prepared.promise, operation: pending, signal: t.signal });
      const identity = (await observer.query('SELECT oid::text AS oid, datallowconn FROM pg_database WHERE datname=$1', [databaseName])).rows[0];
      assert.ok(identity?.oid); assert.equal(identity.datallowconn, false);
      controller.abort(reason); prepareHold.release();
      await waitForFixtureReady({ ready: closing.promise, operation: pending, signal: t.signal });
      assert.equal(settled, false); assert.equal(stops, 0); assert.equal(closes, 1); assert.equal(released, false);
      assert.deepEqual((await observer.query('SELECT oid::text AS oid, datallowconn FROM pg_database WHERE datname=$1', [databaseName])).rows[0], identity);
      assert.equal((await observer.query('SELECT 42 AS answer')).rows[0].answer, 42);
      closeHold.release(); await assert.rejects(pending, error => error === reason);
      assert.equal(closes, 1); assert.equal(released, true); assert.equal(stops, borrowed ? 0 : 1);
      if (borrowed) {
        assert.equal((await observer.query('SELECT oid FROM pg_database WHERE datname=$1', [databaseName])).rowCount, 0);
        assert.equal((await observer.query('SELECT 43 AS answer')).rows[0].answer, 43);
      } else await assertRetired(owner);
    }, async () => {
      prepareHold.release(); closeHold.release(); await pending?.catch(() => {}); await runtime?.cleanup().catch(() => {});
      await withWorkerTaskCleanup(async () => { await manager?.cleanup(); }, async () => {
        await withWorkerTaskCleanup(async () => { if (observer && !observerClosed) await observer.end(); }, async () => {
          // Borrowed server belongs only to this test; failed ownership transfer may also leave our unattempted server.
          if (owner && (borrowed || stops === 0)) await owner.stop({ timeout: config.containerStopTimeoutMs });
        });
      });
    });
  })()));
}
