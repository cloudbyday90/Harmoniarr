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
import { createOperatorNotificationFanoutService } from '../../src/server/operator-notification-fanout-service.js';

test('startOperatorNotificationFanoutRunIfNeeded queues a run for newly actionable notifications', async (t) => {
  const createOperationRun = t.mock.fn(async ({ status, summary }) => ({ id: 'run-1', status, summary }));
  const getOperatorNotifications = t.mock.fn(async () => ({
    notifications: [
      { dedupeKey: 'run:1:failure', requiresAction: true },
      { dedupeKey: 'run:2:queued', requiresAction: false },
    ],
  }));
  const service = createOperatorNotificationFanoutService({
    createOperationRun,
    getActiveRun: async () => null,
    getOperatorNotifications,
    recordAuditEventFn: async () => {},
  });

  const result = await service.startOperatorNotificationFanoutRunIfNeeded();

  assert.equal(result.accepted, true);
  assert.equal(createOperationRun.mock.callCount(), 1);
  assert.deepEqual(createOperationRun.mock.calls[0].arguments[0], {
    status: 'pending',
    summary: {
      actionableNotificationCount: 1,
      notificationDedupeKeys: ['run:1:failure'],
      triggerSource: 'automatic',
    },
    triggeredByUserId: null,
  });
});

test('startOperatorNotificationFanoutRunIfNeeded does not queue when actionable notifications are unchanged', async () => {
  const service = createOperatorNotificationFanoutService({
    createOperationRun: async ({ status, summary }) => ({ id: 'run-1', status, summary }),
    getActiveRun: async () => null,
    getOperatorNotifications: async () => ({
      notifications: [{ dedupeKey: 'run:1:failure', requiresAction: true }],
    }),
    recordAuditEventFn: async () => {},
  });

  const first = await service.startOperatorNotificationFanoutRunIfNeeded();
  const second = await service.startOperatorNotificationFanoutRunIfNeeded();

  assert.equal(first.accepted, true);
  assert.equal(second.accepted, false);
  assert.equal(second.reason, 'no_new_actionable_notifications');
});

test('startOperatorNotificationFanoutRunIfNeeded re-queues when an actionable notification resolves and reappears', async () => {
  let callIndex = 0;
  const service = createOperatorNotificationFanoutService({
    createOperationRun: async ({ status, summary }) => ({ id: `run-${status}`, status, summary }),
    getActiveRun: async () => null,
    getOperatorNotifications: async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return { notifications: [{ dedupeKey: 'heartbeat:libraryDiscovery:paused', requiresAction: true }] };
      }
      if (callIndex === 2) {
        return { notifications: [] };
      }
      return { notifications: [{ dedupeKey: 'heartbeat:libraryDiscovery:paused', requiresAction: true }] };
    },
    recordAuditEventFn: async () => {},
  });

  const first = await service.startOperatorNotificationFanoutRunIfNeeded();
  const cleared = await service.startOperatorNotificationFanoutRunIfNeeded();
  const second = await service.startOperatorNotificationFanoutRunIfNeeded();

  assert.equal(first.accepted, true);
  assert.equal(cleared.accepted, false);
  assert.equal(cleared.reason, 'no_actionable_notifications');
  assert.equal(second.accepted, true);
});

test('startOperatorNotificationFanoutRunIfNeeded skips when a fanout run is already active', async () => {
  const service = createOperatorNotificationFanoutService({
    getActiveRun: async () => ({ id: 'active-run', status: 'running' }),
    getOperatorNotifications: async () => ({ notifications: [{ dedupeKey: 'run:1:failure', requiresAction: true }] }),
  });

  const result = await service.startOperatorNotificationFanoutRunIfNeeded();

  assert.equal(result.accepted, false);
  assert.equal(result.reason, 'fanout_in_progress');
});

test('fanOutOperatorNotifications filters actionable notifications by dedupe keys when provided', async () => {
  const dispatchedBatches = [];
  const service = createOperatorNotificationFanoutService({
    dispatchNotificationBatch: async ({ notifications }) => {
      dispatchedBatches.push(notifications);
      return { attemptedCount: notifications.length, deliveredCount: notifications.length };
    },
    getOperatorNotifications: async () => ({
      counts: { total: 3 },
      notifications: [
        { dedupeKey: 'run:1:failure', requiresAction: true },
        { dedupeKey: 'heartbeat:importExecution:error', requiresAction: true },
        { dedupeKey: 'run:2:queued', requiresAction: false },
      ],
    }),
  });

  const result = await service.fanOutOperatorNotifications({
    notificationDedupeKeys: ['heartbeat:importExecution:error'],
  });

  assert.equal(dispatchedBatches.length, 1);
  assert.deepEqual(dispatchedBatches[0].map((notification) => notification.dedupeKey), ['heartbeat:importExecution:error']);
  assert.equal(result.actionableCount, 1);
  assert.equal(result.notificationCount, 3);
});
