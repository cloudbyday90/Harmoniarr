/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { after, before, suite, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { createMaintenanceLockService } from '../../src/server/recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';
import { createIntegrationAppRuntime } from '../../testing/integration/app-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { isSkippableIntegrationRuntimeError, toIntegrationRuntimeUnavailableReason } from '../../testing/integration/runtime-availability.js';

const config = resolveIntegrationTestRuntimeConfig();
let runtime;
let unavailableReason;

function settled(promise) {
  return promise.then((value) => ({ value }), (error) => ({ error }));
}

async function waitForBlockedLock(observer, pid, mode) {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const result = await observer.query(`SELECT 1 FROM pg_locks
      WHERE pid = $1 AND relation = 'maintenance_locks'::regclass AND mode = $2 AND NOT granted`, [pid, mode]);
    if (result.rowCount === 1) return;
    await setTimeout(10);
  }
  assert.fail(`Maintenance lock waiter did not appear for ${mode}`);
}

async function scenario(t, run) {
  if (unavailableReason) { t.skip(unavailableReason); return; }
  await runtime.runScenario(async ({ getPoolFn }) => {
    const pool = getPoolFn();
    await pool.query('CREATE TABLE integration_guarded_writes (id integer PRIMARY KEY)');
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      for (const client of [first, second]) {
        await client.query("SET statement_timeout = '5s'");
        await client.query("SET lock_timeout = '3s'");
        await client.query("SET idle_in_transaction_session_timeout = '10s'");
      }
      const maintenance = createMaintenanceLockService({ getPoolFn: () => second });
      const guard = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks: maintenance.listActiveMaintenanceLocks });
      await run({ first, second, maintenance, guard });
    } finally {
      // Rollback and discard both clients even if an assertion interrupts a blocked query.
      // Server-side timeouts bound the rollback queue behind any outstanding query.
      await Promise.allSettled([first.query('ROLLBACK'), second.query('ROLLBACK')]);
      first.release(true);
      second.release(true);
    }
  });
}

suite('transactional maintenance serialization', () => {
  before(async () => {
    try { runtime = await createIntegrationAppRuntime({ config }); }
    catch (error) {
      if (!isSkippableIntegrationRuntimeError(error)) throw error;
      unavailableReason = toIntegrationRuntimeUnavailableReason(error);
    }
  }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });

  test('guarded write commits before a later maintenance acquisition, including repeated guards', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async ({ first, second, maintenance, guard }) => {
    const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await first.query('BEGIN');
    await guard.assertNoActiveWriteLocks({ queryable: first });
    await guard.assertNoActiveWriteLocks({ queryable: first });
    await first.query('INSERT INTO integration_guarded_writes VALUES (1)');
    const acquiring = settled(maintenance.acquireMaintenanceLock({ lockType: 'restore' }));
    await waitForBlockedLock(first, pid, 'RowExclusiveLock');
    await first.query('COMMIT');
    const result = await acquiring;
    assert.equal(result.error, undefined);
    assert.equal(result.value.lockType, 'restore');
    assert.equal((await second.query('SELECT id FROM integration_guarded_writes')).rowCount, 1);
    await first.query('BEGIN');
    await assert.rejects(guard.assertNoActiveWriteLocks({ queryable: first }), { code: 'recovery_lock_conflict' });
    await first.query('ROLLBACK');
  }));

  test('an acquisition already in progress completes before the guarded check and rejects the write', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async ({ first, second, maintenance, guard }) => {
    const pid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await second.query('BEGIN');
    await maintenance.acquireMaintenanceLock({ lockType: 'restore' });
    await first.query('BEGIN');
    const writing = settled((async () => {
      await guard.assertNoActiveWriteLocks({ queryable: first });
      await first.query('INSERT INTO integration_guarded_writes VALUES (1)');
    })());
    await waitForBlockedLock(second, pid, 'ShareLock');
    await second.query('COMMIT');
    const result = await writing;
    assert.equal(result.error?.code, 'recovery_lock_conflict');
    await first.query('ROLLBACK');
    assert.equal((await second.query('SELECT id FROM integration_guarded_writes')).rowCount, 0);
  }));

  test('guarded transactions share the fence and an expired-lock update waits until rollback', {
    timeout: config.scenarioTimeoutMs,
  }, async (t) => scenario(t, async ({ first, second, maintenance, guard }) => {
    const expired = await maintenance.acquireMaintenanceLock({ lockType: 'restore', expiresAt: '2020-01-01T00:00:00Z' });
    await first.query('BEGIN');
    await second.query('BEGIN');
    await guard.assertNoActiveWriteLocks({ queryable: first });
    await guard.assertNoActiveWriteLocks({ queryable: second });
    await second.query('COMMIT');
    const pid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const renewing = settled(second.query('UPDATE maintenance_locks SET expires_at = NULL WHERE id = $1', [expired.id]));
    await waitForBlockedLock(first, pid, 'RowExclusiveLock');
    await first.query('ROLLBACK');
    assert.equal((await renewing).error, undefined);
    await first.query('BEGIN');
    await assert.rejects(guard.assertNoActiveWriteLocks({ queryable: first }), { code: 'recovery_lock_conflict' });
    await first.query('ROLLBACK');
  }));
});
