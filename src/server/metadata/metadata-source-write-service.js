/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createOperatorArtistSaveStateStore } from './operator-artist-save-state-store.js';
import { lockMetadataSourceWrite } from './metadata-source-lock-store.js';

/** Own or borrow an active transaction; exclusive admission must precede any shared/scoped work. */
export function createMetadataSourceWriteService({ getPoolFn = getPool } = {}) {
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });
  const scopeStore = createOperatorArtistSaveStateStore();

  function execute({ queryable = null, scope = null }, work) {
    const admitted = async client => {
      // PostgreSQL refuses this in autocommit, before any source mutation. The
      // ordinary DML table mode is compatible across admitted application writers.
      await client.query('LOCK TABLE metadata_artists IN ROW EXCLUSIVE MODE');
      if (scope) await scopeStore.lockOperatorArtistSave({ ...scope, client });
      else await lockMetadataSourceWrite({ queryable: client });
      return work(client);
    };
    return queryable ? admitted(queryable) : withTransaction(admitted);
  }

  return {
    withExclusiveWrite: (work, { queryable = null } = {}) => execute({ queryable }, work),
    withPolicyWrite: ({ appUserId, metadataArtistId, queryable = null }, work) => execute({ queryable, scope: { appUserId, metadataArtistId } }, work),
  };
}
