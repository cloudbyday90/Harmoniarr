/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import {
  createPostgresIntegrationRuntime,
  hasConfiguredPostgresAdminConnection,
  withPostgresIntegrationRuntime,
} from '../../testing/postgres-integration-runtime.js';

suite('PostgreSQL integration runtime', () => {
  test('detects whether an external admin connection is configured', () => {
    assert.equal(hasConfiguredPostgresAdminConnection({}), false);
    assert.equal(hasConfiguredPostgresAdminConnection({ PGPASSWORD: 'secret' }), true);
    assert.equal(hasConfiguredPostgresAdminConnection({ POSTGRES_PASSWORD: 'secret' }), true);
  });

  test('uses external PostgreSQL when admin credentials are configured', async () => {
    let observedArgs;

    const runtime = await createPostgresIntegrationRuntime({
      config: {
        containerStopTimeoutMs: 10000,
      },
      env: {
        PGDATABASE: 'postgres',
        PGHOST: 'db.internal',
        PGPASSWORD: 'secret',
        PGPORT: '5432',
        PGUSER: 'harmoniarr',
      },
      withTemporaryPostgresDatabaseFn: async (args) => {
        observedArgs = args;
        return args.run({
          databaseConfig: {
            database: 'harmoniarr_test',
            host: 'db.internal',
            password: 'secret',
            port: 5432,
            user: 'harmoniarr',
          },
          databaseName: 'harmoniarr_test',
          getPoolFn: () => 'external-pool',
        });
      },
    });

    const result = await runtime.runIsolatedDatabase(async (context) => context);
    await runtime.cleanup();

    assert.equal(runtime.source, 'external_postgres');
    assert.equal(observedArgs.env.PGHOST, 'db.internal');
    assert.equal(typeof observedArgs.createPool, 'function');
    assert.equal(result.getPoolFn(), 'external-pool');
    assert.equal(result.source, 'external_postgres');
  });

  test('starts one testcontainer runtime and stops it with a bounded timeout', async () => {
    const stopCalls = [];
    let observedArgs;

    const runtime = await createPostgresIntegrationRuntime({
      config: {
        containerStopTimeoutMs: 3210,
      },
      createPostgresContainer: () => ({
        async start() {
          return {
            getDatabase() {
              return 'harmoniarr';
            },
            getHost() {
              return '127.0.0.1';
            },
            getPassword() {
              return 'harmoniarr';
            },
            getPort() {
              return 55432;
            },
            getUsername() {
              return 'harmoniarr';
            },
            async stop(options) {
              stopCalls.push(options);
            },
          };
        },
      }),
      env: {},
      withTemporaryPostgresDatabaseFn: async (args) => {
        observedArgs = args;
        return args.run({
          databaseConfig: {
            database: 'harmoniarr_isolated',
            host: '127.0.0.1',
            password: 'harmoniarr',
            port: 55432,
            user: 'harmoniarr',
          },
          databaseName: 'harmoniarr_isolated',
          getPoolFn: () => 'container-pool',
        });
      },
    });

    const result = await runtime.runIsolatedDatabase(async (context) => context);
    await runtime.cleanup();

    assert.equal(runtime.source, 'testcontainer_postgres');
    assert.equal(observedArgs.env.PGHOST, '127.0.0.1');
    assert.equal(observedArgs.env.PGMAINTENANCE_DB, 'postgres');
    assert.equal(result.getPoolFn(), 'container-pool');
    assert.equal(result.source, 'testcontainer_postgres');
    assert.deepEqual(stopCalls, [{ timeout: 3210 }]);
  });
});

const fakeContainer = (stop) => ({ start: async () => ({
  getDatabase: () => 'unused', getHost: () => 'test-host', getPassword: () => 'controlled',
  getPort: () => 5432, getUsername: () => 'test-role', stop,
}) });

test('only explicit template mode selects preparation and gives scenarios clone context', async () => {
  const calls = [];
  const runtime = await createPostgresIntegrationRuntime({ env: { PGPASSWORD: 'controlled' }, schemaMode: 'migration_template',
    createPreparedPostgresTemplateFn: async (options) => {
      calls.push('prepare'); assert.equal(typeof options.createPool, 'function');
      return { runIsolatedDatabase: async (run) => run({ getPoolFn: () => 'clone-pool' }),
        cleanup: async () => calls.push('template cleanup') };
    },
    withTemporaryPostgresDatabaseFn: () => assert.fail('Template mode bypassed its owner'),
  });
  const context = await runtime.runIsolatedDatabase(async (input) => input);
  assert.equal(context.getPoolFn(), 'clone-pool'); assert.equal(context.schemaMode, 'migration_template');
  assert.equal(context.source, 'external_postgres');
  await runtime.cleanup(); await runtime.cleanup();
  assert.deepEqual(calls, ['prepare', 'template cleanup']);
});

test('invalid schema mode and pre-aborted startup refuse before creating a container', async () => {
  const createPostgresContainer = () => assert.fail('Refused runtime started a container');
  await assert.rejects(createPostgresIntegrationRuntime({ env: {}, schemaMode: 'unverified_cache', createPostgresContainer }), TypeError);
  const controller = new AbortController(); controller.abort(null);
  await createPostgresIntegrationRuntime({ env: {}, signal: controller.signal, createPostgresContainer })
    .then(() => assert.fail('Cancelled runtime launched'), (error) => assert.equal(error, null));
});

test('failed template startup still stops the owned server without replacing its error', async () => {
  const primary = new Error('Controlled template preparation failure'); let stopped = 0;
  await assert.rejects(createPostgresIntegrationRuntime({ env: {}, schemaMode: 'migration_template',
    createPreparedPostgresTemplateFn: async () => { throw primary; },
    createPostgresContainer: () => fakeContainer(async () => { stopped += 1; throw new Error('Secondary stop failure'); }),
  }), (error) => error === primary);
  assert.equal(stopped, 1);
});

test('template cleanup failure still stops the owned server and remains attributable', async () => {
  const failure = new Error('Controlled template cleanup failure'); const order = [];
  const runtime = await createPostgresIntegrationRuntime({ env: {}, schemaMode: 'migration_template',
    createPreparedPostgresTemplateFn: async () => ({ cleanup: async () => { order.push('template'); throw failure; } }),
    createPostgresContainer: () => fakeContainer(async () => { order.push('server'); }),
  });
  await assert.rejects(runtime.cleanup(), (error) => error === failure);
  assert.deepEqual(order, ['template', 'server']);
});

test('wrapper preserves original scenario error over strict template cleanup failure', async () => {
  const primary = new Error('Controlled scenario failure');
  await assert.rejects(withPostgresIntegrationRuntime({ env: { PGPASSWORD: 'controlled' }, schemaMode: 'migration_template',
    createPreparedPostgresTemplateFn: async () => ({ runIsolatedDatabase: async (run) => run({}),
      cleanup: async () => { throw new Error('Secondary template cleanup failure'); } }),
    run: async () => { throw primary; },
  }), (error) => error === primary);
});
