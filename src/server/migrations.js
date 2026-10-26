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

import { ensureSchemaTable } from './schema-migration-store.js';
import { assertMigrationPreparationSafe } from './migration-preparation-service.js';
import { prepareMigrationTransactionSql } from './migration-sql-transaction-policy.js';
import { assertIdleMigrationClient, executeMigrationTransaction } from './migration-transaction-service.js';
import { withDatabasePreparation } from './database-preparation-owner-service.js';
export { getMigrationStatus, assertNoPendingMigrations } from './schema-migration-status-service.js';
export { verifyAppliedMigrationChecksums, assertNoMigrationChecksumDrift } from './migration-checksum-service.js';

export async function applyPendingMigrations({ getPoolFn, preparation, retryFailedMigrations = false, loadMigrationManifestFn } = {}) {
  return withDatabasePreparation({ getPoolFn, preparation }, async ({ client, markClientUnusable }) => {
    assertIdleMigrationClient(client, markClientUnusable);
    const plan = await assertMigrationPreparationSafe({ queryable: client, retryFailedMigrations, loadMigrationManifestFn });
    const pendingNames = new Set(plan.pending);
    const pending = plan.repoMigrations.filter(file => pendingNames.has(file.filename));
    const prepared = pending.map(migration => ({ migration, sql: prepareMigrationTransactionSql(migration.sql) }));
    await ensureSchemaTable(client);
    for (const { migration, sql } of prepared) {
      await executeMigrationTransaction({ client, migration, sql, markClientUnusable });
    }
    return pending.map(migration => migration.filename);
  });
}
