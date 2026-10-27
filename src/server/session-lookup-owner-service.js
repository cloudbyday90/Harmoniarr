/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from './database.js';
import { createApiError } from './api-error.js';
import { startDeadlineTask } from './deadline-task-service.js';
import { createDatabaseClientRetirement } from './database-client-retirement-service.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

export const sessionLookupTimeoutMs = 8_000;

/** Read authority on one checked-out client; never return an uncertain session to the pool. */
export function startSessionLookup(work, { getPoolFn = getPool, signal, timeoutMs = sessionLookupTimeoutMs,
  createRetirementFn = createDatabaseClientRetirement, errorCode = 'session_lookup_unavailable' } = {}) {
  const unavailable = cause => Object.assign(createApiError(503, errorCode, 'Session verification is temporarily unavailable. Try again.'), { cause });
  const task = startDeadlineTask(async scope => {
    scope.check();
    const client = await getPoolFn().connect();
    const retirement = createRetirementFn(client);
    let begun = false, discard = true, dead = false, closing;
    const disconnected = () => { dead = true; discard = true; };
    const cancel = () => {
      discard = true;
      closing ??= Promise.resolve().then(() => retirement.close({ force: true }));
      closing.catch(() => {});
    };
    client.on('error', disconnected); client.on('end', disconnected);
    scope.signal.addEventListener('abort', cancel, { once: true });
    if (scope.signal.aborted) cancel();
    return withWorkerTaskCleanup(async () => {
      scope.check();
      if (client.getTransactionStatus() !== 'I') throw unavailable();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
      if (dead || client.getTransactionStatus() !== 'T') throw unavailable();
      begun = true; discard = false;
      await client.query("SET LOCAL lock_timeout='1s'; SET LOCAL statement_timeout='3s'; SET LOCAL idle_in_transaction_session_timeout='3s'; SET LOCAL transaction_timeout='5s'");
      const result = await work(client);
      scope.check();
      if (dead || client.getTransactionStatus() !== 'T') { discard = true; throw unavailable(); }
      return result;
    }, () => withWorkerTaskCleanup(async () => {
      if (!begun || scope.signal.aborted) return;
      try {
        const result = await client.query('ROLLBACK');
        if (dead || result?.command !== 'ROLLBACK' || client.getTransactionStatus() !== 'I') throw unavailable();
      } catch (error) { discard = true; throw error; }
    }, async () => {
      let safeToDetach = false;
      try {
        if (discard || closing) { await (closing ?? retirement.close({ force: true })); safeToDetach = true; }
        client.release(discard || undefined);
        safeToDetach = true;
      } catch (error) { scope.markRetirementUncertain(); throw error; }
      finally {
        scope.signal.removeEventListener('abort', cancel);
        // A failed close keeps the checkout and its error handler until transport end.
        if (safeToDetach) { client.off('error', disconnected); client.off('end', disconnected); }
        else client.once('end', () => { client.off('error', disconnected); client.off('end', disconnected); });
      }
    }));
  }, { signal, timeoutMs, createTimeoutError: () => unavailable() });
  return { result: task.result.catch(cause => { if (cause?.code === errorCode) throw cause; throw unavailable(cause); }), drained: task.drained };
}
