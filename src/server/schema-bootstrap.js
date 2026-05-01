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

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getPool } from './database.js';

export const defaultSchemaSnapshotPath = resolve(import.meta.dirname, 'schema-snapshot.sql');

export async function getPublicTableCount(client) {
  const result = await client.query(`
    SELECT COUNT(*)::integer AS table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  `);

  return result.rows[0]?.table_count ?? 0;
}

export async function bootstrapDatabaseSchemaFromSnapshot({
  getPoolFn = getPool,
  readFileFn = readFile,
  schemaSnapshotPath = defaultSchemaSnapshotPath,
} = {}) {
  const pool = getPoolFn();
  const client = await pool.connect();

  try {
    const tableCount = await getPublicTableCount(client);
    if (tableCount > 0) {
      return {
        bootstrapped: false,
        reason: 'schema_not_empty',
        schemaSnapshotPath,
        tableCount,
      };
    }

    const snapshotSql = await readFileFn(schemaSnapshotPath, 'utf8');
    if (!snapshotSql.trim()) {
      throw new Error(`Schema snapshot is empty at ${schemaSnapshotPath}`);
    }

    await client.query(snapshotSql);

    return {
      bootstrapped: true,
      reason: 'empty_schema',
      schemaSnapshotPath,
      tableCount,
    };
  } finally {
    client.release();
  }
}