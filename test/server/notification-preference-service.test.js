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
import { shouldSendNotification } from '../../src/server/notification/notification-preference-service.js';
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

test('shouldSendNotification returns true (fail-open) when getUserPreferences throws', async () => {
  const result = await shouldSendNotification({
    category: 'requestFulfilled',
    getUserPreferences: async () => { throw new Error('db down'); },
    userId: 'user-1',
  });
  assert.equal(result, true);
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
