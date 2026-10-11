/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Own one pool generation until its native shutdown has successfully settled. */
export function createDatabasePoolLifecycle({ createPool } = {}) {
  if (typeof createPool !== 'function') {
    throw new TypeError('createPool is required');
  }

  let pool;
  let runtimeState;
  let closing;

  function getPool() {
    if (closing) {
      throw Object.assign(new Error('Database pool is unavailable during shutdown'), {
        code: 'database_pool_closing',
      });
    }
    if (!pool) {
      const nextState = { closing: false };
      pool = createPool({ runtimeState: nextState });
      runtimeState = nextState;
    }
    return pool;
  }

  function closePool() {
    if (closing) return closing;
    if (!pool) return Promise.resolve();

    // Publish the fence and promise before invoking end, including reentrant calls.
    const completion = Promise.withResolvers();
    closing = completion.promise;
    runtimeState.closing = true;
    try {
      Promise.resolve(pool.end()).then(() => {
        pool = undefined;
        runtimeState = undefined;
        closing = undefined;
        completion.resolve();
      }, completion.reject);
    } catch (error) {
      completion.reject(error);
    }
    // Failed end keeps this generation unavailable and preserves its exact failure.
    return completion.promise;
  }

  return { getPool, closePool };
}
