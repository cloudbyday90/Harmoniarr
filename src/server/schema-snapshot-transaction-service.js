/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { executeOwnedSqlTransaction } from './owned-sql-transaction-service.js';
import { getDatabaseMigrationRows } from './schema-migration-store.js';
import { buildDatabaseMigrationStateReport } from './schema-migration-state-service.js';

export async function executeSchemaSnapshotTransaction({ client, markClientUnusable, sql, repoMigrations }) {
  return executeOwnedSqlTransaction({ client, markClientUnusable,
    unknownCommitErrorFn: cause => Object.assign(new Error('Schema snapshot commit outcome is unknown. Stop writers and inspect with npm run diagnose:migrations using an independent maintenance connection before retrying.', { cause }),
      { code: 'snapshot_commit_outcome_unknown' }),
    commitRolledBackErrorFn: () => Object.assign(new Error('Schema snapshot transaction was rolled back instead of committed.'), { code: 'snapshot_commit_rolled_back' }),
    work: async () => {
      await client.query(sql);
      const databaseRows = await getDatabaseMigrationRows(client);
      const report = buildDatabaseMigrationStateReport({ databaseRows, repoMigrations });
      if (!report.current || databaseRows.length !== repoMigrations.length) {
        throw Object.assign(new Error('Schema snapshot migration lineage verification failed before commit.'), { code: 'snapshot_migration_state_invalid' });
      }
    },
  });
}
