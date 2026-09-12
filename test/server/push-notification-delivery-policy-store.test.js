import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushNotificationDeliveryPolicyStore } from '../../src/server/push/push-notification-delivery-policy-store.js';

test('delivery account store uses a bounded identity lookup and preserves raw preference JSON', async () => {
  let row;
  const store = createPushNotificationDeliveryPolicyStore({ getPoolFn: () => ({
    query: async (sql, values) => {
      assert.match(sql, /^SELECT id, is_disabled, role, user_preferences FROM app_users WHERE id = \$1 LIMIT 1$/);
      assert.deepEqual(values, ['user-1']);
      return { rows: row ? [row] : [] };
    },
  }) });
  assert.equal(await store.getDeliveryAccount({ userId: 'user-1' }), null);
  for (const raw of [{}, null, [], false, 'private malformed value', { notificationPreferences: { releaseAdded: false } }]) {
    row = { id: 'user-1', is_disabled: false, role: 'requester', user_preferences: raw };
    const result = await store.getDeliveryAccount({ userId: 'user-1' });
    assert.deepEqual(result, { id: 'user-1', isDisabled: false, role: 'requester', userPreferences: raw });
    assert.equal(result.userPreferences, raw);
  }
});

test('delivery account store leaves database failure classification to its service', async () => {
  const failure = new Error('private connection details');
  const store = createPushNotificationDeliveryPolicyStore({ getPoolFn: () => ({ query: async () => { throw failure; } }) });
  await assert.rejects(store.getDeliveryAccount({ userId: 'user-1' }), (error) => error === failure);
});
