/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import pg from 'pg';

const { Pool } = pg;

let sharedPool;

function parseOptionalInteger(value, name) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer when configured`);
  }

  return parsed;
}

function parseOptionalPositiveInteger(value, name) {
  const parsed = parseOptionalInteger(value, name);
  if (parsed === undefined) {
    return undefined;
  }

  if (parsed <= 0) {
    throw new Error(`${name} must be greater than 0 when configured`);
  }

  return parsed;
}

function parseOptionalBoolean(value, name) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`${name} must be "true" or "false" when configured`);
}

export function buildConnectionConfig(env = process.env) {
  return {
    host: env.PGHOST ?? env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number.parseInt(env.PGPORT ?? env.POSTGRES_PORT ?? '5432', 10),
    user: env.PGUSER ?? env.POSTGRES_USER ?? 'harmoniarr',
    password: env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? undefined,
    database: env.PGDATABASE ?? env.POSTGRES_DB ?? 'harmoniarr',
  };
}

export function buildPoolConfig(env = process.env) {
  const connectionConfig = buildConnectionConfig(env);
  const allowExitOnIdle = parseOptionalBoolean(
    env.HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE ?? env.PGPOOL_ALLOW_EXIT_ON_IDLE,
    'HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE',
  );
  const connectionTimeoutMillis = parseOptionalPositiveInteger(
    env.HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS ?? env.PGPOOL_CONNECTION_TIMEOUT_MS,
    'HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS',
  );
  const idleTimeoutMillis = parseOptionalPositiveInteger(
    env.HARMONIARR_PG_POOL_IDLE_TIMEOUT_MS ?? env.PGPOOL_IDLE_TIMEOUT_MS,
    'HARMONIARR_PG_POOL_IDLE_TIMEOUT_MS',
  );
  const max = parseOptionalPositiveInteger(
    env.HARMONIARR_PG_POOL_MAX ?? env.PGPOOL_MAX,
    'HARMONIARR_PG_POOL_MAX',
  );
  const maxUses = parseOptionalPositiveInteger(
    env.HARMONIARR_PG_POOL_MAX_USES ?? env.PGPOOL_MAX_USES,
    'HARMONIARR_PG_POOL_MAX_USES',
  );

  return {
    ...connectionConfig,
    ...(allowExitOnIdle === undefined ? {} : { allowExitOnIdle }),
    ...(connectionTimeoutMillis === undefined ? {} : { connectionTimeoutMillis }),
    ...(idleTimeoutMillis === undefined ? {} : { idleTimeoutMillis }),
    ...(max === undefined ? {} : { max }),
    ...(maxUses === undefined ? {} : { maxUses }),
  };
}

export function getPool() {
  if (!sharedPool) {
    sharedPool = new Pool(buildPoolConfig());
  }

  return sharedPool;
}

export async function closePool() {
  if (sharedPool) {
    const pool = sharedPool;
    sharedPool = undefined;
    await pool.end();
  }
}
