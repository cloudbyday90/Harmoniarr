/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import pg from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { attachPoolErrorHandler } from '../src/server/database.js';

const { Pool } = pg;

export const defaultSchemaPostgresImage = 'postgres:18-alpine';

function buildDockerPostgresEnv({
  container,
  database,
  host,
  password,
  port,
  username,
}) {
  return {
    ...process.env,
    PGDATABASE: database,
    PGHOST: host,
    PGMAINTENANCE_DB: 'postgres',
    PGPASSWORD: password,
    PGPORT: String(port),
    PGUSER: username,
    POSTGRES_DB: database,
    POSTGRES_HOST: host,
    POSTGRES_PASSWORD: password,
    POSTGRES_PORT: String(port),
    POSTGRES_USER: username,
    TESTCONTAINERS_CONTAINER_ID: container?.getId?.() ?? undefined,
  };
}

function resolveContainerConfig(container) {
  return {
    database: container.getDatabase(),
    host: container.getHost(),
    password: container.getPassword(),
    port: container.getPort(),
    username: container.getUsername(),
  };
}

export async function withDockerizedPostgresDatabase({
  containerFactory = (postgresImage) => new PostgreSqlContainer(postgresImage),
  createPool = (config) => new Pool(config),
  database = 'harmoniarr',
  image = process.env.HARMONIARR_SCHEMA_POSTGRES_IMAGE ?? defaultSchemaPostgresImage,
  password = 'harmoniarr',
  run,
  username = 'harmoniarr',
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  let container = null;
  let pool = null;
  const poolRuntimeState = { closing: false };

  try {
    container = await containerFactory(image)
      .withDatabase(database)
      .withUsername(username)
      .withPassword(password)
      .start();

    const config = resolveContainerConfig(container);
    const env = buildDockerPostgresEnv({ container, ...config });
    const databaseConfig = {
      database: config.database,
      host: config.host,
      password: config.password,
      port: config.port,
      user: config.username,
    };

    pool = createPool(databaseConfig);
    if (typeof pool?.on === 'function') {
      attachPoolErrorHandler(pool, { runtimeState: poolRuntimeState });
    }

    return await run({
      container,
      databaseConfig,
      databaseName: config.database,
      env,
      getPoolFn: () => pool,
      image,
    });
  } finally {
    poolRuntimeState.closing = true;
    await pool?.end?.().catch(() => {});
    await container?.stop?.().catch(() => {});
  }
}
