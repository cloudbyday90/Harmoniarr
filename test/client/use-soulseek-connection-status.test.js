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
import { useSoulseekConnectionStatus } from '../../src/client/composables/useSoulseekConnectionStatus.js';

test('useSoulseekConnectionStatus keeps the saved provider result separate from system health', async (t) => {
  const fetchSlskdStatus = t.mock.fn(async () => ({ provider: 'slskd', status: 'healthy' }));
  const { connectionErrorCode, connectionStatus, isLoading, loadConnectionStatus } = useSoulseekConnectionStatus({
    fetchSlskdStatus,
  });

  await loadConnectionStatus();

  assert.equal(fetchSlskdStatus.mock.callCount(), 1);
  assert.equal(isLoading.value, false);
  assert.equal(connectionErrorCode.value, '');
  assert.deepEqual(connectionStatus.value, { provider: 'slskd', status: 'healthy' });
});

test('useSoulseekConnectionStatus stores only a bounded error code after a failed status read', async () => {
  const failure = new Error('http://private-slskd.example rejected secret-value');
  failure.code = 'slskd_unauthorized';
  const { connectionErrorCode, connectionStatus, loadConnectionStatus } = useSoulseekConnectionStatus({
    fetchSlskdStatus: async () => { throw failure; },
  });

  await loadConnectionStatus();

  assert.equal(connectionErrorCode.value, 'slskd_unauthorized');
  assert.equal(connectionStatus.value, null);
  assert.doesNotMatch(JSON.stringify({ connectionErrorCode: connectionErrorCode.value }), /private-slskd|secret-value|https?:/i);
});
