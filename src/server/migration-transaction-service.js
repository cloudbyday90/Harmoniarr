/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { beginMigrationReceipt, finishMigrationReceipt, recordFailedMigrationReceipt } from './migration-ledger-store.js';

function unknownCommit(cause) {
  return Object.assign(new Error('Migration commit outcome is unknown. Stop writers and inspect with npm run diagnose:migrations using an independent maintenance connection before retrying.', { cause }),
    { code: 'migration_commit_outcome_unknown' });
}

export function assertIdleMigrationClient(client, markClientUnusable) {
  if (client.getTransactionStatus?.() !== 'I') {
    markClientUnusable();
    throw Object.assign(new Error('Migration execution requires an idle owned PostgreSQL connection.'), { code: 'migration_connection_not_idle' });
  }
}

/** One client and one transaction own body DDL plus the applied receipt. Never retry here. */
export async function executeMigrationTransaction({ client, migration, sql, markClientUnusable }) {
  assertIdleMigrationClient(client, markClientUnusable);
  const startedAt = new Date();
  let begun = false, commitSent = false, rollbackAcknowledged = false;
  try {
    try {
      await client.query('BEGIN');
      if (client.getTransactionStatus() !== 'T') throw new Error('Migration transaction start was not acknowledged.');
      begun = true;
    }
    catch (error) { markClientUnusable(); throw error; }
    await client.query('SET LOCAL standard_conforming_strings = on');
    await client.query('SET LOCAL synchronous_commit = on');
    await beginMigrationReceipt(client, migration, startedAt);
    await client.query(sql);
    await finishMigrationReceipt(client, migration, startedAt);
    commitSent = true;
    const result = await client.query('COMMIT');
    if (result?.command === 'ROLLBACK' && client.getTransactionStatus() === 'I') {
      rollbackAcknowledged = true;
      throw Object.assign(new Error('Migration transaction was rolled back instead of committed.'), { code: 'migration_commit_rolled_back' });
    }
    if (result?.command !== 'COMMIT' || client.getTransactionStatus() !== 'I') throw new Error('Migration commit acknowledgement was not recognized.');
  } catch (failure) {
    if (commitSent && !rollbackAcknowledged) {
      markClientUnusable();
      throw unknownCommit(failure);
    }
    if (!begun) throw failure;
    if (!rollbackAcknowledged) {
      try {
        const result = await client.query('ROLLBACK');
        rollbackAcknowledged = result?.command === 'ROLLBACK' && client.getTransactionStatus() === 'I';
      } catch { /* A failed acknowledgement cannot authorize journal writes. */ }
    }
    if (rollbackAcknowledged) {
      try { await recordFailedMigrationReceipt(client, migration, startedAt, failure); }
      catch { markClientUnusable(); }
    } else markClientUnusable();
    throw failure;
  }
}
