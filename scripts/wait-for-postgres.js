/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import pg from 'pg';
import { buildConnectionConfig } from '../src/server/database.js';
import { formatScriptErrorMessage, runDirectScriptTask } from './script-runtime.js';

const { Client } = pg;

function createWait(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function validatePositiveInteger(value, propertyName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${propertyName} must be a positive integer`);
  }
}

export async function probePostgresConnection({
  clientFactory = (config) => new Client(config),
  config = buildConnectionConfig(),
} = {}) {
  const client = clientFactory(config);

  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    if (typeof client.end === 'function') {
      await client.end().catch(() => {});
    }
  }

  return config;
}

export async function waitForPostgres({
  config = buildConnectionConfig(),
  getNow = () => Date.now(),
  intervalMs = 250,
  probe = () => probePostgresConnection({ config }),
  timeoutMs = 30000,
  waitFn = createWait,
} = {}) {
  validatePositiveInteger(intervalMs, 'intervalMs');
  validatePositiveInteger(timeoutMs, 'timeoutMs');

  const startedAt = getNow();
  let attempts = 0;
  let lastError;

  while (true) {
    attempts += 1;

    try {
      await probe();
      return {
        attempts,
        config,
        waitedMs: getNow() - startedAt,
      };
    } catch (error) {
      lastError = error;
      if ((getNow() - startedAt) >= timeoutMs) {
        break;
      }

      await waitFn(intervalMs);
    }
  }

  throw new Error(
    `PostgreSQL did not become ready within ${timeoutMs}ms after ${attempts} attempt(s): ${formatScriptErrorMessage(lastError)}`,
  );
}

await runDirectScriptTask(import.meta, {
    prefix: 'harmoniarr-wait-for-postgres',
    renderSuccessMessage: ({ attempts, config, waitedMs }) => {
      return `PostgreSQL at ${config.host}:${config.port}/${config.database} is ready after ${attempts} attempt(s) and ${waitedMs}ms`;
    },
    run: () => waitForPostgres(),
  });
