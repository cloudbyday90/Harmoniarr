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
import { buildPostgresAdminConnectionConfig, withTemporaryPostgresDatabase } from './postgres-temporary-database.js';
import { createIntegrationFixturePhaseObserver } from './integration/fixture-phase-observer.js';
import { createPreparedPostgresTemplate } from './integration/postgres-migration-template.js';
import { createPostgresFailureEvidence } from './integration/postgres-failure-evidence.js';
import { buildIntegrationPoolConfig } from './integration/pool-policy.js';
import { observeFixturePoolCheckouts, resolveFixtureCheckoutMode } from './integration/fixture-pool-checkout.js';

const { Pool } = pg;

export function hasConfiguredPostgresAdminConnection(env = process.env) {
  const password = env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? '';
  return typeof password === 'string' && password.trim().length > 0;
}

function createPoolFactory(env, config) {
  return (databaseConfig) => new Pool({
    ...buildPoolConfig(env),
    ...databaseConfig,
    ...buildIntegrationPoolConfig(config),
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

async function createDatabaseRuntime({ config, env, source, phaseObserver, schemaMode, signal,
  closeServer, createPreparedPostgresTemplateFn, withTemporaryPostgresDatabaseFn, failureEvidence,
  checkoutMode, checkoutRecord }) {
  const createPool = createPoolFactory(env, config);
  const prepared = schemaMode === 'migration_template'
    ? await createPreparedPostgresTemplateFn({ env, createPool, phaseObserver: phaseObserver.child(), signal,
      withTemporaryPostgresDatabaseFn })
    : null;
  let cleanupPromise;
  return {
    config, source, schemaMode,
    cleanup() {
      if (!cleanupPromise) {
        cleanupPromise = (async () => {
          let failed = false; let failure;
          try { await prepared?.cleanup(); }
          catch (error) { failed = true; failure = error; }
          try { await closeServer(); }
          catch (error) { if (prepared && !failed) { failed = true; failure = error; } }
          if (failed) throw failure;
        })();
        cleanupPromise.catch(() => {});
      }
      return cleanupPromise;
    },
    async runIsolatedDatabase(run, { phaseObserver: observer = phaseObserver.child(), signal: caseSignal } = {}) {
      if (typeof run !== 'function') throw new TypeError('Database scenario requires a callback');
      const captureScenario = failureEvidence.createCapture({ correlationId: observer.correlationId, signal: caseSignal });
      const captureCheckout = failureEvidence.createCapture({ correlationId: observer.correlationId, signal: caseSignal });
      let checkoutFailed = false;
      const captureServerFailure = (error, phase) => checkoutFailed ? Promise.resolve() : captureScenario(error, phase);
      const captureCheckoutFailure = (error, checkoutId) => {
        checkoutFailed = true; return captureCheckout(error, 'pool_checkout', checkoutId);
      };
      const execute = async (context) => {
        const pool = typeof context.getPoolFn === 'function' ? context.getPoolFn() : null;
        const diagnostics = typeof pool?.connect === 'function' ? observeFixturePoolCheckouts({ pool,
          poolKind: 'scenario_pool', source, expectedConfig: context.databaseConfig,
          phaseObserver: observer, mode: checkoutMode,
          captureFailure: captureCheckoutFailure, ...(checkoutRecord ? { onRecord: checkoutRecord } : {}) }) : null;
        let failed = false; let failure; let result;
        try { result = await run({ ...context, source, schemaMode, phaseObserver: observer,
          captureServerFailure, captureCheckoutFailure }); } catch (error) { failed = true; failure = error; }
        try { await diagnostics?.restore(); } catch (error) { if (!failed) { failed = true; failure = error; } }
        if (failed) throw failure;
        return result;
      };
      if (prepared) return prepared.runIsolatedDatabase(execute, { phaseObserver: observer, signal: caseSignal, onFailure: captureServerFailure });
      return withTemporaryPostgresDatabaseFn({ createPool, env, phaseObserver: observer, signal: caseSignal, run: execute,
        onFailure: captureServerFailure });
    },
  };
}

export async function createPostgresIntegrationRuntime({
  config = resolveIntegrationTestRuntimeConfig(),
  createPostgresContainer = createDefaultPostgresContainer,
  env = process.env,
  phaseObserver = createIntegrationFixturePhaseObserver({ env }),
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
  createPreparedPostgresTemplateFn = createPreparedPostgresTemplate,
  schemaMode = 'empty',
  signal,
  failureEvidenceFactory = createPostgresFailureEvidence,
  checkoutRecord = null,
} = {}) {
  if (!['empty', 'migration_template'].includes(schemaMode)) throw new TypeError('Invalid PostgreSQL fixture schema mode');
  if (signal?.aborted) throw signal.reason;
  const evidenceMode = env.HARMONIARR_INTEGRATION_SERVER_DIAGNOSTICS ?? 'failures';
  if (!['off', 'failures'].includes(evidenceMode)) throw new TypeError('Invalid PostgreSQL server diagnostic setting');
  const checkoutMode = resolveFixtureCheckoutMode(env);
  if (checkoutRecord !== null && typeof checkoutRecord !== 'function') throw new TypeError('Invalid fixture checkout sink');
  const fresh = createPostgresContainer === createDefaultPostgresContainer && !config.useContainerReuse;
  if (hasConfiguredPostgresAdminConnection(env)) {
    return createDatabaseRuntime({ config, env, source: 'external_postgres', phaseObserver, schemaMode, signal,
      closeServer: async () => {}, createPreparedPostgresTemplateFn, withTemporaryPostgresDatabaseFn,
      checkoutMode, checkoutRecord,
      failureEvidence: failureEvidenceFactory({ mode: evidenceMode, source: 'external_postgres' }) });
  }

  const container = await phaseObserver.measure('container_start', () => createPostgresContainer(config).start());
  const containerEnv = {
    PGDATABASE: container.getDatabase(),
    PGHOST: container.getHost(),
    PGMAINTENANCE_DB: 'postgres',
    PGPASSWORD: container.getPassword(),
    PGPORT: String(container.getPort()),
    PGUSER: container.getUsername(),
  };

  const closeServer = () => phaseObserver.measure('container_stop', () => container.stop({ timeout: config.containerStopTimeoutMs }));
  try {
    return await createDatabaseRuntime({ config, env: containerEnv, source: 'testcontainer_postgres', phaseObserver,
      schemaMode, signal, closeServer, createPreparedPostgresTemplateFn, withTemporaryPostgresDatabaseFn,
      checkoutMode, checkoutRecord,
      failureEvidence: failureEvidenceFactory({ mode: evidenceMode,
        source: 'testcontainer_postgres', fresh, containerId: container.getId?.(),
        connectionConfig: buildPostgresAdminConnectionConfig(containerEnv) }) });
  } catch (error) { await closeServer().catch(() => {}); throw error; }
}

export async function withPostgresIntegrationRuntime({
  createPostgresContainer = createDefaultPostgresContainer,
  config = resolveIntegrationTestRuntimeConfig(),
  env = process.env,
  phaseObserver = createIntegrationFixturePhaseObserver({ env }),
  run,
  withTemporaryPostgresDatabaseFn = withTemporaryPostgresDatabase,
  createPreparedPostgresTemplateFn = createPreparedPostgresTemplate,
  schemaMode = 'empty',
  signal,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  const runtime = await createPostgresIntegrationRuntime({
    config,
    createPostgresContainer,
    env,
    phaseObserver,
    withTemporaryPostgresDatabaseFn,
    createPreparedPostgresTemplateFn,
    schemaMode,
    signal,
  });

  let result; let failed = false; let failure;
  try {
    result = await runtime.runIsolatedDatabase(run, { signal, phaseObserver });
  } catch (error) { failed = true; failure = error; }
  try { await runtime.cleanup(); }
  catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
