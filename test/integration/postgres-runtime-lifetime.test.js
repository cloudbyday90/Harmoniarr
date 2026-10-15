/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { afterEach, test } from 'node:test';
import { setImmediate as turn } from 'node:timers/promises';
import { promisify } from 'node:util';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { withTemporaryPostgresDatabase } from '../../testing/postgres-temporary-database.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createPostgresFailureEvidence } from '../../testing/integration/postgres-failure-evidence.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig(); const executeFile = promisify(execFile); const active = new Set();
function registered(operation) {
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}
afterEach(async () => { await Promise.allSettled([...active]); }, { timeout: config.suiteTeardownTimeoutMs });

for (const schemaMode of ['empty', 'migration_template']) {
  test(`${schemaMode} native cleanup drains failed work and successful admin-close tail before stopping its server`, {
    timeout: config.suiteSetupTimeoutMs + config.scenarioTimeoutMs + config.suiteTeardownTimeoutMs,
  }, t => registered((async () => {
    const primary = schemaMode === 'empty' ? new Error('controlled-scenario') : null;
    const bodyEntered = createFixtureGate({ signal: t.signal }); const bodyHold = createFixtureGate({ signal: t.signal });
    const tailEntered = createFixtureGate({ signal: t.signal }); const tailHold = createFixtureGate({ signal: t.signal });
    const baseObserver = createFixturePhaseObserver({ enabled: false });
    const tailObserver = createFixturePhaseObserver({ enabled: false });
    let stops = 0; let operations = 0; let runtime; let connectionConfig; let containerId;
    let observer; let observerClosed = false; let observerFailure; let first; let second; let closing; let closed = false;
    const targets = [];
    const absent = async name => (await observer.query('SELECT EXISTS (SELECT FROM pg_database WHERE datname=$1) AS present', [name])).rows[0].present === false;
    await withWorkerTaskCleanup(async () => {
      assert.equal(config.useContainerReuse, false);
      runtime = await createPostgresIntegrationRuntime({ config, env: { HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS: 'off' },
        phaseObserver: { ...baseObserver, measure: (phase, run) => {
          if (phase === 'container_stop') stops++; return baseObserver.measure(phase, run);
        } },
        failureEvidenceFactory: options => {
          assert.equal(options.fresh, true); connectionConfig = options.connectionConfig; containerId = options.containerId;
          return createPostgresFailureEvidence(options);
        },
        withTemporaryPostgresDatabaseFn: options => {
          operations++; const holdClose = options.phaseObserver === tailObserver;
          return withTemporaryPostgresDatabase({ ...options, adminClientFactory: input => {
            const client = new pg.Client({ ...input, connectionTimeoutMillis: config.poolConnectionTimeoutMs });
            return { connect: () => client.connect(), query: (...args) => client.query(...args), end: async () => {
              await client.end();
              if (holdClose) { tailEntered.release(); await tailHold.promise; }
            } };
          } });
        },
      });
      observer = new pg.Client({ ...connectionConfig, connectionTimeoutMillis: config.poolConnectionTimeoutMs });
      observer.on('error', error => { observerFailure = error; }); await observer.connect();
      assert.equal(Math.floor(Number((await observer.query('SHOW server_version_num')).rows[0].server_version_num) / 10_000), 18);
      first = runtime.runIsolatedDatabase(async ({ databaseName, getPoolFn }) => {
        targets.push(databaseName); const pool = getPoolFn();
        assert.equal(pool.options.max, config.poolMax); assert.equal(pool.options.connectionTimeoutMillis, config.poolConnectionTimeoutMs);
        assert.equal((await pool.query('SELECT 42 AS answer')).rows[0].answer, 42);
        bodyEntered.release(); await bodyHold.promise;
        assert.equal((await pool.query('SELECT 43 AS answer')).rows[0].answer, 43); throw primary;
      }, { signal: t.signal }); first.catch(() => {});
      second = runtime.runIsolatedDatabase(async ({ databaseName, getPoolFn }) => {
        targets.push(databaseName); assert.equal((await getPoolFn().query('SELECT 17 AS answer')).rows[0].answer, 17);
        return 'complete';
      }, { signal: t.signal, phaseObserver: tailObserver }); second.catch(() => {});
      const pending = Promise.all([first, second]); pending.catch(() => {});
      await waitForFixtureReady({ ready: Promise.all([bodyEntered.promise, tailEntered.promise]), operation: pending, signal: t.signal });
      closing = runtime.cleanup(); closing.then(() => { closed = true; }, () => { closed = true; });
      assert.equal(runtime.cleanup(), closing);
      await assert.rejects(runtime.runIsolatedDatabase(() => assert.fail('Late native work admitted')), { code: 'fixture_runtime_closed' });
      assert.equal(operations, 2); assert.equal(stops, 0); assert.equal(closed, false);
      assert.equal((await observer.query('SELECT 44 AS answer')).rows[0].answer, 44);
      bodyHold.release(); await assert.rejects(first, error => error === primary); await turn();
      assert.equal(stops, 0); assert.equal(closed, false);
      assert.equal(targets.length, 2); assert.notEqual(targets[0], targets[1]);
      for (const target of targets) assert.equal(await absent(target), true);
      assert.equal(observerFailure, undefined); await observer.end(); observerClosed = true;
      tailHold.release(); assert.equal(await second, 'complete'); await closing;
      assert.equal(stops, 1); assert.equal(runtime.cleanup(), closing);
      await assert.rejects(runtime.runIsolatedDatabase(() => assert.fail()), { code: 'fixture_runtime_closed' });
      const { stdout } = await executeFile('docker', ['container', 'ls', '--all', '--no-trunc', '--quiet', '--filter', `id=${containerId}`],
        { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
      assert.equal(stdout.trim(), '');
    }, async () => {
      bodyHold.release();
      await withWorkerTaskCleanup(async () => { if (observer && !observerClosed) await observer.end(); }, async () => {
        tailHold.release(); await Promise.allSettled([first, second].filter(Boolean)); await runtime?.cleanup();
      });
    });
  })()));
}
