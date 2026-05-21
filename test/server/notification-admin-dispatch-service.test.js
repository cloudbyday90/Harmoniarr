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
import { broadcastAdminNotification } from '../../src/server/notification/notification-admin-dispatch-service.js';
import { buildDefaultNotificationPreferences } from '../../src/server/notification/notification-preference-constants.js';

const ALL_ENABLED = buildDefaultNotificationPreferences();

test('broadcastAdminNotification sends to admins with category enabled', async () => {
  const sent = [];
  const listAppUsers = async () => [
    { id: 'admin-1', role: 'admin' },
    { id: 'admin-2', role: 'admin' },
    { id: 'requester-1', role: 'requester' },
  ];
  const getUserPreferences = async () => ({ notificationPreferences: ALL_ENABLED });
  const sendNotificationToUser = async ({ userId, payload }) => {
    sent.push({ userId, payload });
    return { sent: 1, failed: 0, removed: 0 };
  };

  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 'Trust override', body: 'Changed to trusted', url: '/app/activity/source-users' },
    listAppUsers,
    getUserPreferences,
    sendNotificationToUser,
  });

  assert.equal(sent.length, 2);
  assert.equal(sent[0].userId, 'admin-1');
  assert.equal(sent[1].userId, 'admin-2');
  assert.equal(sent[0].payload.title, 'Trust override');
});

test('broadcastAdminNotification skips admins with category disabled', async () => {
  const sent = [];
  const prefs = { ...ALL_ENABLED, trustOverride: false };
  const listAppUsers = async () => [
    { id: 'admin-1', role: 'admin' },
  ];
  const getUserPreferences = async () => ({ notificationPreferences: prefs });
  const sendNotificationToUser = async ({ userId }) => {
    sent.push(userId);
    return { sent: 1, failed: 0, removed: 0 };
  };

  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 'Trust override', body: 'test', url: '/app/activity/source-users' },
    listAppUsers,
    getUserPreferences,
    sendNotificationToUser,
  });

  assert.equal(sent.length, 0);
});

test('broadcastAdminNotification does not send to non-admin users', async () => {
  const sent = [];
  const listAppUsers = async () => [
    { id: 'requester-1', role: 'requester' },
    { id: 'operator-1', role: 'operator' },
  ];
  const getUserPreferences = async () => ({ notificationPreferences: ALL_ENABLED });
  const sendNotificationToUser = async ({ userId }) => {
    sent.push(userId);
    return { sent: 1, failed: 0, removed: 0 };
  };

  await broadcastAdminNotification({
    category: 'blocklistEvent',
    payload: { title: 'Blocked', body: 'test', url: '/app/activity/source-users' },
    listAppUsers,
    getUserPreferences,
    sendNotificationToUser,
  });

  assert.equal(sent.length, 0);
});

test('broadcastAdminNotification swallows listAppUsers errors', async () => {
  const listAppUsers = async () => { throw new Error('db down'); };
  const sendNotificationToUser = async () => { throw new Error('should not be called'); };

  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 't', body: 'b', url: '/app' },
    listAppUsers,
    getUserPreferences: async () => ({}),
    sendNotificationToUser,
  });
});

test('broadcastAdminNotification swallows per-user send failures', async () => {
  const sent = [];
  const listAppUsers = async () => [
    { id: 'admin-1', role: 'admin' },
    { id: 'admin-2', role: 'admin' },
  ];
  const getUserPreferences = async () => ({ notificationPreferences: ALL_ENABLED });
  const sendNotificationToUser = async ({ userId }) => {
    if (userId === 'admin-1') throw new Error('push failed');
    sent.push(userId);
    return { sent: 1, failed: 0, removed: 0 };
  };

  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 't', body: 'b', url: '/app' },
    listAppUsers,
    getUserPreferences,
    sendNotificationToUser,
  });

  assert.deepEqual(sent, ['admin-2']);
});

test('broadcastAdminNotification handles empty user list', async () => {
  const sent = [];
  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 't', body: 'b', url: '/app' },
    listAppUsers: async () => [],
    getUserPreferences: async () => ({}),
    sendNotificationToUser: async ({ userId }) => { sent.push(userId); },
  });

  assert.equal(sent.length, 0);
});

test('broadcastAdminNotification handles null user list', async () => {
  const sent = [];
  await broadcastAdminNotification({
    category: 'trustOverride',
    payload: { title: 't', body: 'b', url: '/app' },
    listAppUsers: async () => null,
    getUserPreferences: async () => ({}),
    sendNotificationToUser: async ({ userId }) => { sent.push(userId); },
  });

  assert.equal(sent.length, 0);
});
