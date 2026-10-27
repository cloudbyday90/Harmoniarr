/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createSchemaObservationConnection } from './schema-observation-connection-service.js';
import { startSchemaDiagnosticTask } from './schema-diagnostic-task-service.js';
import { ownsDatabasePreparationLock } from './database-preparation-lock-store.js';
import { trySchemaObservationLock } from './schema-observation-store.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

const failure = (code, message, cause) => Object.assign(new Error(message, { cause }), { code });
const unavailable = cause => failure('schema_observation_unavailable', 'Schema observation connection is unavailable; no diagnostic result was accepted.', cause);

/** Read-only observer of participating preparers. Always ROLLBACK; no repair or retry. */
export function withSchemaObservation({ createConnectionFn = createSchemaObservationConnection, scope, ...options } = {}, work) {
  if (!scope) return startSchemaDiagnosticTask(ownedScope => withSchemaObservation({ createConnectionFn, scope: ownedScope }, work), options).result;
  scope.check();
  return observe(createConnectionFn(), scope, work);
}

async function observe(connection, scope, work) {
  const { client } = connection;
  let begun = false, discard = true, dead = false;
  let cancellationCleanup;
  const cancel = () => {
    discard = true;
    // Observe cleanup rejection now, then await it during drainage. Never abandon it.
    cancellationCleanup ??= Promise.resolve().then(() => connection.close({ force: true }));
    cancellationCleanup.catch(() => {});
  };
  const disconnected = () => { dead = true; discard = true; };
  client.on?.('error', disconnected); client.on?.('end', disconnected);
  scope.signal.addEventListener('abort', cancel, { once: true });
  return withWorkerTaskCleanup(async () => {
    scope.check();
    await connection.connect();
    scope.check();
    if (client.getTransactionStatus?.() !== 'I') throw unavailable();
    if (await ownsDatabasePreparationLock(client) !== false) throw unavailable();
    if (dead || client.getTransactionStatus() !== 'I') throw unavailable();
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
    if (dead || client.getTransactionStatus() !== 'T') throw unavailable();
    begun = true; discard = false;
    await client.query("SET LOCAL lock_timeout='2s'");
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout='5s'");
    await client.query("SET LOCAL transaction_timeout='15s'");
    const locked = await trySchemaObservationLock(client);
    if (locked !== true) {
      if (locked !== false) throw unavailable();
      throw failure('schema_observation_busy', 'Database preparation is active. Retry schema diagnostics after it finishes.');
    }
    const result = await work(client);
    scope.check();
    if (dead || client.getTransactionStatus() !== 'T') { discard = true; throw unavailable(); }
    return result;
  }, () => withWorkerTaskCleanup(async () => {
    if (!begun || scope.signal.aborted) return;
    if (dead) throw unavailable();
    try {
      const result = await client.query('ROLLBACK');
      if (dead || result?.command !== 'ROLLBACK' || client.getTransactionStatus() !== 'I') throw unavailable();
    } catch (cause) { discard = true; throw unavailable(cause); }
  }, () => {
    return withWorkerTaskCleanup(async () => {
      try { await (cancellationCleanup ?? connection.close({ force: discard })); }
      catch (error) { scope.markRetirementUncertain(); throw error; }
    }, () => {
      scope.signal.removeEventListener('abort', cancel);
      client.off?.('error', disconnected); client.off?.('end', disconnected);
    });
  }));
}
