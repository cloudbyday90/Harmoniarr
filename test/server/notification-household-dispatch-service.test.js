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
import { createNotificationDispatchCooldownService } from '../../src/server/notification/notification-dispatch-cooldown-service.js';
import { broadcastHouseholdNotification } from '../../src/server/notification/notification-household-dispatch-service.js';
import { buildDefaultNotificationPreferences } from '../../src/server/notification/notification-preference-constants.js';

const ALL_ENABLED = buildDefaultNotificationPreferences();

test('broadcastHouseholdNotification sends to all users with category enabled', async () => {
  const sent = [];
  const listAppUsers = async () => [
    { id: 'admin-1', role: 'admin' },
    { id: 'requester-1', role: 'requester' },
    { id: 'operator-1', role: 'operator' },
  ];
  const getUserPreferences = async () => ({ notificationPreferences: ALL_ENABLED });
  const sendNotificationToUser = async ({ userId, payload }) => {
    sent.push({ userId, payload });
    return { failed: 0, removed: 0, sent: 1 };
  };

  await broadcastHouseholdNotification({
    category: 'releaseAdded',
    getUserPreferences,
    listAppUsers,
    payload: { body: 'Added', title: 'Release added', url: '/app/activity/imports' },
    sendNotificationToUser,
  });

  assert.deepEqual(sent.map((entry) => entry.userId), ['admin-1', 'requester-1', 'operator-1']);
  assert.equal(sent[0].payload.title, 'Release added');
});

test('broadcastHouseholdNotification skips users with category disabled', async () => {
  const sent = [];
  const prefs = { ...ALL_ENABLED, releaseAdded: false };

  await broadcastHouseholdNotification({
    category: 'releaseAdded',
    getUserPreferences: async () => ({ notificationPreferences: prefs }),
    listAppUsers: async () => [{ id: 'user-1', role: 'requester' }],
    payload: { body: 'Added', title: 'Release added', url: '/app/activity/imports' },
    sendNotificationToUser: async ({ userId }) => {
      sent.push(userId);
      return { failed: 0, removed: 0, sent: 1 };
    },
  });

  assert.equal(sent.length, 0);
});

test('broadcastHouseholdNotification swallows listAppUsers errors', async () => {
  await broadcastHouseholdNotification({
    category: 'artistMonitored',
    getUserPreferences: async () => ({}),
    listAppUsers: async () => { throw new Error('db down'); },
    payload: { body: 'Artist monitored', title: 'Artist monitored', url: '/app/activity/releases' },
    sendNotificationToUser: async () => { throw new Error('should not be called'); },
  });
});

test('broadcastHouseholdNotification swallows per-user send failures', async () => {
  const sent = [];

  await broadcastHouseholdNotification({
    category: 'requestCreated',
    getUserPreferences: async () => ({ notificationPreferences: ALL_ENABLED }),
    listAppUsers: async () => [
      { id: 'user-1', role: 'requester' },
      { id: 'user-2', role: 'requester' },
    ],
    payload: { body: 'Request created', title: 'Music request created', url: '/app/activity/wanted' },
    sendNotificationToUser: async ({ userId }) => {
      if (userId === 'user-1') throw new Error('push failed');
      sent.push(userId);
      return { failed: 0, removed: 0, sent: 1 };
    },
  });

  assert.deepEqual(sent, ['user-2']);
});

test('broadcastHouseholdNotification handles empty user lists', async () => {
  const sent = [];

  await broadcastHouseholdNotification({
    category: 'downloadCompleted',
    getUserPreferences: async () => ({}),
    listAppUsers: async () => [],
    payload: { body: 'Done', title: 'Download completed', url: '/app/activity/imports' },
    sendNotificationToUser: async ({ userId }) => { sent.push(userId); },
  });

  assert.equal(sent.length, 0);
});

test('broadcastHouseholdNotification suppresses explicitly excluded user ids', async () => {
  const sent = [];

  await broadcastHouseholdNotification({
    category: 'artistMonitored',
    getUserPreferences: async () => ({ notificationPreferences: ALL_ENABLED }),
    listAppUsers: async () => [
      { id: 'user-1', role: 'requester' },
      { id: 'user-2', role: 'requester' },
    ],
    payload: { body: 'Artist monitored', title: 'Artist monitored', url: '/app/activity/releases' },
    sendNotificationToUser: async ({ userId }) => {
      sent.push(userId);
      return { failed: 0, removed: 0, sent: 1 };
    },
    suppressUserIds: ['user-1'],
  });

  assert.deepEqual(sent, ['user-2']);
});

test('broadcastHouseholdNotification respects per-user cooldowns', async () => {
  let now = new Date('2026-05-21T12:00:00.000Z');
  const sent = [];
  const dispatchCooldownService = createNotificationDispatchCooldownService({
    nowFn: () => now,
  });

  const baseOptions = {
    category: 'releaseAdded',
    cooldownKey: 'releaseAdded:Radiohead:OK Computer',
    cooldownMs: 60000,
    dispatchCooldownService,
    getUserPreferences: async () => ({ notificationPreferences: ALL_ENABLED }),
    listAppUsers: async () => [{ id: 'user-1', role: 'requester' }],
    payload: { body: 'Added', title: 'Release added', url: '/app/library' },
    sendNotificationToUser: async ({ userId }) => {
      sent.push(userId);
      return { failed: 0, removed: 0, sent: 1 };
    },
  };

  await broadcastHouseholdNotification(baseOptions);
  await broadcastHouseholdNotification(baseOptions);

  now = new Date('2026-05-21T12:01:01.000Z');
  await broadcastHouseholdNotification(baseOptions);

  assert.deepEqual(sent, ['user-1', 'user-1']);
});
