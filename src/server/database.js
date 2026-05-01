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

export function buildConnectionConfig(env = process.env) {
  return {
    host: env.PGHOST ?? env.POSTGRES_HOST ?? '127.0.0.1',
    port: Number.parseInt(env.PGPORT ?? env.POSTGRES_PORT ?? '5432', 10),
    user: env.PGUSER ?? env.POSTGRES_USER ?? 'harmoniarr',
    password: env.PGPASSWORD ?? env.POSTGRES_PASSWORD ?? undefined,
    database: env.PGDATABASE ?? env.POSTGRES_DB ?? 'harmoniarr',
  };
}

export function getPool() {
  if (!sharedPool) {
    sharedPool = new Pool(buildConnectionConfig());
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
