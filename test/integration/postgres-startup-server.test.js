/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createServer as createTcpServer, createConnection } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import pg from 'pg';
import { after, before, suite, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresFailureEvidence } from '../../testing/integration/postgres-failure-evidence.js';
import { observeFixturePoolCheckouts } from '../../testing/integration/fixture-pool-checkout.js';
import { withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime; let evidence; let options; const active = new Set();
let serverRecords; let checkoutRecords; let inspectedPool;
const reset = () => { serverRecords = []; checkoutRecords = []; inspectedPool = null; };
const recordCheckout = value => checkoutRecords.push(value);
async function scenario(t, run) {
  const operation = runtime.runIsolatedDatabase(input => withFixtureLifecycle({ signal: t.signal }, scope => run(input, scope)), { signal: t.signal });
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); await operation;
}
function assertAssociated() {
  assert.equal(serverRecords.length, 1); assert.equal(serverRecords[0].version, 4);
  const record = serverRecords[0].serverStartup; const checkout = checkoutRecords.find(r => r.outcome === 'failed');
  assert.equal(record.outcome, 'associated'); assert.equal(record.lastStage, 'ready');
  assert.equal(record.clientId, checkout.connection.clientId); assert.equal(serverRecords[0].checkoutId, checkout.checkoutId);
  assert.equal(record.receiptObserved, true); assert.equal(record.authenticationObserved, true);
  assert.equal(record.authorizationObserved, true); assert.equal(record.readyObserved, true);
  assert.ok(record.setupTotalMs >= 0); assert.ok(record.forkMs >= 0); assert.ok(record.authenticationMs >= 0);
  assert.equal(checkout.connection.targetMatch, 'matched'); assert.equal(checkout.connection.lastStage, 'backend_ready');
  assert.equal(/hxi_|harmoniarr_schema|private|pg_hba|172\./u.test(JSON.stringify(serverRecords)), false);
}

suite('Owned PostgreSQL server startup capture', () => {
  before(async () => {
    reset(); runtime = await createPostgresIntegrationRuntime({ config, env: {}, checkoutRecord: recordCheckout,
      failureEvidenceFactory: input => {
        options = input; evidence = createPostgresFailureEvidence({ ...input, onRecord: value => {
          if (inspectedPool) assert.equal(inspectedPool.ending, false); serverRecords.push(value);
        } }); return evidence;
      } });
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await Promise.allSettled([...active]); await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('actual default configuration and authorized server-ready failure correlate before cleanup', { timeout: config.scenarioTimeoutMs }, async t => {
    reset(); await scenario(t, async input => {
      assert.equal(input.startupLogging, true); assert.equal(options.startupLogging, true);
      const primary = new Error('Controlled private post-ready refusal'); let observedClient;
      const pool = new pg.Pool({ ...input.databaseConfig, max: 2, connectionTimeoutMillis: 10_000,
        verify: (client, done) => { observedClient = client; done(primary); } }); inspectedPool = pool;
      const descriptor = Object.getOwnPropertyDescriptor(pool, 'Client');
      const observer = observeFixturePoolCheckouts({ pool, expectedConfig: input.databaseConfig, startupLogging: input.startupLogging,
        source: input.source, poolKind: 'scenario_pool', phaseObserver: input.phaseObserver,
        captureFailure: input.captureCheckoutFailure, onRecord: recordCheckout });
      try { await assert.rejects(pool.connect(), error => error === primary); assertAssociated(); }
      finally { await observer.restore(); await pool.end(); }
      assert.deepEqual(Object.getOwnPropertyDescriptor(pool, 'Client'), descriptor);
      assert.equal(Object.hasOwn(observedClient.connection, 'startup'), false);
      const client = new pg.Client(input.databaseConfig);
      try {
        await client.connect();
        const actual = (await client.query(`SELECT current_setting('server_version_num')::integer AS version,
          current_setting('log_destination') AS destination,current_setting('log_connections') AS connections,
          current_setting('logging_collector') AS collector,current_setting('lc_messages') AS language`)).rows[0];
        assert.equal(Math.trunc(actual.version / 10_000), 18); assert.equal(actual.destination, 'stderr,jsonlog');
        assert.equal(actual.collector, 'on'); assert.equal(actual.language, 'C'); assert.ok(actual.connections.includes('setup_durations'));
        t.diagnostic(`PostgreSQL ${actual.version}`);
      } finally { await client.end(); }
    });
  });

  test('both actual app entrypoints forward the original unnamed cold-client context', { timeout: config.scenarioTimeoutMs }, async t => {
    for (const entrypoint of ['reusable', 'functional']) {
      reset(); const primary = new Error('Controlled private application post-ready refusal'); let application;
      const appOptions = { config, checkoutRecord: recordCheckout,
        createAppFn: () => ({ app: createHttpServer((_request, response) => response.end('ready')) }) };
      const run = async ({ getPoolFn }) => {
        const pool = getPoolFn(); inspectedPool = pool;
        // Evict both schema clients so this proof observes a new original client, not a reused checkout.
        const first = await pool.connect(); const second = await pool.connect(); first.release(true); second.release(true);
        pool.options.verify = (_client, done) => done(primary);
        await assert.rejects(pool.connect(), error => error === primary); assertAssociated();
        assert.equal(checkoutRecords.find(r => r.outcome === 'failed').poolKind, 'application_pool');
      };
      if (entrypoint === 'reusable') application = await createIntegrationAppRuntime({ ...appOptions,
        postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => runtime.runIsolatedDatabase(...args), cleanup: async () => {} }) });
      const pending = entrypoint === 'reusable' ? application.runScenario(run)
        : withIntegrationApp({ ...appOptions, run, withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver }) =>
          runtime.runIsolatedDatabase(execute, { phaseObserver, signal: t.signal }) });
      active.add(pending); pending.then(() => active.delete(pending), () => active.delete(pending));
      try { await pending; assert.equal(inspectedPool.ended, true); assert.equal(Object.hasOwn(inspectedPool, 'connect'), false); }
      finally { await pending.catch(() => {}); await application?.cleanup(); }
    }
  });

  test('held startup traffic yields a real timeout and an unassociated server window without guessed NAT identity', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    reset(); await scenario(t, async (input, scope) => {
      const sockets = new Set(); let sawStartup = false;
      const proxy = createTcpServer(front => {
        sockets.add(front); front.on('close', () => sockets.delete(front));
        const backend = createConnection({ host: input.databaseConfig.host, port: input.databaseConfig.port });
        sockets.add(backend); backend.on('close', () => sockets.delete(backend));
        front.on('data', () => { sawStartup = true; }); // Read but never forward the private startup packet.
        front.on('error', () => backend.destroy()); backend.on('error', () => front.destroy());
        front.on('close', () => backend.destroy());
      });
      await new Promise(resolve => { proxy.listen(0, '127.0.0.1', resolve); });
      const acknowledgedProxy = { ...input.databaseConfig, host: '127.0.0.1', port: proxy.address().port };
      const pool = new pg.Pool({ ...acknowledgedProxy, max: 2, connectionTimeoutMillis: 10_000 }); inspectedPool = pool;
      const observer = observeFixturePoolCheckouts({ pool, expectedConfig: acknowledgedProxy, startupLogging: input.startupLogging,
        source: input.source, poolKind: 'scenario_pool', phaseObserver: input.phaseObserver,
        captureFailure: input.captureCheckoutFailure, onRecord: recordCheckout });
      try {
        scope.signal.throwIfAborted(); await assert.rejects(pool.connect(), error => /connection timeout/u.test(error.message));
        assert.equal(sawStartup, true); assert.equal(serverRecords[0].version, 4);
        const record = serverRecords[0].serverStartup;
        assert.equal(record.outcome, 'unassociated'); assert.equal(record.clientId, null); assert.equal(record.lastStage, 'unknown');
        assert.equal(record.receiptObserved, false); assert.equal(record.authorizationObserved, false); assert.equal(record.readyObserved, false);
        assert.ok(record.receiptRowsInWindow >= 1);
        const failed = checkoutRecords.find(r => r.outcome === 'failed');
        assert.equal(failed.connection.targetMatch, 'matched'); assert.equal(failed.connection.lastStage, 'startup_dispatched');
        assert.equal(failed.before.total, 0); assert.equal(failed.requested.waiting, 0); assert.equal(failed.settled.total, 0);
      } finally {
        await observer.restore(); await pool.end(); for (const socket of sockets) socket.destroy();
        await new Promise((resolve, reject) => { proxy.close(error => error ? reject(error) : resolve()); });
      }
    });
  });

  test('explicit application names retain native startup behavior and launch no success probe', { timeout: config.scenarioTimeoutMs }, async t => {
    reset(); await scenario(t, async input => {
      const pool = new pg.Pool({ ...input.databaseConfig, application_name: 'explicit-fixture-name', max: 2, connectionTimeoutMillis: 10_000 });
      const observer = observeFixturePoolCheckouts({ pool, expectedConfig: input.databaseConfig, startupLogging: input.startupLogging,
        source: input.source, poolKind: 'scenario_pool', phaseObserver: input.phaseObserver, captureFailure: input.captureCheckoutFailure });
      try { assert.equal((await pool.query("SELECT current_setting('application_name') AS name")).rows[0].name, 'explicit-fixture-name');
        assert.equal(serverRecords.length, 0); }
      finally { await observer.restore(); await pool.end(); }
    });
  });
});
