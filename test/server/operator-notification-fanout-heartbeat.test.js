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
import { createOperatorNotificationFanoutHeartbeat } from '../../src/server/operator-notification-fanout-heartbeat.js';

test('operator notification fanout heartbeat reports queued runs', async () => {
  const heartbeat = createOperatorNotificationFanoutHeartbeat({
    startOperatorNotificationFanoutRunIfNeeded: async () => ({
      accepted: true,
      run: { id: 'run-1' },
    }),
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    queuedRunId: 'run-1',
    skipped: false,
  });
});

test('operator notification fanout heartbeat reports skipped reasons', async () => {
  const heartbeat = createOperatorNotificationFanoutHeartbeat({
    startOperatorNotificationFanoutRunIfNeeded: async () => ({
      accepted: false,
      reason: 'no_new_actionable_notifications',
    }),
  });

  const result = await heartbeat.tick();

  assert.deepEqual(result, {
    reason: 'no_new_actionable_notifications',
    skipped: true,
  });
});

test('operator notification fanout heartbeat swallows errors via onError', async () => {
  const errors = [];
  const heartbeat = createOperatorNotificationFanoutHeartbeat({
    onError: (error) => { errors.push(error.message); },
    startOperatorNotificationFanoutRunIfNeeded: async () => {
      throw new Error('fanout failed');
    },
  });

  const result = await heartbeat.tick();

  assert.deepEqual(errors, ['fanout failed']);
  assert.deepEqual(result, {
    reason: 'error',
    skipped: true,
  });
});
