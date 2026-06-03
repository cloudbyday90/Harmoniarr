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
import { createSourceUserPolicySimulationService } from '../../src/server/activity/source-user-policy-simulation-service.js';

test('simulatePolicy maps the trust snapshot into peers and runs the simulator', async () => {
  const service = createSourceUserPolicySimulationService({
    listSourceUsersFn: async () => ({
      sourceUsers: [
        { username: 'Healthy-Peer', trustState: 'neutral', reputation: { successCount: 9, failureCount: 1 } },
        { username: 'Edge-Peer', trustState: 'neutral', reputation: { successCount: 8, failureCount: 2 } },
      ],
    }),
  });

  const result = await service.simulatePolicy({ thresholds: { healthyMinSuccessRate: 0.85 } });

  assert.equal(result.evaluatedPeerCount, 2);
  assert.equal(result.changedPeerCount, 1);
  assert.equal(typeof result.checkedAt, 'string');
  assert.equal(result.projection[0].usernameKey, 'healthy-peer');
});

test('simulatePolicy tolerates an empty snapshot', async () => {
  const service = createSourceUserPolicySimulationService({
    listSourceUsersFn: async () => ({ sourceUsers: [] }),
  });
  const result = await service.simulatePolicy({});
  assert.equal(result.evaluatedPeerCount, 0);
  assert.equal(result.changedPeerCount, 0);
});

test('throws when listSourceUsersFn is missing', () => {
  assert.throws(() => createSourceUserPolicySimulationService({}), /listSourceUsersFn/);
});
