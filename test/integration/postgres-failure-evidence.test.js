/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import pg from 'pg';
import { after, before, suite, test } from 'node:test';
import { getPool } from '../../src/server/database.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresFailureEvidence } from '../../testing/integration/postgres-failure-evidence.js';
import { createPostgresHostProbe } from '../../testing/integration/postgres-host-probe.js';
import { createPoolCheckoutObserver } from '../../testing/integration/app-checkout-observer.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let evidenceOptions;
let hold;
let ready;
let records;
let diagnosticPool;
let failProbeAuthentication = false;

suite('Owned PostgreSQL failure evidence before fixture teardown', () => {
  before(async () => {
    runtime = await createPostgresIntegrationRuntime({ config, env: {},
      failureEvidenceFactory: options => {
        evidenceOptions = options;
        return createPostgresFailureEvidence({ ...options,
          onRecord: record => { if (diagnosticPool) assert.equal(diagnosticPool.ending, false); records.push(record);
            process.stdout.write(`[controlled-failure-evidence] ${JSON.stringify(record)}\n`); },
          hostProbeFactory: input => async () => {
            const result = await createPostgresHostProbe(failProbeAuthentication
              ? { ...input, connectionConfig: { ...input.connectionConfig, password: 'intentionally-invalid-probe-password' } }
              : input)();
            ready?.release(); if (hold) await hold.promise;
            return result;
          } });
      } });
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  for (const failure of ['connection_refusal', 'authentication_refusal', 'backend_termination']) {
    test(`real ${failure} remains distinct from independent host authentication and container readiness`, {
      timeout: config.scenarioTimeoutMs,
    }, async () => {
      records = []; diagnosticPool = null; let primary;
      const pending = runtime.runIsolatedDatabase(async ({ databaseConfig, getPoolFn }) => {
        diagnosticPool = getPoolFn();
        let client;
        let admin;
        let closedPort;
        if (failure === 'connection_refusal') {
          const server = createServer();
          await new Promise(resolve => { server.listen(0, '127.0.0.1', resolve); });
          closedPort = server.address().port;
          await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
        }
        try {
          client = new pg.Client({ ...databaseConfig, connectionTimeoutMillis: config.poolConnectionTimeoutMs,
            ...(failure === 'connection_refusal' ? { host: '127.0.0.1', port: closedPort } : {}),
            ...(failure === 'authentication_refusal' ? { password: 'intentionally-invalid-fixture-password' } : {}) });
          client.on('error', () => {});
          await client.connect();
          if (failure === 'backend_termination') {
            const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
            const query = client.query('SELECT pg_sleep(30)');
            void query.catch(() => {});
            admin = new pg.Client(evidenceOptions.connectionConfig);
            admin.on('error', () => {});
            await admin.connect();
            await admin.query('SELECT pg_terminate_backend($1)', [pid]);
            await query;
          }
          assert.fail('Controlled native connection failure did not occur');
        } catch (error) { primary = error; throw error; }
        finally { await client?.end(); await admin?.end(); }
      });
      await assert.rejects(pending, error => error === primary);
      assert.equal(records.length, 1);
      const expectedCode = failure === 'connection_refusal' ? 'ECONNREFUSED'
        : failure === 'authentication_refusal' ? '28P01' : '57P01';
      assert.equal(primary.code, expectedCode);
      assert.equal(records[0].errors[0].code, expectedCode);
      assert.equal(records[0].host.outcome, 'passed'); assert.equal(records[0].host.closed, true);
      assert.ok(records[0].host.version >= 180000); assert.equal(records[0].host.recovery, false);
      assert.equal(records[0].readiness.outcome, 'accepting'); assert.equal(records[0].readiness.cliExitCode, 0);
      assert.equal(JSON.stringify(records).includes('intentionally-invalid'), false);
      diagnosticPool = null;
    });
  }

  test('container readiness does not certify authentication and a failed probe closes its native client', {
    timeout: config.scenarioTimeoutMs,
  }, async () => {
    records = []; diagnosticPool = null; failProbeAuthentication = true;
    try {
      await assert.rejects(runtime.runIsolatedDatabase(async () => { throw null; }), error => error === null);
      assert.equal(records.length, 1);
      assert.equal(records[0].host.outcome, 'failed'); assert.equal(records[0].host.closed, true);
      assert.equal(records[0].host.errors[0].code, '28P01');
      assert.equal(records[0].readiness.outcome, 'accepting');
      assert.equal(JSON.stringify(records).includes('intentionally-invalid'), false);
    } finally { failProbeAuthentication = false; }
  });

  for (const entrypoint of ['functional', 'reusable']) {
    test(`${entrypoint} first-schema authentication failure captures once before app pool/environment cleanup`, {
      timeout: config.scenarioTimeoutMs,
    }, async t => {
      records = []; diagnosticPool = null; hold = createFixtureGate({ signal: t.signal });
      ready = createFixtureGate({ signal: t.signal });
      const previousDatabase = process.env.PGDATABASE;
      const checkoutRecords = []; let primary; let application;
      const options = { config, checkoutObserver: createPoolCheckoutObserver({ onRecord: record => checkoutRecords.push(record) }),
        createAppFn: () => assert.fail('Failed schema preparation created the application'),
        prepareDatabaseFn: async ({ getPoolFn }) => {
          const originalPassword = process.env.PGPASSWORD;
          try {
            process.env.PGPASSWORD = 'intentionally-invalid-fixture-password';
            await getPoolFn().connect();
          } catch (error) { primary = error; throw error; }
          finally { process.env.PGPASSWORD = originalPassword; }
        },
      };
      if (entrypoint === 'reusable') application = await createIntegrationAppRuntime({ ...options,
        postgresRuntimeFactory: async () => ({ runIsolatedDatabase: (...args) => runtime.runIsolatedDatabase(...args), cleanup: async () => {} }) });
      const pending = entrypoint === 'functional'
        ? withIntegrationApp({ ...options, run: () => assert.fail('Failed schema reached scenario'),
          withPostgresIntegrationRuntimeFn: ({ run, phaseObserver }) => runtime.runIsolatedDatabase(run, { phaseObserver }) })
        : application.runScenario(() => assert.fail('Failed schema reached scenario'));
      void pending.catch(() => {});
      try {
        await waitForFixtureReady({ ready: ready.promise, operation: pending, signal: t.signal });
        assert.equal(primary.code, '28P01'); assert.equal(getPool().ending, false);
        assert.notEqual(process.env.PGDATABASE, previousDatabase);
        assert.equal(records.length, 0); assert.equal(checkoutRecords.length, 1);
        hold.release(); await assert.rejects(pending, error => error === primary);
        assert.equal(records.length, 1); assert.equal(records[0].phase, 'schema_prepare');
        assert.equal(records[0].correlationId, checkoutRecords[0].correlationId);
        assert.equal(records[0].host.outcome, 'passed'); assert.equal(records[0].readiness.outcome, 'accepting');
        assert.equal(process.env.PGDATABASE, previousDatabase);
      } finally {
        hold.release(); await pending.catch(() => {}); await application?.cleanup();
        hold = null; ready = null;
      }
    });
  }
});
