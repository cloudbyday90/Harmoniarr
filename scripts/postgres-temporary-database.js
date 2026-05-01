/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import pg from 'pg';
import { buildConnectionConfig } from '../src/server/database.js';

const { Client, Pool } = pg;

export function buildPostgresAdminConnectionConfig(env = process.env) {
  return {
    ...buildConnectionConfig(env),
    database: env.PGMAINTENANCE_DB ?? 'postgres',
  };
}

export function createTemporaryDatabaseName(prefix = 'harmoniarr_schema_snapshot') {
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomSuffix}`;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

export async function withTemporaryPostgresDatabase({
  adminClientFactory = (config) => new Client(config),
  createPool = (config) => new Pool(config),
  databaseName = createTemporaryDatabaseName(),
  env = process.env,
  run,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  const adminConfig = buildPostgresAdminConnectionConfig(env);
  const databaseConfig = {
    ...buildConnectionConfig(env),
    database: databaseName,
  };
  const adminClient = adminClientFactory(adminConfig);
  let databasePool;

  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    databasePool = createPool(databaseConfig);

    return await run({
      databaseConfig,
      databaseName,
      getPoolFn: () => databasePool,
    });
  } finally {
    await databasePool?.end().catch(() => {});

    if (typeof adminClient.query === 'function') {
      await adminClient.query(
        `
          SELECT pg_terminate_backend(pid)
          FROM pg_stat_activity
          WHERE datname = $1
            AND pid <> pg_backend_pid()
        `,
        [databaseName],
      ).catch(() => {});
      await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(() => {});
    }

    if (typeof adminClient.end === 'function') {
      await adminClient.end().catch(() => {});
    }
  }
}