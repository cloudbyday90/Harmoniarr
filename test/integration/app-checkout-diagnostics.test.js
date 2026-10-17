/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { createServer as createTcpServer } from 'node:net';
import { createServer } from 'node:http';
import { after, before, suite, test } from 'node:test';
import pg from 'pg';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPoolCheckoutObserver, poolCheckoutMarker } from '../../testing/integration/app-checkout-observer.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { getPool } from '../../src/server/database.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
const capture = records => record => { records.push(record); process.stdout.write(`${poolCheckoutMarker}${JSON.stringify(record)}\n`); };

suite('app fixture first-checkout diagnostics', () => {
  before(async () => { runtime = await createPostgresIntegrationRuntime({ config, env: {} }); },
    { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('native saturation retains its uncoded driver failure and dispatched wait counter', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    await runtime.runIsolatedDatabase(async ({ databaseConfig, getPoolFn, source, phaseObserver }) => {
      const version = await getPoolFn().query('SHOW server_version');
      process.stdout.write(`[checkout-native] ${JSON.stringify({ serverVersion: version.rows[0].server_version.match(/^\d+(?:\.\d+)+/u)?.[0] ?? null })}\n`);
      const pool = new pg.Pool({ ...databaseConfig, max: 1, connectionTimeoutMillis: 100 });
      let held;
      try {
        held = await pool.connect();
        const records = []; let nativeError;
        const observer = createPoolCheckoutObserver({ onRecord: capture(records) });
        await assert.rejects(observer.observe(pool, { correlationId: phaseObserver.correlationId, source,
          serverPhase: 'isolated_database_admitted' }, () => {
          const pending = pool.connect(); void pending.catch(error => { nativeError = error; }); return pending;
        }), error => error === nativeError);
        assert.equal(records.length, 1);
        assert.equal(records[0].before.total, 1); assert.equal(records[0].before.idle, 0);
        assert.equal(records[0].requested.waiting, 1); assert.equal(records[0].settled.waiting, 0);
        assert.equal(records[0].errors[0].code, null);
        assert.equal(records[0].errors[0].errorClass, 'Error');
        assert.equal(JSON.stringify(records).includes(nativeError.message), false);
      } finally { held?.release(); await pool.end(); }
    });
  });

  test('native refusal retains ECONNREFUSED without serializing its endpoint', { timeout: config.scenarioTimeoutMs }, async () => {
    const server = createTcpServer(socket => socket.destroy());
    await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const { port } = server.address();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    const pool = new pg.Pool({ host: '127.0.0.1', port, user: 'fixture', password: 'private-password',
      database: 'private-database', connectionTimeoutMillis: 1000 });
    const records = []; let nativeError;
    try {
      await assert.rejects(createPoolCheckoutObserver({ onRecord: capture(records) }).observe(pool, {}, () => {
        const pending = pool.connect(); void pending.catch(error => { nativeError = error; }); return pending;
      }), error => error === nativeError && error.code === 'ECONNREFUSED');
      assert.equal(records[0].errors[0].code, 'ECONNREFUSED');
      assert.equal(records[0].before.total, 0); assert.equal(records[0].requested.total, 1);
      assert.equal(records[0].requested.waiting, 0); assert.equal(records[0].settled.total, 0);
      assert.equal(JSON.stringify(records).includes('127.0.0.1'), false);
      assert.equal(JSON.stringify(records).includes('private'), false);
      assert.equal(records[0].lastServerPhase, 'unknown');
    } finally { await pool.end(); }
  });

  test('both native app entry points correlate one checkout and keep schema, HTTP and pool APIs working', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => {
    const previousMode = process.env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS;
    process.env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS = 'all';
    t.after(() => {
      if (previousMode === undefined) delete process.env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS;
      else process.env.HARMONIARR_INTEGRATION_POOL_DIAGNOSTICS = previousMode;
    });
    const records = []; const phases = []; const ownedRecords = [];
    const phaseObserver = createFixturePhaseObserver({ onRecord: r => phases.push(r) });
    const checkoutObserver = createPoolCheckoutObserver({ mode: 'all', onRecord: capture(records) });
    const createAppFn = () => ({ app: createServer((request, response) => {
      request.resume();
      request.on('end', () => {
        getPool().query('SELECT 1::integer AS value', (error, result) => {
          response.statusCode = error ? 500 : 200;
          response.end(error ? 'failed' : String(result.rows[0].value));
        });
      });
    }) });
    const run = async ({ baseUrl, getPoolFn }) => {
      const response = await fetch(baseUrl, { method: 'POST', body: 'private-payload',
        headers: { traceparent: 'private-trace', cookie: 'private-cookie' } });
      assert.equal(response.status, 200); assert.equal(await response.text(), '1');
      const result = await getPoolFn().query('SELECT COUNT(*)::integer AS count FROM schema_migrations');
      assert.ok(result.rows[0].count > 0);
    };
    const app = await createIntegrationAppRuntime({ config, phaseObserver, checkoutObserver, createAppFn,
      checkoutRecord: record => ownedRecords.push(record),
      postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => runtime.runIsolatedDatabase(...args),
        cleanup: async () => {} }) });
    try { await app.runScenario(run); } finally { await app.cleanup(); }
    await withIntegrationApp({ config, phaseObserver, checkoutObserver, createAppFn, run,
      checkoutRecord: record => ownedRecords.push(record),
      withPostgresIntegrationRuntimeFn: ({ run: execute }) => runtime.runIsolatedDatabase(execute) });
    assert.deepEqual(records.map(r => r.outcome), ['started', 'passed', 'started', 'passed']);
    for (const record of records.filter(r => r.outcome === 'passed')) {
      assert.equal(record.before.total, 0); assert.equal(record.settled.total, 1);
      assert.equal(record.lastServerPhase, 'isolated_database_admitted');
      assert.ok(phases.some(p => p.correlationId === record.correlationId && p.phase === 'schema_prepare'));
    }
    const http = ownedRecords.filter(record => record.phase === 'http_request' && record.outcome === 'passed');
    assert.equal(http.length, 2); assert.equal(new Set(http.map(record => record.correlationId)).size, 2);
    assert.ok(http.every(record => record.poolKind === 'application_pool' && record.before.max === config.poolMax));
    assert.ok(ownedRecords.some(record => record.phase === 'scenario_work' && record.outcome === 'passed'));
    assert.equal(JSON.stringify(ownedRecords).includes('private'), false);
  });
});
