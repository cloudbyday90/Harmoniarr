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
import { createPostgresIntegrationRuntime, withPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const executeFile = promisify(execFile); const active = new Set();
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

for (const schemaMode of ['empty', 'migration_template']) {
  test(`${schemaMode} startup awaits real owned shutdown after metadata failure and retains its original outcome`, {
    timeout: config.suiteSetupTimeoutMs + config.suiteTeardownTimeoutMs,
  }, t => registered((async () => {
    const primary = schemaMode === 'empty' ? new Error('controlled-metadata') : null;
    const entered = createFixtureGate({ signal: t.signal }); const hold = createFixtureGate({ signal: t.signal });
    let owner; let pending; let observer; let observerClosed = false; let settled = false;
    let stops = 0; let retired = false; let prepared = false; let ran = false;
    await withWorkerTaskCleanup(async () => {
      assert.equal(config.useContainerReuse, false);
      const options = { config, schemaMode, env: { HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS: 'off' },
        createPostgresContainer: () => ({ start: async () => {
          owner = await new PostgreSqlContainer(config.postgresImage).withStartupTimeout(config.startupTimeoutMs)
            .withDatabase('harmoniarr').withUsername('harmoniarr').withPassword('harmoniarr').start();
          return {
            getDatabase: () => owner.getDatabase(), getPassword: () => owner.getPassword(), getUsername: () => owner.getUsername(),
            getHost: () => { if (schemaMode === 'empty') throw primary; return owner.getHost(); },
            getPort: () => ({ [Symbol.toPrimitive]() { throw primary; } }), getId: () => owner.getId(),
            stop: async stopOptions => {
              stops++; assert.equal(stopOptions.timeout, config.containerStopTimeoutMs);
              entered.release(); await hold.promise; await owner.stop(stopOptions); retired = true;
              // A later adapter failure cannot replace the metadata error, even after verified physical stop.
              throw new Error('secondary-post-stop');
            },
          };
        } }),
        createPreparedPostgresTemplateFn: () => { prepared = true; assert.fail('Failed metadata prepared a template'); },
        run: () => { ran = true; assert.fail('Failed startup invoked a scenario'); },
      };
      pending = schemaMode === 'empty' ? withPostgresIntegrationRuntime(options) : createPostgresIntegrationRuntime(options);
      pending.then(() => { settled = true; }, () => { settled = true; });
      await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
      assert.equal(settled, false); assert.equal(stops, 1); assert.equal(retired, false);
      observer = new pg.Client({ database: 'postgres', host: owner.getHost(), port: owner.getPort(), user: owner.getUsername(),
        password: owner.getPassword(), connectionTimeoutMillis: config.poolConnectionTimeoutMs });
      await observer.connect();
      assert.equal(Math.floor(Number((await observer.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000), 18);
      assert.equal((await observer.query('SELECT 42 AS answer')).rows[0].answer, 42);
      await observer.end(); observerClosed = true;
      hold.release(); await assert.rejects(pending, error => error === primary);
      assert.equal(stops, 1); assert.equal(retired, true); assert.equal(prepared, false); assert.equal(ran, false);
      const { stdout } = await executeFile('docker', ['container', 'ls', '--all', '--no-trunc', '--quiet', '--filter', `id=${owner.getId()}`],
        { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
      assert.equal(stdout.trim(), '');
    }, async () => {
      await withWorkerTaskCleanup(async () => { if (observer && !observerClosed) await observer.end(); }, async () => {
        hold.release(); await pending?.catch(() => {});
        // The test alone may reap an acknowledged server if a regression never attempted the guarded stop.
        if (owner && stops === 0) await owner.stop({ timeout: config.containerStopTimeoutMs });
      });
    });
  })()));
}
