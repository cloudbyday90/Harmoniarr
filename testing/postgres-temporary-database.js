/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import pg from 'pg';
import { attachPoolErrorHandler, buildConnectionConfig } from '../src/server/database.js';
import { createIntegrationFixturePhaseObserver } from './integration/fixture-phase-observer.js';
import { drainPostgresFixtureBackends } from './integration/postgres-backend-drain.js';

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
  phaseObserver = createIntegrationFixturePhaseObserver({ env }),
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
  let databaseCreated = false;

  try {
    await phaseObserver.measure('database_connect', () => adminClient.connect());
    await phaseObserver.measure('database_create', () => adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`));
    databaseCreated = true;
    databasePool = await phaseObserver.measure('pool_create', () => createPool(databaseConfig));
    if (typeof databasePool?.on === 'function') {
      attachPoolErrorHandler(databasePool, { runtimeState: databasePoolRuntimeState });
    }

    return await run({
      databaseConfig,
      databaseName,
      getPoolFn: () => databasePool,
      phaseObserver,
    });
  } finally {
    databasePoolRuntimeState.closing = true;
    if (databasePool) await phaseObserver.measure('pool_close', () => databasePool.end()).catch(() => {});

    if (databaseCreated && typeof adminClient.query === 'function') {
      await phaseObserver.measure('backend_drain', () => drainPostgresFixtureBackends({ adminClient, databaseName })).catch(() => {});

      await phaseObserver.measure('database_drop', () => adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`)).catch(() => {});
    }

    if (typeof adminClient.end === 'function') {
      await phaseObserver.measure('admin_close', () => adminClient.end()).catch(() => {});
    }
  }
}
