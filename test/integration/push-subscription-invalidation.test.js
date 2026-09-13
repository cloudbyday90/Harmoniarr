/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushSubscriptionKeys } from '../../testing/push-subscription-fixtures.js';

const subscriptionKeys = createPushSubscriptionKeys();
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { createPushNotificationService } from '../../src/server/push/push-notification-service.js';
import { createPushSubscriptionStore } from '../../src/server/push/push-subscription-store.js';
import { applyPendingMigrations } from '../../src/server/migrations.js';
import { withDockerizedPostgresDatabase } from '../../testing/postgres-docker-database.js';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

const identity = ({ id, userId, endpoint, registrationToken }) => ({ id, userId, endpoint, registrationToken });

test('PostgreSQL registration tokens protect refreshed subscriptions from delayed expired responses', { timeout: 90_000 }, async () => {
  await withDockerizedPostgresDatabase({ run: async ({ getPoolFn }) => {
    await applyPendingMigrations({ getPoolFn });
    const pool = getPoolFn();
    const users = (await pool.query(`INSERT INTO app_users (username, password_hash, role)
      VALUES ('registration-owner', 'test-only', 'requester'), ('registration-other', 'test-only', 'requester') RETURNING id`)).rows;
    const [owner, other] = users.map(({ id }) => id);
    const store = createPushSubscriptionStore({ getPoolFn });
    const register = (endpoint, overrides = {}) => store.upsertSubscription({
      userId: owner, endpoint, ...subscriptionKeys, ...overrides,
    });

    for (const scenario of ['identical', 'keys', 'owner', 'recreated', 'matching']) {
      const endpoint = `https://push.example.com/registration-${scenario}`;
      const original = await register(endpoint);
      assert.equal(typeof original.registrationToken, 'string');
      const originalIdentity = identity(original);
      const entered = deferred();
      const response = deferred();
      const cleanup = deferred();
      const cleanupArguments = [];
      const service = createPushNotificationService({
        vapidKeys: { publicKey: 'test-public', privateKey: 'test-private' },
        vapidContact: 'mailto:test@example.test',
        webPushLib: { setVapidDetails() {}, generateRequestDetails: () => ({}) },
        pushHttpTransport: { sendRequest: async () => { entered.resolve(); return response.promise; } },
        pushSubscriptionStore: {
          invalidateSubscriptionRegistration: async (input) => {
            cleanupArguments.push(input);
            try {
              const result = await store.invalidateSubscriptionRegistration(input);
              cleanup.resolve(result);
              return result;
            } catch (error) { cleanup.reject(error); throw error; }
          },
          deleteSubscriptionByEndpoint: () => assert.fail('Expired responses must not invalidate by endpoint alone'),
        },
        stderr: { write: () => {} },
      });
      const sending = service.sendNotificationToSubscription({ subscription: original, payload: { title: 'Original registration' } });
      await entered.promise;
      let refreshed;
      try {
        if (scenario === 'recreated') await store.deleteSubscription(owner, endpoint);
        refreshed = scenario === 'matching' ? original : await register(endpoint, scenario === 'keys'
          ? { p256dh: 'rotated-public-key', auth: 'rotated-auth' }
          : scenario === 'owner' ? { userId: other } : {});
        if (scenario !== 'matching') assert.notEqual(refreshed.registrationToken, original.registrationToken);
        if (scenario === 'recreated') assert.notEqual(refreshed.id, original.id);
        else assert.equal(refreshed.id, original.id);
        // A caller retaining this object must not redirect cleanup to a newer registration.
        Object.assign(original, refreshed);
      } finally { response.resolve({ statusCode: scenario === 'matching' ? 404 : 410, headers: {} }); }
      assert.equal((await sending).status, 'expired');
      assert.equal(await cleanup.promise, scenario === 'matching');
      assert.deepEqual(cleanupArguments, [originalIdentity]);
      assert.deepEqual(await store.getSubscriptionById(refreshed.id), scenario === 'matching' ? null : refreshed);
    }

    // Hold the actual upsert uncommitted so old cleanup must reconsider its predicate after waiting.
    const contested = await register('https://push.example.com/registration-concurrent');
    const refreshingClient = await pool.connect();
    let cleanupClient;
    let completion;
    try {
      cleanupClient = await pool.connect();
      await cleanupClient.query("SET statement_timeout = '8s'");
      const pid = (await cleanupClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await refreshingClient.query('BEGIN');
      const refreshingStore = createPushSubscriptionStore({ getPoolFn: () => refreshingClient });
      const refreshed = await refreshingStore.upsertSubscription({ userId: owner, endpoint: contested.endpoint,
        p256dh: contested.p256dh, auth: contested.auth });
      assert.notEqual(refreshed.registrationToken, contested.registrationToken);
      const waitingStore = createPushSubscriptionStore({ getPoolFn: () => cleanupClient });
      completion = waitingStore.invalidateSubscriptionRegistration(identity(contested))
        .then((value) => ({ value }), (error) => ({ error }));
      const deadline = Date.now() + 6000;
      let observedWait = false;
      while (Date.now() < deadline) {
        const row = (await pool.query("SELECT wait_event_type = 'Lock' AS waiting FROM pg_stat_activity WHERE pid = $1", [pid])).rows[0];
        if (row?.waiting) { observedWait = true; break; }
        await setImmediate();
      }
      assert.equal(observedWait, true, 'Cleanup must actually wait on the uncommitted registration update');
      await refreshingClient.query('COMMIT');
      assert.deepEqual(await completion, { value: false });
      assert.deepEqual(await store.getSubscriptionById(contested.id), refreshed);
    } finally {
      try { await refreshingClient.query('ROLLBACK'); }
      finally {
        if (completion) await completion;
        refreshingClient.release();
        cleanupClient?.release(true);
      }
    }

    const endpoint = 'https://push.example.com/registration-matches';
    const original = await register(endpoint);
    const originalIdentity = identity(original);
    for (const mismatch of [
      { id: randomUUID() }, { userId: other }, { endpoint: `${endpoint}-different` },
      { registrationToken: randomUUID() }, { registrationToken: null },
    ]) {
      assert.equal(await store.invalidateSubscriptionRegistration({ ...originalIdentity, ...mismatch }), false);
      assert.notEqual(await store.getSubscriptionById(original.id), null);
    }
    assert.equal(await store.invalidateSubscriptionRegistration(originalIdentity), true);
    assert.equal(await store.invalidateSubscriptionRegistration(originalIdentity), false);
    assert.equal(await store.getSubscriptionById(original.id), null);
    // Opposite ordering: cleanup wins first, then registration restores an active row with a new token.
    const restored = await register(endpoint);
    assert.equal(restored.id, original.id);
    assert.notEqual(restored.registrationToken, original.registrationToken);
    assert.deepEqual(await store.getSubscriptionById(restored.id), restored);
    assert.equal(await store.invalidateSubscriptionRegistration(originalIdentity), false);
    assert.equal(await store.invalidateSubscriptionRegistration(identity(restored)), true);
  } });
});
