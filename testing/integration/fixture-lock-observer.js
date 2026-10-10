/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { setTimeout } from 'node:timers/promises';

const refusal = (code, message) => Object.assign(new Error(message), { code });

function assertSignal(signal) {
  if (signal != null && (typeof signal.aborted !== 'boolean' || typeof signal.addEventListener !== 'function'
    || typeof signal.removeEventListener !== 'function')) throw new TypeError('Lock observation requires a valid fixture signal');
}

/** Borrow only an otherwise idle client; stop admission before its owner can resume or roll back. */
export function createFixtureLockObserver({ queryable, signal } = {}) {
  assertSignal(signal);
  if (typeof queryable?.query !== 'function') throw new TypeError('Lock observation requires its owned queryable');
  let inFlight = null; let closed = false;
  function query(...args) {
    if (signal?.aborted) throw signal.reason;
    if (closed) throw refusal('fixture_observer_closed', 'The borrowed fixture observer is closed');
    if (inFlight) throw refusal('fixture_observer_busy', 'The borrowed fixture observer already has an active read');
    const operation = Promise.resolve(queryable.query(...args)); inFlight = operation;
    operation.then(() => { if (inFlight === operation) inFlight = null; }, () => { if (inFlight === operation) inFlight = null; });
    return operation;
  }
  async function drain() {
    closed = true;
    if (inFlight) await inFlight.then(() => undefined, () => undefined);
  }
  return { query, drain };
}

/** Monitoring cache is independent of READ COMMITTED; refresh before every activity read. */
export async function waitForFixturePostgresBlock({ queryable, holderPid, operation, signal } = {}) {
  assertSignal(signal);
  if (typeof queryable?.query !== 'function' || !Number.isSafeInteger(holderPid) || holderPid <= 0
    || !operation || typeof operation.then !== 'function') throw new TypeError('Lock observation requires a holder and observed work');
  let outcome;
  Promise.resolve(operation).then(() => { outcome = { completed: true }; }, (error) => { outcome = { error }; });
  const assertPending = () => {
    if (signal?.aborted) throw signal.reason;
    if (outcome && Object.hasOwn(outcome, 'error')) throw outcome.error;
    if (outcome?.completed) throw refusal('fixture_operation_completed_before_ready', 'Fixture operation completed before the required PostgreSQL lock wait');
  };
  for (let count = 0; count < 100; count += 1) {
    assertPending(); await queryable.query('SELECT pg_stat_clear_snapshot()'); assertPending();
    const result = await queryable.query(`SELECT pid FROM pg_stat_activity WHERE datname=current_database()
      AND $1::integer=ANY(pg_blocking_pids(pid))`, [holderPid]);
    assertPending(); if (result.rowCount) return;
    await setTimeout(10);
  }
  throw refusal('fixture_lock_wait_not_observed', 'Expected the actual PostgreSQL root/file lock wait');
}
