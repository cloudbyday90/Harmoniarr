/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { ownsDatabasePreparationLock, tryDatabasePreparationLock, unlockDatabasePreparation } from './database-preparation-lock-store.js';
import { assertIdleMigrationClient } from './migration-transaction-service.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

const activePreparations = new WeakMap();
const failure = (code, message, cause) => Object.assign(new Error(message, { cause }), { code });
const unavailable = () => failure('database_preparation_connection_unavailable', 'Database preparation connection is unavailable. Stop and inspect migration status before retrying.');

/** Reuse only a live owner; never acquire this session lock recursively. */
export async function withDatabasePreparation({ getPoolFn = getPool, preparation } = {}, work) {
  if (preparation !== undefined) {
    const state = activePreparations.get(preparation);
    if (!state) throw new TypeError('Database preparation requires an active owned scope.');
    if (state.unusable) throw unavailable();
    assertIdleMigrationClient(preparation.client, preparation.markClientUnusable);
    return work(preparation);
  }

  const client = await getPoolFn().connect();
  const state = { unusable: true };
  let acquired = false;
  const markClientUnusable = () => { state.unusable = true; };
  const context = Object.freeze({ client, markClientUnusable });
  client.on?.('error', markClientUnusable);
  client.on?.('end', markClientUnusable);
  return withWorkerTaskCleanup(async () => {
    assertIdleMigrationClient(client, markClientUnusable);
    // PostgreSQL session locks are reentrant. Refuse inherited ownership rather
    // than incrementing an unknown acquisition count on a recycled connection.
    if (await ownsDatabasePreparationLock(client) !== false) {
      throw failure('database_preparation_lock_inherited', 'Database preparation connection has inherited or unrecognized lock ownership. Connection discarded.');
    }
    const locked = await tryDatabasePreparationLock(client);
    if (typeof locked !== 'boolean') throw failure('database_preparation_lock_unknown', 'Database preparation lock acquisition was not acknowledged. Connection discarded.');
    assertIdleMigrationClient(client, markClientUnusable);
    acquired = locked;
    state.unusable = false;
    if (!acquired) throw failure('database_preparation_busy', 'Another database preparer is active. No preparation work started. Retry after that preparer finishes.');
    activePreparations.set(context, state);
    const result = await work(context);
    if (state.unusable) throw unavailable();
    assertIdleMigrationClient(client, markClientUnusable);
    return result;
  }, async () => {
    activePreparations.delete(context);
    await withWorkerTaskCleanup(async () => {
      if (!acquired || state.unusable) return;
      try {
        assertIdleMigrationClient(client, markClientUnusable);
        if (await unlockDatabasePreparation(client) !== true) throw new Error('Unlock was not acknowledged.');
        assertIdleMigrationClient(client, markClientUnusable);
      } catch (cause) {
        markClientUnusable();
        throw failure('database_preparation_unlock_unknown', 'Database preparation lock release is unconfirmed. Connection discarded; inspect migration status before any retry.', cause);
      }
    }, () => {
      client.off?.('error', markClientUnusable);
      client.off?.('end', markClientUnusable);
      return state.unusable ? client.release(true) : client.release();
    });
  });
}
