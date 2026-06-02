/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import pg from 'pg';
import { attachPoolErrorHandler, buildConnectionConfig } from '../src/server/database.js';

const { Client, Pool } = pg;

const DRAIN_POLL_INTERVAL_MS = 50;
const DRAIN_TIMEOUT_MS = 5_000;

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

async function countActiveBackends(client, databaseName) {
  const result = await client.query(
    `
      SELECT COUNT(*)::integer AS active_count
      FROM pg_stat_activity
      WHERE datname = $1
        AND pid <> pg_backend_pid()
    `,
    [databaseName],
  );
  return result.rows[0]?.active_count ?? 0;
}

async function drainDatabaseBackends(client, databaseName) {
  const deadline = Date.now() + DRAIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const activeCount = await countActiveBackends(client, databaseName).catch(() => 0);
    if (activeCount === 0) {
      return;
    }

    await client.query(
      `
        SELECT pg_terminate_backend(pid)
        FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()
      `,
      [databaseName],
    ).catch(() => {});

    await new Promise((resolve) => {
      const timer = setTimeout(resolve, DRAIN_POLL_INTERVAL_MS);
      timer.unref?.();
    });
  }
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
  const databasePoolRuntimeState = { closing: false };
  let databasePool;

  try {
    await adminClient.connect();
    await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
    databasePool = createPool(databaseConfig);
    if (typeof databasePool?.on === 'function') {
      attachPoolErrorHandler(databasePool, { runtimeState: databasePoolRuntimeState });
    }

    return await run({
      databaseConfig,
      databaseName,
      getPoolFn: () => databasePool,
    });
  } finally {
    databasePoolRuntimeState.closing = true;
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

      await drainDatabaseBackends(adminClient, databaseName);

      await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`).catch(() => {});
    }

    if (typeof adminClient.end === 'function') {
      await adminClient.end().catch(() => {});
    }
  }
}
