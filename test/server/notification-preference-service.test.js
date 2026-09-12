/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getNotificationPreferenceDecision, shouldSendNotification } from '../../src/server/notification/notification-preference-service.js';
import { buildDefaultNotificationPreferences } from '../../src/server/notification/notification-preference-constants.js';

const ALL_ENABLED = buildDefaultNotificationPreferences();

test('shouldSendNotification returns true when category is enabled', async () => {
  const result = await shouldSendNotification({
    category: 'requestFulfilled',
    getUserPreferences: async () => ({ notificationPreferences: ALL_ENABLED }),
    userId: 'user-1',
  });
  assert.equal(result, true);
});

test('shouldSendNotification returns false when category is disabled', async () => {
  const prefs = { ...ALL_ENABLED, requestFulfilled: false };
  const result = await shouldSendNotification({
    category: 'requestFulfilled',
    getUserPreferences: async () => ({ notificationPreferences: prefs }),
    userId: 'user-1',
  });
  assert.equal(result, false);
});

test('shouldSendNotification returns false for unknown category', async () => {
  const result = await shouldSendNotification({
    category: 'nonexistent',
    getUserPreferences: async () => ({ notificationPreferences: ALL_ENABLED }),
    userId: 'user-1',
  });
  assert.equal(result, false);
});

test('shouldSendNotification returns false when getUserPreferences throws', async () => {
  const result = await shouldSendNotification({
    category: 'requestFulfilled',
    getUserPreferences: async () => { throw new Error('db down'); },
    userId: 'user-1',
  });
  assert.equal(result, false);
});

test('shouldSendNotification defaults to true when notificationPreferences is missing', async () => {
  const result = await shouldSendNotification({
    category: 'downloadCompleted',
    getUserPreferences: async () => ({ preferredFormat: 'flac' }),
    userId: 'user-1',
  });
  assert.equal(result, true);
});

test('shouldSendNotification defaults to true when a specific category key is missing', async () => {
  const partial = { requestFulfilled: true };
  const result = await shouldSendNotification({
    category: 'downloadCompleted',
    getUserPreferences: async () => ({ notificationPreferences: partial }),
    userId: 'user-1',
  });
  assert.equal(result, true);
});

test('shouldSendNotification checks trustOverride for admin category', async () => {
  const prefs = { ...ALL_ENABLED, trustOverride: false };
  const result = await shouldSendNotification({
    category: 'trustOverride',
    getUserPreferences: async () => ({ notificationPreferences: prefs }),
    userId: 'admin-1',
  });
  assert.equal(result, false);
});


for (const [label, preferences] of [
  ['null', null], ['undefined', undefined], ['array', []], ['string', 'enabled'],
  ['number', 1], ['boolean', true], ['function', () => ({})], ['Date', new Date(0)],
]) {
  test(`notification preference decision fails closed for a malformed ${label} read`, async () => {
    const options = { category: 'artistMonitored', userId: 'user-1', getUserPreferences: async () => preferences };
    assert.deepEqual(await getNotificationPreferenceDecision(options), { allowed: false, failed: true });
    assert.equal(await shouldSendNotification(options), false);
  });
}

test('notification preference decision contains read errors and distinguishes them from disabled categories', async (t) => {
  const getUserPreferences = t.mock.fn(async ({ userId }) => {
    assert.equal(userId, 'user-1');
    throw new Error('private credential and preference data');
  });
  assert.deepEqual(await getNotificationPreferenceDecision({ category: 'artistMonitored', userId: 'user-1', getUserPreferences }),
    { allowed: false, failed: true });
  assert.equal(getUserPreferences.mock.callCount(), 1);
  assert.deepEqual(await getNotificationPreferenceDecision({ category: 'artistMonitored', userId: 'user-1',
    getUserPreferences: async () => ({ notificationPreferences: { artistMonitored: false } }),
  }), { allowed: false, failed: false });
  getUserPreferences.mock.resetCalls();
  assert.deepEqual(await getNotificationPreferenceDecision({ category: 'unknown', userId: 'user-1', getUserPreferences }),
    { allowed: false, failed: false });
  assert.equal(getUserPreferences.mock.callCount(), 0);
});

test('notification preference decision preserves enabled defaults after a valid preference read', async () => {
  for (const preferences of [{}, Object.create(null), { notificationPreferences: Object.create(null) }, { notificationPreferences: {} }, { notificationPreferences: { artistMonitored: true } }]) {
    assert.deepEqual(await getNotificationPreferenceDecision({ category: 'artistMonitored', userId: 'user-1',
      getUserPreferences: async () => preferences,
    }), { allowed: true, failed: false });
  }
});


for (const [label, notificationPreferences] of [
  ['null category map', null], ['array category map', []], ['Date category map', new Date(0)], ['string category map', 'enabled'],
  ['number category map', 1], ['boolean category map', true],
  ['null category value', { artistMonitored: null }], ['string category value', { artistMonitored: 'false' }],
  ['numeric category value', { artistMonitored: 1 }], ['object category value', { artistMonitored: {} }],
]) {
  test(`notification preference decision rejects a malformed ${label} instead of restoring enabled defaults`, async () => {
    const input = { category: 'artistMonitored', userId: 'user-1',
      getUserPreferences: async () => ({ notificationPreferences }),
    };
    assert.deepEqual(await getNotificationPreferenceDecision(input), { allowed: false, failed: true });
    assert.equal(await shouldSendNotification(input), false);
  });
}
