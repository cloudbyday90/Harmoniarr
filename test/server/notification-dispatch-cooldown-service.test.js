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

test('notification dispatch cooldown service allows first dispatch and blocks repeats within the cooldown window', async () => {
  let now = new Date('2026-05-21T12:00:00.000Z');
  const service = createNotificationDispatchCooldownService({
    nowFn: () => now,
  });

  assert.equal(await service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), true);
  await service.markDispatched({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' });
  assert.equal(await service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), false);

  now = new Date('2026-05-21T12:01:01.000Z');
  assert.equal(await service.shouldDispatch({ cooldownKey: 'releaseAdded:key', cooldownMs: 60000, userId: 'user-1' }), true);
});

test('notification dispatch cooldown service tracks cooldowns per user', async () => {
  const service = createNotificationDispatchCooldownService({
    nowFn: () => new Date('2026-05-21T12:00:00.000Z'),
  });

  await service.markDispatched({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-1' });
  assert.equal(await service.shouldDispatch({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-1' }), false);
  assert.equal(await service.shouldDispatch({ cooldownKey: 'downloadCompleted:key', cooldownMs: 60000, userId: 'user-2' }), true);
});

test('notification dispatch cooldown service consults persisted dispatch history when memory is empty', async () => {
  let now = new Date('2026-05-21T12:00:30.000Z');
  const service = createNotificationDispatchCooldownService({
    dispatchHistoryService: {
      getLatestDispatchAt: async () => '2026-05-21T12:00:00.000Z',
    },
    nowFn: () => now,
  });

  assert.equal(await service.shouldDispatch({
    category: 'releaseAdded',
    cooldownKey: 'releaseAdded:key',
    cooldownMs: 60000,
    userId: 'user-1',
  }), false);

  now = new Date('2026-05-21T12:01:01.000Z');
  assert.equal(await service.shouldDispatch({
    category: 'releaseAdded',
    cooldownKey: 'releaseAdded:key',
    cooldownMs: 60000,
    userId: 'user-1',
  }), true);
});

test('notification dispatch cooldown service records persisted dispatch history after sending', async () => {
  const recorded = [];
  const service = createNotificationDispatchCooldownService({
    dispatchHistoryService: {
      recordDispatch: async (payload) => { recorded.push(payload); },
    },
    nowFn: () => new Date('2026-05-21T12:00:00.000Z'),
  });

  await service.markDispatched({
    category: 'requestCreated',
    cooldownKey: 'requestCreated:key',
    cooldownMs: 60000,
    payload: { title: 'Music request created' },
    userId: 'user-1',
  });

  assert.deepEqual(recorded, [{
    category: 'requestCreated',
    cooldownKey: 'requestCreated:key',
    cooldownMs: 60000,
    payload: { title: 'Music request created' },
    userId: 'user-1',
  }]);
});
