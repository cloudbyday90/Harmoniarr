/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushNotificationRetentionStore } from '../../src/server/push/push-notification-retention-store.js';

test('invalid cleanup limits cannot acquire a database connection', async () => {
  const store = createPushNotificationRetentionStore({ getPoolFn: () => assert.fail('Invalid limit must not reach the database') });
  for (const limit of [0, -1, 1.5, 501, Infinity, NaN, '500', null]) {
    await assert.rejects(store.deleteTerminalNotificationHistory({ limit }), RangeError);
  }
});

test('retention reports only confirmed bounded deletion counts with a fixed policy', async () => {
  const calls = [];
  const store = createPushNotificationRetentionStore({ getPoolFn: () => ({ query: async (...args) => {
    calls.push(args); return { rowCount: 3, rows: [{ payload: 'private' }] };
  } }) });
  assert.deepEqual(await store.deleteTerminalNotificationHistory(), { deletedCount: 3 });
  assert.deepEqual(calls[0][1], [604800000, 500]);
  assert.doesNotMatch(calls[0][0], /RETURNING|SELECT \*/i);
});

test('malformed database counts cannot masquerade as a completed cleanup batch', async () => {
  for (const rowCount of [undefined, null, -1, 1.5, '1', 501]) {
    const store = createPushNotificationRetentionStore({ getPoolFn: () => ({ query: async () => ({ rowCount }) }) });
    await assert.rejects(store.deleteTerminalNotificationHistory(), { message: 'Notification retention result is invalid' });
  }
});
