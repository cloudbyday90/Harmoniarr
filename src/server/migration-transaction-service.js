/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { beginMigrationReceipt, finishMigrationReceipt, recordFailedMigrationReceipt } from './migration-ledger-store.js';
import { assertIdleOwnedSqlClient as assertIdleMigrationClient, executeOwnedSqlTransaction } from './owned-sql-transaction-service.js';
export { assertIdleMigrationClient };

/** Keep per-migration receipt policy separate from the shared transaction protocol. */
export async function executeMigrationTransaction({ client, migration, sql, markClientUnusable }) {
  const startedAt = new Date();
  return executeOwnedSqlTransaction({ client, markClientUnusable,
    unknownCommitErrorFn: cause => Object.assign(new Error('Migration commit outcome is unknown. Stop writers and inspect with npm run diagnose:migrations using an independent maintenance connection before retrying.', { cause }),
      { code: 'migration_commit_outcome_unknown' }),
    commitRolledBackErrorFn: () => Object.assign(new Error('Migration transaction was rolled back instead of committed.'), { code: 'migration_commit_rolled_back' }),
    onRolledBack: failure => recordFailedMigrationReceipt(client, migration, startedAt, failure),
    work: async () => {
      await beginMigrationReceipt(client, migration, startedAt);
      await client.query(sql);
      await finishMigrationReceipt(client, migration, startedAt);
    },
  });
}
