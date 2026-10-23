/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';

/** Serializes the cooperating producers that increase the open spectral backlog. */
export function createSourceUserSpectralAdmissionStore({ getPoolFn = getPool } = {}) {
  const withTransaction = createDatabaseTransactionRunner({ getPoolFn });

  async function withSpectralJobAdmission(work) {
    return withTransaction(async (queryable) => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      await queryable.query("SET LOCAL lock_timeout = '5s'");
      await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.source-user-spectral-admission', 0))");
      // A separate READ COMMITTED statement must see the preceding owner's commit.
      // Do not combine this lock and the capacity/dedup reads into one statement.
      return work(queryable);
    });
  }

  return { withSpectralJobAdmission };
}
