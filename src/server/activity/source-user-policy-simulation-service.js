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

// Read-only policy simulation service. Loads the current peer population from
// the trust snapshot and runs the pure threshold simulator so an operator can
// preview how a proposed threshold change would reclassify peers before applying
// it. No mutation occurs.

import { buildSourceUserUsernameKey } from './source-user-trust-service.js';
import { simulateTrustThresholdPolicy } from './source-user-trust-threshold-simulator.js';

/**
 * @param {object} deps
 * @param {() => Promise<{ sourceUsers: Array<object> }>} deps.listSourceUsersFn
 * @param {Function} [deps.simulateTrustThresholdPolicyFn]
 */
export function createSourceUserPolicySimulationService({
  listSourceUsersFn,
  simulateTrustThresholdPolicyFn = simulateTrustThresholdPolicy,
} = {}) {
  if (typeof listSourceUsersFn !== 'function') {
    throw new Error('createSourceUserPolicySimulationService requires listSourceUsersFn');
  }

  async function simulatePolicy({ thresholds = {} } = {}) {
    const snapshot = await listSourceUsersFn({});
    const sourceUsers = Array.isArray(snapshot?.sourceUsers) ? snapshot.sourceUsers : [];

    const peers = sourceUsers.map((row) => {
      const username = typeof row?.username === 'string' ? row.username : '';
      return {
        username,
        usernameKey: buildSourceUserUsernameKey(username),
        successCount: row?.reputation?.successCount ?? 0,
        failureCount: row?.reputation?.failureCount ?? 0,
        trustState: typeof row?.trustState === 'string' ? row.trustState : 'neutral',
      };
    });

    const simulation = simulateTrustThresholdPolicyFn({ peers, thresholds });

    return {
      checkedAt: new Date().toISOString(),
      ...simulation,
    };
  }

  return { simulatePolicy };
}
