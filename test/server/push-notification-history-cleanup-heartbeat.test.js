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
import { createPushNotificationHistoryCleanupHeartbeat } from '../../src/server/push/push-notification-history-cleanup-heartbeat.js';

test('push notification history cleanup heartbeat deletes aged sent history', async () => {
  const deleted = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteSentNotificationHistory: async ({ olderThan }) => {
      deleted.push(olderThan);
      return { deletedCount: 4 };
    },
    nowFn: () => new Date('2026-05-21T12:00:00.000Z'),
    retentionMs: 24 * 60 * 60 * 1000,
  });

  const result = await heartbeat.tick();

  assert.equal(deleted.length, 1);
  assert.equal(deleted[0], '2026-05-20T12:00:00.000Z');
  assert.deepEqual(result, {
    deletedCount: 4,
    skipped: false,
  });
});

test('push notification history cleanup heartbeat reports skipped error results through onError', async () => {
  const errors = [];
  const heartbeat = createPushNotificationHistoryCleanupHeartbeat({
    deleteSentNotificationHistory: async () => {
      throw new Error('cleanup failed');
    },
    onError: (error) => { errors.push(error.message); },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(errors, ['cleanup failed']);
  assert.deepEqual(result, {
    reason: 'error',
    skipped: true,
  });
});
