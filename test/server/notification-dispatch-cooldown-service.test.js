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

test('notification dispatch cooldown service allows first dispatch and blocks repeats within the cooldown window', () => {
  let now = new Date('2026-05-21T12:00:00.000Z');
  const service = createNotificationDispatchCooldownService({
    nowFn: () => now,
  });

  assert.equal(service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), true);
  service.markDispatched({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' });
  assert.equal(service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), false);

  now = new Date('2026-05-21T12:01:01.000Z');
  assert.equal(service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), true);
});

test('notification dispatch cooldown service tracks cooldowns per user', () => {
  const service = createNotificationDispatchCooldownService({
    nowFn: () => new Date('2026-05-21T12:00:00.000Z'),
  });

  service.markDispatched({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-1' });
  assert.equal(service.shouldDispatch({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-1' }), false);
  assert.equal(service.shouldDispatch({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-2' }), true);
});
