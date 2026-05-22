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
import { createPushNotificationQueueStore } from '../../src/server/push/push-notification-queue-store.js';

test('deleteSentNotificationHistory deletes only aged sent history rows and returns deleted count', async (t) => {
  const query = t.mock.fn(async () => ({ rowCount: 3 }));
  const store = createPushNotificationQueueStore({
    getPoolFn: () => ({ query }),
  });

  const result = await store.deleteSentNotificationHistory({ olderThan: '2026-05-01T00:00:00.000Z' });

  assert.deepEqual(result, { deletedCount: 3 });
  assert.match(query.mock.calls[0].arguments[0], /subscription_id IS NULL/);
  assert.match(query.mock.calls[0].arguments[0], /status = 'sent'/);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['2026-05-01T00:00:00.000Z']);
});
