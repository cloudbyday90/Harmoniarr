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
import { createPushNotificationDeliveryHeartbeat } from '../../src/server/push/push-notification-delivery-heartbeat.js';

test('push notification delivery heartbeat reports delivery summary results', async () => {
  const heartbeat = createPushNotificationDeliveryHeartbeat({
    deliverPendingNotifications: async ({ limit }) => ({
      claimedCount: limit,
      deliveredCount: 2,
      expiredCount: 1,
      failedCount: 0,
      retriedCount: 3,
    }),
    limit: 6,
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    claimedCount: 6,
    deliveredCount: 2,
    expiredCount: 1,
    failedCount: 0,
    retriedCount: 3,
    skipped: false,
  });
});

test('push notification delivery heartbeat reports skipped error results through onError', async () => {
  const errors = [];
  const heartbeat = createPushNotificationDeliveryHeartbeat({
    deliverPendingNotifications: async () => {
      throw new Error('delivery failed');
    },
    onError: (error) => { errors.push(error.message); },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(errors, ['delivery failed']);
  assert.deepEqual(result, {
    reason: 'error',
    skipped: true,
  });
});
