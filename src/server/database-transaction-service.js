/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from './database.js';

export function createDatabaseTransactionRunner({ getPoolFn = getPool } = {}) {
  return async function withTransaction(work) {
    const client = await getPoolFn().connect();
    let releaseError;
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Preserve the operation failure and evict a client with unknown state.
        releaseError = rollbackError;
      }
      throw error;
    } finally {
      client.release(releaseError);
    }
  };
}
