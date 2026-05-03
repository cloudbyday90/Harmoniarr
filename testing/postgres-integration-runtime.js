/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { withTemporaryPostgresDatabase } from './postgres-temporary-database.js';

const { Pool } = pg;

export function hasConfiguredPostgresAdminConnection(env = process.env) {
  const password = env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? '';
  return typeof password === 'string' && password.trim().length > 0;
}

function createDefaultPostgresContainer() {
  return new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('harmoniarr')
    .withUsername('harmoniarr')
    .withPassword('harmoniarr');
}

export async function withPostgresIntegrationRuntime({
  createPostgresContainer = createDefaultPostgresContainer,
  env = process.env,
  run,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  if (hasConfiguredPostgresAdminConnection(env)) {
    return withTemporaryPostgresDatabaseFn({
      env,
      run: ({ databaseConfig, databaseName, getPoolFn }) => run({
        databaseConfig,
        databaseName,
        getPoolFn,
        source: 'external_postgres',
      }),
    });
  }

  const container = await createPostgresContainer().start();
  const databaseConfig = {
    database: container.getDatabase(),
    host: container.getHost(),
    password: container.getPassword(),
    port: container.getPort(),
    user: container.getUsername(),
  };
  const pool = new Pool(databaseConfig);

  try {
    return await run({
      databaseConfig,
      databaseName: databaseConfig.database,
      getPoolFn: () => pool,
      source: 'testcontainer_postgres',
    });
  } finally {
    await pool.end().catch(() => {});
  }
}
