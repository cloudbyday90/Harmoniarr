/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
import { buildPoolConfig } from '../src/server/database.js';
import { resolveIntegrationTestRuntimeConfig } from './integration/runtime-config.js';
import { withTemporaryPostgresDatabase } from './postgres-temporary-database.js';

const { Pool } = pg;

export function hasConfiguredPostgresAdminConnection(env = process.env) {
  const password = env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? '';
  return typeof password === 'string' && password.trim().length > 0;
}

function createPoolFactory(env) {
  return (databaseConfig) => new Pool({
    ...buildPoolConfig(env),
    ...databaseConfig,
  });
}

function createDefaultPostgresContainer(config) {
  const container = new PostgreSqlContainer(config.postgresImage)
    .withStartupTimeout(config.startupTimeoutMs)
    .withDatabase('harmoniarr')
    .withUsername('harmoniarr')
    .withPassword('harmoniarr');

  if (config.useContainerReuse) {
    return container.withReuse();
  }

  return container;
}

export async function createPostgresIntegrationRuntime({
  config = resolveIntegrationTestRuntimeConfig(),
  createPostgresContainer = createDefaultPostgresContainer,
  env = process.env,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
} = {}) {
  if (hasConfiguredPostgresAdminConnection(env)) {
    return {
      config,
      source: 'external_postgres',
      async cleanup() {},
      async runIsolatedDatabase(run) {
        return withTemporaryPostgresDatabaseFn({
          createPool: createPoolFactory(env),
          env,
          run: ({ databaseConfig, databaseName, getPoolFn }) => run({
            databaseConfig,
            databaseName,
            getPoolFn,
            source: 'external_postgres',
          }),
        });
      },
    };
  }

  const container = await createPostgresContainer(config).start();
  const containerEnv = {
    PGDATABASE: container.getDatabase(),
    PGHOST: container.getHost(),
    PGMAINTENANCE_DB: 'postgres',
    PGPASSWORD: container.getPassword(),
    PGPORT: String(container.getPort()),
    PGUSER: container.getUsername(),
  };

  return {
    config,
    source: 'testcontainer_postgres',
    async cleanup() {
      await container.stop({
        timeout: config.containerStopTimeoutMs,
      }).catch(() => {});
    },
    async runIsolatedDatabase(run) {
      return withTemporaryPostgresDatabaseFn({
        createPool: createPoolFactory(containerEnv),
        env: containerEnv,
        run: ({ databaseConfig, databaseName, getPoolFn }) => run({
          databaseConfig,
          databaseName,
          getPoolFn,
          source: 'testcontainer_postgres',
        }),
      });
    },
  };
}

export async function withPostgresIntegrationRuntime({
  createPostgresContainer = createDefaultPostgresContainer,
  config = resolveIntegrationTestRuntimeConfig(),
  env = process.env,
  run,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  const runtime = await createPostgresIntegrationRuntime({
    config,
    createPostgresContainer,
    env,
    withTemporaryPostgresDatabaseFn,
  });

  try {
    return await runtime.runIsolatedDatabase(run);
  } finally {
    await runtime.cleanup();
  }
}
