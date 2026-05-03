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
import { withPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';
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

export async function withIntegrationApp({
  createAppFn = createApp,
  prepareDatabaseFn = prepareDatabase,
  run,
  withPostgresIntegrationRuntimeFn = withPostgresIntegrationRuntime,
} = {}) {
  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  const workspaceDir = await mkdtemp(join(tmpdir(), 'harmoniarr-integration-'));
  const clientDistDir = join(workspaceDir, 'client');

  try {
    await mkdir(clientDistDir, { recursive: true });
    await writeFile(
      join(clientDistDir, 'index.html'),
      '<!doctype html><html><body>Harmoniarr Integration Test Shell</body></html>',
      'utf8',
    );

    return await withPostgresIntegrationRuntimeFn({
      run: async ({ databaseConfig, databaseName, source }) => {
        await closePool();

        return withEnvironmentVariables({
          HARMONIARR_CONTACT_EMAIL: 'integration-tests@example.invalid',
          PGDATABASE: databaseConfig.database,
          PGHOST: databaseConfig.host,
          PGPASSWORD: databaseConfig.password ?? null,
          PGPORT: String(databaseConfig.port),
          PGUSER: databaseConfig.user,
        }, async () => {
          await closePool();
          await prepareDatabaseFn();

          const { app } = createAppFn({
            clientDistDir,
            packageJsonPath,
          });

          try {
            return await withServer(app, async (baseUrl) => run({
              baseUrl,
              client: createSessionHttpClient(baseUrl),
              databaseConfig,
              databaseName,
              getPoolFn: getPool,
              postgresSource: source,
              workspaceDir,
            }));
          } finally {
            await closePool().catch(() => {});
          }
        });
      },
    });
  } finally {
    await closePool().catch(() => {});
    await rm(workspaceDir, { force: true, recursive: true });
  }
}
