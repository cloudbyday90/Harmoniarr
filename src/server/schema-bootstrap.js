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
import { assertMigrationPreparationSafe } from './migration-preparation-service.js';
import { withDatabasePreparation } from './database-preparation-owner-service.js';
import { prepareSchemaSnapshotSql } from './schema-snapshot-plan-service.js';
import { executeSchemaSnapshotTransaction } from './schema-snapshot-transaction-service.js';
import { loadSchemaAnchorContract, assertSnapshotSchemaAnchors } from './schema-anchor-contract-service.js';

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
  getPoolFn,
  preparation,
  readFileFn = readFile,
  assertMigrationPreparationSafeFn = assertMigrationPreparationSafe,
  loadSchemaAnchorContractFn = loadSchemaAnchorContract,
  assertSnapshotSchemaAnchorsFn = assertSnapshotSchemaAnchors,
  schemaSnapshotPath = defaultSchemaSnapshotPath,
} = {}) {
  return withDatabasePreparation({ getPoolFn, preparation }, async ({ client, markClientUnusable }) => {
    const tableCount = await getPublicTableCount(client);
    if (tableCount > 0) {
      return {
        bootstrapped: false,
        reason: 'schema_not_empty',
        schemaSnapshotPath,
        tableCount,
      };
    }

    const plan = await assertMigrationPreparationSafeFn({ queryable: client });
    if (!plan.fresh) throw new Error('Snapshot bootstrap requires an empty public schema');
    const snapshotSql = await readFileFn(schemaSnapshotPath, 'utf8');
    if (!snapshotSql.trim()) {
      throw new Error(`Schema snapshot is empty at ${schemaSnapshotPath}`);
    }

    const sql = prepareSchemaSnapshotSql({ snapshotSql, repoMigrations: plan.repoMigrations });
    const contract = await loadSchemaAnchorContractFn({ snapshotSql, repoMigrations: plan.repoMigrations });
    await executeSchemaSnapshotTransaction({ client, markClientUnusable, sql, repoMigrations: plan.repoMigrations,
      contract, assertSnapshotSchemaAnchorsFn });

    return {
      bootstrapped: true,
      reason: 'empty_schema',
      schemaSnapshotPath,
      tableCount,
    };
  });
}
