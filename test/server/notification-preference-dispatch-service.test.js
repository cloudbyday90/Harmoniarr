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
import { createNotificationPreferenceDispatchService } from '../../src/server/notification/notification-preference-dispatch-service.js';

test('single-recipient preference gating preserves opt-outs and reports unavailable reads without enqueueing', async (t) => {
  const sendNotificationToUser = t.mock.fn(async () => ({ sent: 0, queued: 1, failed: 0 }));
  let unavailable = true;
  let enabled = false;
  const service = createNotificationPreferenceDispatchService({
    getUserPreferences: async ({ userId }) => {
      assert.equal(userId, 'recipient');
      if (unavailable) throw new Error('private token=secret');
      return { notificationPreferences: { requestFulfilled: enabled } };
    },
    sendNotificationToUser,
  });
  const input = { category: 'requestFulfilled', userId: 'recipient', payload: { title: 'Music request ready' } };
  assert.deepEqual(await service.sendNotification(input), { sent: 0, failed: 1, removed: 0 });
  assert.equal(sendNotificationToUser.mock.callCount(), 0);
  unavailable = false;
  assert.deepEqual(await service.sendNotification(input), { sent: 0, failed: 0, removed: 0 });
  assert.equal(sendNotificationToUser.mock.callCount(), 0);
  enabled = true;
  assert.deepEqual(await service.sendNotification(input), { sent: 0, queued: 1, failed: 0 });
  assert.deepEqual(sendNotificationToUser.mock.calls[0].arguments, [{ eventType: input.category, userId: input.userId, payload: input.payload }]);
});

test('single-recipient gate preserves transport failures and never reads an unknown category', async (t) => {
  const failure = new Error('transport failure');
  const getUserPreferences = t.mock.fn(async () => ({}));
  const service = createNotificationPreferenceDispatchService({ getUserPreferences,
    sendNotificationToUser: async () => { throw failure; } });
  assert.deepEqual(await service.sendNotification({ category: 'unknown', userId: 'recipient' }), { sent: 0, failed: 0, removed: 0 });
  assert.equal(getUserPreferences.mock.callCount(), 0);
  await assert.rejects(() => service.sendNotification({ category: 'requestFulfilled', userId: 'recipient' }), failure);
});
