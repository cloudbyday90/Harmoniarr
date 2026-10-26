/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function assertIdleOwnedSqlClient(client, markClientUnusable) {
  if (client.getTransactionStatus?.() !== 'I') {
    markClientUnusable();
    throw Object.assign(new Error('Execution requires an idle owned PostgreSQL connection.'), { code: 'migration_connection_not_idle' });
  }
}

/** One client owns BEGIN through acknowledged completion. Never retry ambiguous COMMIT. */
export async function executeOwnedSqlTransaction({ client, markClientUnusable, work, onRolledBack,
  unknownCommitErrorFn, commitRolledBackErrorFn }) {
  assertIdleOwnedSqlClient(client, markClientUnusable);
  let begun = false, commitSent = false, rollbackAcknowledged = false;
  try {
    try {
      await client.query('BEGIN');
      if (client.getTransactionStatus() !== 'T') throw new Error('Transaction start was not acknowledged.');
      begun = true;
    } catch (error) { markClientUnusable(); throw error; }
    await client.query('SET LOCAL standard_conforming_strings = on');
    await client.query('SET LOCAL synchronous_commit = on');
    const value = await work();
    commitSent = true;
    const result = await client.query('COMMIT');
    if (result?.command === 'ROLLBACK' && client.getTransactionStatus() === 'I') {
      rollbackAcknowledged = true;
      throw commitRolledBackErrorFn();
    }
    if (result?.command !== 'COMMIT' || client.getTransactionStatus() !== 'I') throw new Error('Commit acknowledgement was not recognized.');
    return value;
  } catch (failure) {
    if (commitSent && !rollbackAcknowledged) {
      markClientUnusable(); throw unknownCommitErrorFn(failure);
    }
    if (!begun) throw failure;
    if (!rollbackAcknowledged) {
      try {
        const result = await client.query('ROLLBACK');
        rollbackAcknowledged = result?.command === 'ROLLBACK' && client.getTransactionStatus() === 'I';
      } catch { /* An unacknowledged rollback cannot authorize subsequent writes. */ }
    }
    if (!rollbackAcknowledged) markClientUnusable();
    else if (onRolledBack) {
      try { await onRolledBack(failure); }
      catch { markClientUnusable(); }
    }
    throw failure;
  }
}
