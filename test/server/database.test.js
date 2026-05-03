import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { buildConnectionConfig, buildPoolConfig } from '../../src/server/database.js';

suite('database configuration', () => {
  test('buildConnectionConfig prefers PG* variables and includes password when configured', () => {
    const config = buildConnectionConfig({
      PGDATABASE: 'harmoniarr_ci',
      PGHOST: 'db.internal',
      PGPASSWORD: 'secret-value',
      PGPORT: '6432',
      PGUSER: 'ci_user',
      POSTGRES_DB: 'fallback_db',
      POSTGRES_HOST: 'fallback-host',
      POSTGRES_PASSWORD: 'fallback-password',
      POSTGRES_PORT: '7432',
      POSTGRES_USER: 'fallback-user',
    });

    assert.deepEqual(config, {
      database: 'harmoniarr_ci',
      host: 'db.internal',
      password: 'secret-value',
      port: 6432,
      user: 'ci_user',
    });
  });

  test('buildConnectionConfig falls back to POSTGRES_* variables and embedded defaults', () => {
    const fromPostgresEnv = buildConnectionConfig({
      POSTGRES_DB: 'harmoniarr',
      POSTGRES_HOST: 'postgres',
      POSTGRES_PASSWORD: 'postgres-secret',
      POSTGRES_PORT: '5433',
      POSTGRES_USER: 'harmoniarr',
    });

    assert.deepEqual(fromPostgresEnv, {
      database: 'harmoniarr',
      host: 'postgres',
      password: 'postgres-secret',
      port: 5433,
      user: 'harmoniarr',
    });

    const defaults = buildConnectionConfig({});

    assert.deepEqual(defaults, {
      database: 'harmoniarr',
      host: '127.0.0.1',
      password: undefined,
      port: 5432,
      user: 'harmoniarr',
    });
  });

  test('buildPoolConfig adds integration-friendly pool overrides when configured', () => {
    const config = buildPoolConfig({
      HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE: 'true',
      HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS: '11000',
      HARMONIARR_PG_POOL_IDLE_TIMEOUT_MS: '900',
      HARMONIARR_PG_POOL_MAX: '3',
      HARMONIARR_PG_POOL_MAX_USES: '40',
      PGDATABASE: 'harmoniarr_ci',
      PGHOST: 'db.internal',
      PGPASSWORD: 'secret-value',
      PGPORT: '6432',
      PGUSER: 'ci_user',
    });

    assert.deepEqual(config, {
      allowExitOnIdle: true,
      connectionTimeoutMillis: 11000,
      database: 'harmoniarr_ci',
      host: 'db.internal',
      idleTimeoutMillis: 900,
      max: 3,
      maxUses: 40,
      password: 'secret-value',
      port: 6432,
      user: 'ci_user',
    });
  });

  test('buildPoolConfig rejects malformed pool tuning values', () => {
    assert.throws(
      () => buildPoolConfig({
        HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE: 'sometimes',
      }),
      /HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE must be "true" or "false"/,
    );

    assert.throws(
      () => buildPoolConfig({
        HARMONIARR_PG_POOL_MAX: '0',
      }),
      /HARMONIARR_PG_POOL_MAX must be greater than 0/,
    );
  });
});
