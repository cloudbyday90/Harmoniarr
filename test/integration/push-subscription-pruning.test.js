/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createPushSubscriptionStore } from '../../src/server/push/push-subscription-store.js';
import { createPushSubscriptionPruningStore } from '../../src/server/push/push-subscription-pruning-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function waitForLock(pool, pid) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if ((await pool.query("SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1", [pid])).rows[0]?.waiting) return;
    await setImmediate();
  }
  assert.fail('Expected database lock wait was not observed');
}

test('PostgreSQL pruning preserves every queue reference and serializes registration and child-insert races', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const userId = (await pool.query("INSERT INTO app_users (username, password_hash, role) VALUES ('pruning-owner', 'test-only', 'requester') RETURNING id")).rows[0].id;
    const subscriptions = createPushSubscriptionStore({ getPoolFn });
    const pruning = createPushSubscriptionPruningStore({ getPoolFn });
    let sequence = 0;
    const register = (store, endpoint) => store.upsertSubscription({ userId, endpoint, p256dh: 'synthetic-key', auth: 'synthetic-auth' });
    async function oldSubscription() {
      const row = await register(subscriptions, `https://push-fixture.example.com/prune-${++sequence}`);
      await pool.query("UPDATE user_push_subscriptions SET invalidated_at = clock_timestamp() - INTERVAL '31 days' WHERE id = $1", [row.id]);
      return row;
    }
    const exists = async (id) => (await pool.query('SELECT id FROM user_push_subscriptions WHERE id = $1', [id])).rows.length === 1;
    const insertReference = (client, subscriptionId, status = 'pending') => client.query(`INSERT INTO notification_queue
      (user_id, subscription_id, event_type, payload, ttl_seconds, status, expires_at, terminal_at)
      VALUES ($1, $2, 'releaseAdded', '{}', 120, $3, clock_timestamp() + INTERVAL '120 seconds',
        CASE WHEN $3 = 'pending' THEN NULL ELSE clock_timestamp() END) RETURNING id`, [userId, subscriptionId, status]);

    const referenced = [];
    for (const status of ['pending', 'sent', 'failed', 'expired']) {
      const row = await oldSubscription();
      await insertReference(pool, row.id, status);
      referenced.push(row.id);
    }
    const active = await register(subscriptions, 'https://push-fixture.example.com/active');
    const recent = await oldSubscription();
    await pool.query('UPDATE user_push_subscriptions SET invalidated_at = clock_timestamp() WHERE id = $1', [recent.id]);
    for (let index = 0; index < 5; index++) await oldSubscription();
    for (const deletedCount of [2, 2, 1, 0]) assert.deepEqual(await pruning.pruneInvalidatedSubscriptions({ limit: 2 }), { deletedCount });
    for (const id of [...referenced, active.id, recent.id]) assert.equal(await exists(id), true);

    // A refresh already holding the parent row causes SKIP LOCKED, then preserves the active registration.
    const refreshing = await oldSubscription();
    const registrationClient = await pool.connect();
    try {
      await registrationClient.query('BEGIN');
      const refreshed = await register(createPushSubscriptionStore({ getPoolFn: () => registrationClient }), refreshing.endpoint);
      assert.deepEqual(await pruning.pruneInvalidatedSubscriptions({ limit: 500 }), { deletedCount: 0 });
      await registrationClient.query('COMMIT');
      assert.deepEqual(await subscriptions.getSubscriptionById(refreshed.id), refreshed);
    } finally { await registrationClient.query('ROLLBACK'); registrationClient.release(); }

    // Instrument only the selection predicate: block before FOR UPDATE, after its statement snapshot starts.
    // A child commits while selection is blocked; the separate DELETE must use a fresh snapshot.
    const raced = await oldSubscription();
    const controller = await pool.connect();
    const candidateClient = await pool.connect();
    const advisoryKey = 729104;
    let selecting;
    let admitted = false;
    try {
      await controller.query('SELECT pg_advisory_lock($1)', [advisoryKey]);
      await candidateClient.query("SET statement_timeout = '8s'");
      await candidateClient.query("SET default_transaction_isolation = 'repeatable read'");
      await candidateClient.query(`CREATE FUNCTION pg_temp.pruning_test_barrier() RETURNS boolean LANGUAGE plpgsql AS $$
        BEGIN PERFORM pg_advisory_xact_lock(${advisoryKey}); RETURN true; END $$`);
      const pid = (await candidateClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const racing = createPushSubscriptionPruningStore({ getPoolFn: () => ({ connect: async () => ({
        query: async (sql, values) => {
          const isSelection = sql.includes('FOR UPDATE');
          const instrumented = isSelection ? sql.replace(/ORDER BY/, 'AND pg_temp.pruning_test_barrier() ORDER BY') : sql;
          const result = await candidateClient.query(instrumented, values);
          if (/^BEGIN/.test(sql)) {
            assert.equal((await candidateClient.query('SHOW transaction_isolation')).rows[0].transaction_isolation, 'read committed');
          }
          if (isSelection) admitted = result.rows.some((row) => row.id === raced.id);
          return result;
        }, release() {},
      }) }) });
      selecting = racing.pruneInvalidatedSubscriptions({ limit: 500 }).then((value) => ({ value }), (error) => ({ error }));
      await waitForLock(pool, pid);
      const child = (await insertReference(pool, raced.id)).rows[0].id;
      await controller.query('SELECT pg_advisory_unlock($1)', [advisoryKey]);
      assert.deepEqual(await selecting, { value: { deletedCount: 0 } });
      assert.equal(admitted, true, 'The original selection snapshot must actually admit the newly referenced parent');
      assert.equal(await exists(raced.id), true);
      assert.equal((await pool.query('SELECT id FROM notification_queue WHERE id = $1', [child])).rows.length, 1);
    } finally {
      await controller.query('SELECT pg_advisory_unlock($1)', [advisoryKey]);
      if (selecting) await selecting;
      controller.release(); candidateClient.release(true);
    }

    // Hold a completed DELETE before COMMIT to exercise both prune-first writer orderings.
    for (const operation of ['child insert', 'registration']) {
      const row = await oldSubscription();
      const deleted = deferred();
      const permitCommit = deferred();
      const pruningClient = await pool.connect();
      const writer = await pool.connect();
      let pruningWork;
      let writing;
      try {
        await writer.query("SET statement_timeout = '8s'");
        const pid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const heldPruning = createPushSubscriptionPruningStore({ getPoolFn: () => ({ connect: async () => ({
          query: async (sql, values) => {
            if (sql === 'COMMIT') { deleted.resolve(); await permitCommit.promise; }
            return pruningClient.query(sql, values);
          }, release() {},
        }) }) });
        pruningWork = heldPruning.pruneInvalidatedSubscriptions({ limit: 500 }).then((value) => ({ value }), (error) => ({ error }));
        await deleted.promise;
        writing = (operation === 'child insert' ? insertReference(writer, row.id)
          : register(createPushSubscriptionStore({ getPoolFn: () => writer }), row.endpoint))
          .then((value) => ({ value }), (error) => ({ error }));
        await waitForLock(pool, pid);
        permitCommit.resolve();
        assert.deepEqual(await pruningWork, { value: { deletedCount: 1 } });
        const result = await writing;
        if (operation === 'child insert') assert.equal(result.error?.code, '23503', 'No child can commit a reference to a deleted parent');
        else {
          assert.ok(result.value);
          assert.notEqual(result.value.id, row.id);
          assert.equal(await exists(result.value.id), true);
        }
      } finally {
        permitCommit.resolve();
        if (pruningWork) await pruningWork;
        if (writing) await writing;
        pruningClient.release(true); writer.release(true);
      }
    }

    const rolledBack = await oldSubscription();
    let failureInjected = false;
    const rollbackStore = createPushSubscriptionPruningStore({ getPoolFn: () => ({ connect: async () => {
      const client = await pool.connect();
      return { query: async (sql, values) => {
        const result = await client.query(sql, values);
        if (/DELETE FROM/.test(sql)) { failureInjected = true; throw new Error('Injected failure after uncommitted deletion'); }
        return result;
      }, release: () => client.release() };
    } }) });
    await assert.rejects(rollbackStore.pruneInvalidatedSubscriptions({ limit: 500 }), { message: 'Invalidated subscription pruning failed' });
    assert.equal(failureInjected, true);
    assert.equal(await exists(rolledBack.id), true);
    assert.deepEqual(await pruning.pruneInvalidatedSubscriptions({ limit: 500 }), { deletedCount: 1 });
  } });
});
