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
  createDatabaseFn = ({ adminClient, databaseName: name }) => adminClient.query(`CREATE DATABASE ${quoteIdentifier(name)}`),
  strictCleanup = false,
  signal,
  run,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }
  if (typeof createDatabaseFn !== 'function' || typeof strictCleanup !== 'boolean'
    || (signal != null && typeof signal.aborted !== 'boolean')) throw new TypeError('Invalid temporary database lifecycle options');
  const assertNotAborted = () => { if (signal?.aborted) throw signal.reason; };
  assertNotAborted();

  const adminConfig = buildPostgresAdminConnectionConfig(env);
  const databaseConfig = {
    ...buildConnectionConfig(env),
    database: databaseName,
  };
  const adminClient = adminClientFactory(adminConfig);
  const databasePoolRuntimeState = { closing: false };
  let databasePool;
  let databaseCreated = false;
  let result; let primaryError; let failed = false; let cleanupError; let cleanupFailed = false;
  const cleanup = async (phase, operation) => {
    try { await phaseObserver.measure(phase, operation); }
    catch (error) { if (!cleanupFailed) { cleanupFailed = true; cleanupError = error; } }
  };

  try {
    await phaseObserver.measure('database_connect', () => adminClient.connect());
    assertNotAborted();
    await phaseObserver.measure('database_create', () => createDatabaseFn({ adminClient, databaseName }));
    databaseCreated = true;
    assertNotAborted();
    databasePool = await phaseObserver.measure('pool_create', () => createPool(databaseConfig));
    if (typeof databasePool?.on === 'function') {
      attachPoolErrorHandler(databasePool, { runtimeState: databasePoolRuntimeState });
    }
    assertNotAborted();

    result = await run({
      databaseConfig,
      databaseName,
      getPoolFn: () => databasePool,
      phaseObserver,
    });
  } catch (error) { failed = true; primaryError = error; }
  finally {
    databasePoolRuntimeState.closing = true;
    if (databasePool) await cleanup('pool_close', () => databasePool.end());

    if (databaseCreated && typeof adminClient.query === 'function') {
      await cleanup('backend_drain', () => drainPostgresFixtureBackends({ adminClient, databaseName }));

      await cleanup('database_drop', () => adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`));
    }

    if (typeof adminClient.end === 'function') {
      await cleanup('admin_close', () => adminClient.end());
    }
  }
  if (failed) throw primaryError;
  if (strictCleanup && cleanupFailed) throw cleanupError;
  return result;
}
