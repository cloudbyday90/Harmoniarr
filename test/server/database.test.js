import assert from 'node:assert/strict';
import test from 'node:test';
import { buildConnectionConfig } from '../../src/server/database.js';

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