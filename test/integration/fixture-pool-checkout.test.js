/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import pg from 'pg';
import { createServer } from 'node:net';
import { createServer as createHttpServer } from 'node:http';
import { after, before, suite, test } from 'node:test';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { createLibraryDiscoveryRequestStore } from '../../src/server/library/library-discovery-request-store.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresFailureEvidence } from '../../testing/integration/postgres-failure-evidence.js';
import { createPostgresHostProbe } from '../../testing/integration/postgres-host-probe.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { observeFixturePoolCheckouts } from '../../testing/integration/fixture-pool-checkout.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime; let checkouts; let servers; let primary; let poolUnderTest; let held; let entered;
const publishCheckout = record => { checkouts.push(record); };

function assertEvidence(kind, phase) {
  assert.equal(servers.length, 1); assert.equal(servers[0].version, 3); assert.equal(servers[0].phase, 'pool_checkout');
  const failed = checkouts.filter(r => r.outcome === 'failed'); assert.equal(failed.length, 1);
  assert.equal(failed[0].poolKind, kind); assert.equal(failed[0].phase, phase);
  assert.equal(servers[0].checkoutId, failed[0].checkoutId);
  assert.equal(servers[0].correlationId, failed[0].correlationId);
  assert.equal(servers[0].host.outcome, 'passed'); assert.equal(servers[0].host.closed, true);
  assert.equal(servers[0].readiness.outcome, 'accepting', JSON.stringify(servers[0].readiness));
  assert.equal(servers[0].containerState.running, true);
  assert.equal(JSON.stringify([...servers, ...checkouts]).includes('private'), false);
  return failed[0];
}
function reset() { checkouts = []; servers = []; primary = undefined; poolUnderTest = null; held = null; entered = null; }

suite('Owned fixture checkout capture across direct migration and later discovery claims', () => {
  before(async () => {
    reset(); runtime = await createPostgresIntegrationRuntime({ config, env: {}, checkoutRecord: publishCheckout,
      failureEvidenceFactory: options => {
        const evidence = createPostgresFailureEvidence({ ...options,
          onRecord: record => { assert.equal(poolUnderTest.ending, false); servers.push(record); },
          hostProbeFactory: input => async () => {
            const result = await createPostgresHostProbe(input)(); entered?.release(); if (held) await held.promise;
            return result;
          } });
        return { createCapture: context => {
          const capture = evidence.createCapture(context);
          return (error, phase, checkoutId) => { if (phase === 'pool_checkout') primary ??= error;
            return capture(error, phase, checkoutId); };
        } };
      } });
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('a direct migration cold connection timeout is captured before owning pool cleanup', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    reset(); const sockets = new Set(); const listener = createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      // Accept transport but never complete the PostgreSQL handshake.
    });
    await new Promise(resolve => { listener.listen(0, '127.0.0.1', resolve); });
    try {
      await runtime.runIsolatedDatabase(async ({ getPoolFn, phaseObserver }) => {
        const pool = getPoolFn(); poolUnderTest = pool;
        assert.equal(pool.options.max, 2); assert.equal(pool.options.connectionTimeoutMillis, 10_000);
        pool.options.host = '127.0.0.1'; pool.options.port = listener.address().port;
        await assert.rejects(phaseObserver.measure('schema_prepare', () => applyPendingMigrations({ getPoolFn })),
          error => error === primary && /connection timeout/u.test(error.message));
        assert.equal(pool.ending, false);
        const failed = assertEvidence('scenario_pool', 'schema_prepare');
        assert.equal(failed.before.total, 0); assert.equal(failed.requested.total, 1);
        assert.equal(failed.requested.waiting, 0); assert.equal(failed.settled.total, 0);
        assert.equal(failed.errors[0].code, null); assert.equal(failed.errors[0].errorClass, 'Error');
        assert.equal(failed.version, 3); assert.equal(failed.connection.observation, 'observed');
        assert.equal(failed.connection.targetMatch, 'mismatched');
        assert.equal(failed.connection.lastStage, 'startup_dispatched');
        assert.ok(failed.connection.transportConnectedMs >= failed.connection.constructedMs);
        assert.ok(failed.connection.startupDispatchedMs >= failed.connection.transportConnectedMs);
        assert.equal(failed.connection.backendReadyMs, null);
      });
      assert.equal(poolUnderTest.ended, true); assert.equal(Object.hasOwn(poolUnderTest, 'connect'), false);
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve, reject) => { listener.close(error => error ? reject(error) : resolve()); });
    }
  });

  for (const entrypoint of ['reusable', 'functional']) {
    test(`${entrypoint} app captures the actual queued discovery-claim checkout before forwarding failure`, {
      timeout: config.scenarioTimeoutMs,
    }, async t => {
      reset(); held = createFixtureGate({ signal: t.signal }); entered = createFixtureGate({ signal: t.signal });
      const phaseObserver = createFixturePhaseObserver({ enabled: false }); let application; let caught = false;
      const options = { config, phaseObserver, checkoutRecord: publishCheckout,
        createAppFn: () => ({ app: createHttpServer((_request, response) => response.end('ready')) }) };
      const run = async ({ getPoolFn }) => {
        const pool = getPoolFn(); poolUnderTest = pool; let first; let second;
        assert.equal(pool.options.max, 2); assert.equal(pool.options.connectionTimeoutMillis, 10_000);
        const store = createLibraryDiscoveryRequestStore({ getPoolFn });
        try {
          first = await pool.connect(); second = await pool.connect();
          await assert.rejects(store.claimNextReadyAutomaticDiscoveryRequest({ dispatchedAt: new Date().toISOString(),
            nextSearchAfter: new Date().toISOString() }), error => { caught = true; return error === primary; });
        } finally { first?.release(); second?.release(); }
        assert.equal(await store.claimNextReadyAutomaticDiscoveryRequest({ dispatchedAt: new Date().toISOString(),
          nextSearchAfter: new Date().toISOString() }), null);
        const result = await new Promise((resolve, reject) => { pool.query('SELECT 1 AS value', (error, value) => error ? reject(error) : resolve(value)); });
        assert.equal(result.rows[0].value, 1);
      };
      if (entrypoint === 'reusable') application = await createIntegrationAppRuntime({ ...options,
        postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => runtime.runIsolatedDatabase(...args), cleanup: async () => {} }) });
      const pending = entrypoint === 'reusable' ? application.runScenario(run)
        : withIntegrationApp({ ...options, run,
          withPostgresIntegrationRuntimeFn: ({ run: execute, phaseObserver: observer }) => runtime.runIsolatedDatabase(execute, { phaseObserver: observer }) });
      void pending.catch(() => {});
      try {
        await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
        assert.equal(caught, false); assert.equal(poolUnderTest.ending, false); assert.equal(servers.length, 0);
        const failed = checkouts.find(r => r.outcome === 'failed');
        assert.equal(failed.before.total, 2); assert.equal(failed.before.idle, 0);
        assert.equal(failed.requested.waiting, 1); assert.equal(failed.settled.waiting, 0);
        assert.equal(failed.connection.observation, 'not_observed');
        assert.equal(failed.acquisition.lastStage, 'queued');
        assert.ok(failed.acquisition.queuedMs >= 0);
        assert.equal(failed.acquisition.newClientMs, null);
        assert.equal(failed.acquisition.acquireEnteredMs, null);
        held.release(); await pending; assert.equal(caught, true);
        assertEvidence('application_pool', 'scenario_work');
        assert.equal(poolUnderTest.ended, true); assert.equal(Object.hasOwn(poolUnderTest, 'connect'), false);
      } finally { held.release(); await pending.catch(() => {}); await application?.cleanup(); held = null; entered = null; }
    });
  }

  test('queued native promise, callback and query callers retain their own cold creation and reuse', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    reset(); await runtime.runIsolatedDatabase(async ({ databaseConfig, phaseObserver }) => {
      const pool = new pg.Pool({ ...databaseConfig, max: 2, connectionTimeoutMillis: 10_000 });
      const records = []; const descriptors = ['Client', 'connect', 'newClient', '_acquireClient']
        .map(key => [key, Object.getOwnPropertyDescriptor(pool, key)]);
      const diagnostics = observeFixturePoolCheckouts({ pool, expectedConfig: databaseConfig,
        poolKind: 'scenario_pool', source: 'testcontainer_postgres', phaseObserver, mode: 'all', onRecord: r => records.push(r) });
      let first; let second; const admitted = [];
      await withWorkerTaskCleanup(async () => {
        first = await pool.connect(); second = await pool.connect(); records.length = 0;
        const promise = phaseObserver.measure('fixture_seed', async () => {
          const client = await pool.connect();
          try { return await client.query('SELECT 1 AS value'); } finally { client.release(true); }
        });
        admitted.push(promise); void promise.catch(() => {});
        const callback = phaseObserver.measure('scenario_work', () => new Promise((resolve, reject) => {
          pool.connect((error, client, release) => {
            if (error) { reject(error); return; }
            client.query('SELECT 2 AS value').then(result => { release(); resolve(result); }, failure => { release(failure); reject(failure); });
          });
        }));
        admitted.push(callback); void callback.catch(() => {});
        const query = phaseObserver.measure('http_scenario', () => new Promise((resolve, reject) => {
          pool.query('SELECT 3 AS value', (error, result) => error ? reject(error) : resolve(result));
        }));
        admitted.push(query); void query.catch(() => {});
        // Observe all eventual failures before releasing either holder.
        const completion = Promise.all([promise, callback, query]); void completion.catch(() => {});
        assert.equal(pool.waitingCount, 3); assert.equal(pool.options.max, 2);
        assert.equal(pool.options.connectionTimeoutMillis, 10_000);
        first.release(true); first = null;
        const [promiseResult, callbackResult, queryResult] = await completion;
        assert.equal(promiseResult.rows[0].value, 1);
        assert.equal(callbackResult.rows[0].value, 2); assert.equal(queryResult.rows[0].value, 3);
        const passed = records.filter(record => record.outcome === 'passed');
        assert.deepEqual(passed.map(record => record.phase), ['fixture_seed', 'scenario_work', 'http_scenario']);
        for (const record of passed) {
          assert.equal(record.acquisition.lastStage, 'delivered');
          assert.ok(record.acquisition.acquireEnteredMs >= record.acquisition.queuedMs);
          assert.ok(record.acquisition.deliveredMs >= record.acquisition.acquireEnteredMs);
        }
        for (const record of passed.slice(0, 2)) {
          assert.equal(record.acquisition.clientKind, 'new');
          assert.ok(record.acquisition.newClientMs >= record.acquisition.queuedMs);
          assert.equal(record.connection.observation, 'observed');
          assert.equal(record.connection.targetMatch, 'matched'); assert.equal(record.connection.lastStage, 'backend_ready');
        }
        assert.notEqual(passed[0].connection.clientId, passed[1].connection.clientId);
        assert.equal(passed[2].acquisition.clientKind, 'reused');
        assert.equal(passed[2].acquisition.newClientMs, null);
        assert.equal(passed[2].connection.observation, 'not_observed');
        assert.equal(passed[2].connection.backendReadyMs, null);
        assert.equal(JSON.stringify(records).includes(databaseConfig.database), false);
      }, async () => {
        first?.release(); second?.release();
        await Promise.allSettled(admitted);
        await withWorkerTaskCleanup(() => diagnostics.restore(), () => pool.end());
      });
      for (const [key, descriptor] of descriptors) assert.deepEqual(Object.getOwnPropertyDescriptor(pool, key), descriptor);
    });
  });

  test('successful native callback and promise acquisitions emit no default failure probes', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    reset(); await runtime.runIsolatedDatabase(async ({ getPoolFn, phaseObserver }) => phaseObserver.measure('scenario_work', async () => {
      const pool = getPoolFn(); poolUnderTest = pool; let client; let release;
      const value = await new Promise((resolve, reject) => {
        assert.equal(pool.connect((error, acquired, done) => {
          if (error) { reject(error); return; } client = acquired; release = done;
          acquired.query('SELECT 2 AS value').then(resolve, reject);
        }), undefined);
      });
      try { assert.equal(value.rows[0].value, 2); assert.equal(typeof release, 'function'); }
      finally { release?.(); }
      const next = await pool.connect(); try { assert.equal(next, client); } finally { next.release(); }
    }));
    assert.deepEqual(checkouts, []); assert.deepEqual(servers, []);
  });

  test('a queued cold failure observes its own startup when another connecting client fails', {
    timeout: config.scenarioTimeoutMs,
  }, async t => {
    const sockets = []; const gates = Array.from({ length: 3 }, () => createFixtureGate({ signal: t.signal }));
    const listener = createServer(socket => {
      const index = sockets.push(socket) - 1;
      socket.on('error', () => {}); socket.once('data', () => gates[index]?.release());
    });
    await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
    const target = { host: '127.0.0.1', port: listener.address().port, user: 'private-user', database: 'private-database' };
    const pool = new pg.Pool({ ...target, max: 2, connectionTimeoutMillis: 10_000 });
    const records = []; const phaseObserver = createFixturePhaseObserver({ enabled: false });
    const diagnostics = observeFixturePoolCheckouts({ pool, expectedConfig: target, phaseObserver,
      poolKind: 'scenario_pool', source: 'testcontainer_postgres', mode: 'all', onRecord: record => records.push(record) });
    const admitted = [];
    await withWorkerTaskCleanup(async () => {
      for (const phase of ['fixture_seed', 'http_scenario', 'scenario_work']) {
        const pending = phaseObserver.measure(phase, () => pool.connect());
        admitted.push(pending); void pending.catch(() => {});
      }
      const completion = Promise.allSettled(admitted);
      assert.equal(pool.waitingCount, 1);
      await waitForFixtureReady({ ready: Promise.all(gates.slice(0, 2).map(gate => gate.promise)), operation: completion, signal: t.signal });
      sockets[0].destroy();
      await waitForFixtureReady({ ready: gates[2].promise, operation: completion, signal: t.signal });
      sockets[2].destroy(); sockets[1].destroy();
      assert.deepEqual((await completion).map(result => result.status), ['rejected', 'rejected', 'rejected']);
      const failures = records.filter(record => record.outcome === 'failed'); assert.equal(failures.length, 3);
      const queued = failures.find(record => record.phase === 'scenario_work');
      assert.equal(queued.acquisition.lastStage, 'creating_client');
      assert.ok(queued.acquisition.newClientMs >= queued.acquisition.queuedMs);
      assert.equal(queued.acquisition.acquireEnteredMs, null); assert.equal(queued.acquisition.deliveredMs, null);
      assert.equal(queued.connection.observation, 'observed'); assert.equal(queued.connection.targetMatch, 'matched');
      assert.equal(queued.connection.lastStage, 'startup_dispatched');
      assert.equal(queued.connection.authenticationRequestedMs, null); assert.equal(queued.connection.backendReadyMs, null);
      assert.equal(new Set(failures.map(record => record.connection.clientId)).size, 3);
      assert.equal(JSON.stringify(records).includes('private'), false);
    }, async () => {
      for (const gate of gates) gate.release();
      for (const socket of sockets) socket.destroy();
      await Promise.allSettled(admitted);
      await withWorkerTaskCleanup(() => diagnostics.restore(), async () => {
        await withWorkerTaskCleanup(() => pool.end(), () => new Promise((resolve, reject) => {
          listener.close(error => error ? reject(error) : resolve());
        }));
      });
    });
  });

  test('actual cold clients reach authentication/readiness with matched fixture identity on promise and query callback paths', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    reset(); await runtime.runIsolatedDatabase(async ({ databaseConfig, phaseObserver }) => {
      const pool = new pg.Pool({ ...databaseConfig, max: 2, connectionTimeoutMillis: 10_000 });
      const records = []; const descriptor = Object.getOwnPropertyDescriptor(pool, 'Client');
      const diagnostics = observeFixturePoolCheckouts({ pool, expectedConfig: databaseConfig,
        poolKind: 'scenario_pool', source: 'testcontainer_postgres', phaseObserver, mode: 'all', onRecord: r => records.push(r) });
      try {
        const first = await pool.connect();
        try { assert.equal((await first.query('SELECT 1 AS value')).rows[0].value, 1); }
        finally { first.release(true); }
        const value = await new Promise((resolve, reject) => {
          pool.query('SELECT 2 AS value', (error, result) => error ? reject(error) : resolve(result));
        });
        assert.equal(value.rows[0].value, 2);
        const completed = records.filter(r => r.outcome === 'passed'); assert.equal(completed.length, 2);
        for (const { connection } of completed) {
          assert.equal(connection.observation, 'observed'); assert.equal(connection.targetMatch, 'matched');
          assert.equal(connection.lastStage, 'backend_ready');
          assert.ok(connection.authenticationRequestedMs >= connection.transportConnectedMs);
          assert.ok(connection.backendReadyMs >= connection.authenticationAcceptedMs);
        }
        assert.notEqual(completed[0].connection.clientId, completed[1].connection.clientId);
        assert.equal(JSON.stringify(records).includes(databaseConfig.database), false);
      } finally { await diagnostics.restore(); await pool.end(); }
      assert.deepEqual(Object.getOwnPropertyDescriptor(pool, 'Client'), descriptor);
    });
  });
});
