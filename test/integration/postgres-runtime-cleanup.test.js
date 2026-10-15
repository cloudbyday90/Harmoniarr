/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { promisify } from 'node:util';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const executeFile = promisify(execFile);
const active = new Set();
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

for (const schemaMode of ['empty', 'migration_template']) {
  test(`${schemaMode} native runtime reports a held failed stop while its owned PostgreSQL remains live`, {
    timeout: config.suiteSetupTimeoutMs + config.scenarioTimeoutMs + config.suiteTeardownTimeoutMs,
  }, t => registered((async () => {
    const failure = schemaMode === 'empty' ? new Error('controlled-stop') : null;
    const entered = createFixtureGate({ signal: t.signal }); const hold = createFixtureGate({ signal: t.signal });
    let owner; let runtime; let closing; let observer; let stopCalls = 0; let settled = false;
    await withWorkerTaskCleanup(async () => {
      runtime = await createPostgresIntegrationRuntime({ config, env: {}, schemaMode, signal: t.signal,
        createPostgresContainer: () => ({ start: async () => {
          owner = await new PostgreSqlContainer(config.postgresImage).withStartupTimeout(config.startupTimeoutMs)
            .withDatabase('harmoniarr').withUsername('harmoniarr').withPassword('harmoniarr').start();
          return {
            getDatabase: () => owner.getDatabase(), getHost: () => owner.getHost(), getPort: () => owner.getPort(),
            getUsername: () => owner.getUsername(), getPassword: () => owner.getPassword(), getId: () => owner.getId(),
            stop: async options => {
              stopCalls += 1; assert.equal(options.timeout, config.containerStopTimeoutMs);
              entered.release(); await hold.promise; throw failure;
            },
          };
        } }),
      });
      let databaseName;
      await runtime.runIsolatedDatabase(async context => {
        databaseName = context.databaseName;
        assert.equal((await context.getPoolFn().query('SELECT 42 AS answer')).rows[0].answer, 42);
        observer = new pg.Client({ ...context.databaseConfig, database: 'postgres',
          connectionTimeoutMillis: config.poolConnectionTimeoutMs });
        await observer.connect();
      });
      assert.equal((await observer.query('SELECT EXISTS (SELECT FROM pg_database WHERE datname=$1) AS present',
        [databaseName])).rows[0].present, false);
      closing = runtime.cleanup(); closing.then(() => { settled = true; }, () => { settled = true; });
      await waitForFixtureReady({ ready: entered.promise, operation: closing, signal: t.signal });
      assert.equal(runtime.cleanup(), closing); assert.equal(settled, false);
      assert.equal((await observer.query('SELECT 43 AS answer')).rows[0].answer, 43);
      hold.release(); await assert.rejects(closing, error => error === failure);
      assert.equal(runtime.cleanup(), closing); await assert.rejects(runtime.cleanup(), error => error === failure);
      assert.equal(stopCalls, 1);
      // A rejected adapter is not proof that the database stopped or its storage is safe to remove.
      assert.equal((await observer.query('SELECT 44 AS answer')).rows[0].answer, 44);
    }, async () => {
      hold.release();
      if (runtime) await runtime.cleanup().catch(() => {});
      await withWorkerTaskCleanup(() => observer?.end(), async () => {
        // Only this test reaps the exact server it created after the controlled pre-stop refusal.
        if (!owner) return;
        await owner.stop({ timeout: config.containerStopTimeoutMs });
        const { stdout } = await executeFile('docker', ['container', 'ls', '--all', '--no-trunc', '--quiet',
          '--filter', `id=${owner.getId()}`], { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
        assert.equal(stdout.trim(), '');
      });
    });
  })()));
}
