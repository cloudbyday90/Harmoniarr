/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../../src/server/app.js';
import { closePool, getPool } from '../../src/server/database.js';
import { prepareDatabase } from '../../src/server/database-preparation.js';
import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';
import { createPostgresIntegrationRuntime, withPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';
import { createSessionHttpClient } from '../server/http-session-client.js';
import { withServer } from '../server/http-test-helpers.js';

const packageJsonPath = resolve(import.meta.dirname, '../../package.json');

async function withEnvironmentVariables(overrides, run) {
  const previous = new Map();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, Object.hasOwn(process.env, key) ? process.env[key] : undefined);
    if (value === null || value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = String(value);
  }

  try {
    return await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function buildTestPoolEnvironment(config) {
  return {
    HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE: String(config.poolAllowExitOnIdle),
    HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS: String(config.poolConnectionTimeoutMs),
    HARMONIARR_PG_POOL_IDLE_TIMEOUT_MS: String(config.poolIdleTimeoutMs),
    HARMONIARR_PG_POOL_MAX: String(config.poolMax),
    HARMONIARR_PG_POOL_MAX_USES: String(config.poolMaxUses),
  };
}

async function createRuntimeWorkspace() {
  const workspaceDir = await mkdtemp(join(tmpdir(), 'harmoniarr-integration-'));
  const clientDistDir = join(workspaceDir, 'client');

  await mkdir(clientDistDir, { recursive: true });
  await writeFile(
    join(clientDistDir, 'index.html'),
    '<!doctype html><html><body>Harmoniarr Integration Test Shell</body></html>',
    'utf8',
  );

  return {
    clientDistDir,
    workspaceDir,
  };
}

export async function createIntegrationAppRuntime({
  config = resolveIntegrationTestRuntimeConfig(),
  createAppFn = createApp,
  prepareDatabaseFn = prepareDatabase,
  postgresRuntimeFactory = createPostgresIntegrationRuntime,
} = {}) {
  const runtimeWorkspace = await createRuntimeWorkspace();
  let postgresRuntime;

  try {
    postgresRuntime = await postgresRuntimeFactory({ config });
  } catch (error) {
    await rm(runtimeWorkspace.workspaceDir, { force: true, recursive: true }).catch(() => {});
    throw error;
  }

  return {
    config,
    async cleanup() {
      await closePool().catch(() => {});
      await postgresRuntime.cleanup();
      await rm(runtimeWorkspace.workspaceDir, { force: true, recursive: true }).catch(() => {});
    },
    async runScenario(run, {
      scenarioName = 'integration_scenario',
    } = {}) {
      if (typeof run !== 'function') {
        throw new Error('run is required');
      }

      return postgresRuntime.runIsolatedDatabase(async ({
        databaseConfig,
        databaseName,
        source,
      }) => {
        const scenarioWorkspaceDir = join(runtimeWorkspace.workspaceDir, scenarioName);
        let scenarioFailed = true;

        await mkdir(scenarioWorkspaceDir, { recursive: true });
        await closePool().catch(() => {});

        return withEnvironmentVariables({
          HARMONIARR_CONTACT_EMAIL: 'integration-tests@example.invalid',
          ...buildTestPoolEnvironment(config),
          PGDATABASE: databaseConfig.database,
          PGHOST: databaseConfig.host,
          PGPASSWORD: databaseConfig.password ?? null,
          PGPORT: String(databaseConfig.port),
          PGUSER: databaseConfig.user,
        }, async () => {
          await closePool().catch(() => {});
          await prepareDatabaseFn();

          const { app } = createAppFn({
            clientDistDir: runtimeWorkspace.clientDistDir,
            packageJsonPath,
          });

          try {
            const result = await withServer(
              app,
              async (baseUrl) => run({
                baseUrl,
                client: createSessionHttpClient(baseUrl, {
                  requestTimeoutMs: config.httpRequestTimeoutMs,
                }),
                databaseConfig,
                databaseName,
                getPoolFn: getPool,
                postgresSource: source,
                workspaceDir: scenarioWorkspaceDir,
              }),
              {
                closeTimeoutMs: config.suiteTeardownTimeoutMs,
                listenTimeoutMs: config.poolConnectionTimeoutMs,
              },
            );
            scenarioFailed = false;
            return result;
          } finally {
            await closePool().catch(() => {});
            if (!config.keepArtifactsOnFailure || !scenarioFailed) {
              await rm(scenarioWorkspaceDir, { force: true, recursive: true }).catch(() => {});
            }
          }
        });
      });
    },
  };
}

export async function withIntegrationApp({
  config = resolveIntegrationTestRuntimeConfig(),
  createAppFn = createApp,
  prepareDatabaseFn = prepareDatabase,
  run,
  withPostgresIntegrationRuntimeFn = withPostgresIntegrationRuntime,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  const runtimeWorkspace = await createRuntimeWorkspace();

  try {
    return await withPostgresIntegrationRuntimeFn({
      config,
      run: async ({ databaseConfig, databaseName, source }) => {
        await closePool().catch(() => {});

        return withEnvironmentVariables({
          HARMONIARR_CONTACT_EMAIL: 'integration-tests@example.invalid',
          ...buildTestPoolEnvironment(config),
          PGDATABASE: databaseConfig.database,
          PGHOST: databaseConfig.host,
          PGPASSWORD: databaseConfig.password ?? null,
          PGPORT: String(databaseConfig.port),
          PGUSER: databaseConfig.user,
        }, async () => {
          await closePool().catch(() => {});
          await prepareDatabaseFn();

          const { app } = createAppFn({
            clientDistDir: runtimeWorkspace.clientDistDir,
            packageJsonPath,
          });

          try {
            return await withServer(
              app,
              async (baseUrl) => run({
                baseUrl,
                client: createSessionHttpClient(baseUrl, {
                  requestTimeoutMs: config.httpRequestTimeoutMs,
                }),
                databaseConfig,
                databaseName,
                getPoolFn: getPool,
                postgresSource: source,
                workspaceDir: runtimeWorkspace.workspaceDir,
              }),
              {
                closeTimeoutMs: config.suiteTeardownTimeoutMs,
                listenTimeoutMs: config.poolConnectionTimeoutMs,
              },
            );
          } finally {
            await closePool().catch(() => {});
          }
        });
      },
    });
  } finally {
    await closePool().catch(() => {});
    await rm(runtimeWorkspace.workspaceDir, { force: true, recursive: true }).catch(() => {});
  }
}
