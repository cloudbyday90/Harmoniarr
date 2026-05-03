import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import {
  createPostgresIntegrationRuntime,
  hasConfiguredPostgresAdminConnection,
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
