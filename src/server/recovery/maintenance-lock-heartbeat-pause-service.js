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

import {
  defaultBlockingMaintenanceLockTypes,
  maintenanceLockPauseCode,
} from './maintenance-lock-policy.js';

function formatHeartbeatPauseMessage({ blockingLock, operationLabel }) {
  const resolvedOperationLabel = typeof operationLabel === 'string' && operationLabel.trim().length > 0
    ? operationLabel.trim()
    : 'Background work';
  const lockType = typeof blockingLock?.lockType === 'string' && blockingLock.lockType.trim().length > 0
    ? blockingLock.lockType.trim()
    : 'maintenance';

  return `${resolvedOperationLabel} is paused while the ${lockType} maintenance lock is active.`;
}

export function createMaintenanceLockHeartbeatPauseService({
  blockingLockTypes = defaultBlockingMaintenanceLockTypes,
  listActiveMaintenanceLocks = async () => [],
} = {}) {
  async function resolveHeartbeatReadiness({ operationLabel } = {}) {
    const blockingLocks = await listActiveMaintenanceLocks({
      lockTypes: [...blockingLockTypes],
    });

    if (!Array.isArray(blockingLocks) || blockingLocks.length < 1) {
      return { allowed: true };
    }

    const blockingLock = blockingLocks[0];
    return {
      allowed: false,
      blockingLock,
      blockingLocks,
      pauseCode: maintenanceLockPauseCode,
      pauseMessage: formatHeartbeatPauseMessage({ blockingLock, operationLabel }),
      pauseProvider: blockingLock?.lockType ?? 'maintenance',
      nextRetryAt: blockingLock?.expiresAt ?? null,
    };
  }

  return {
    resolveHeartbeatReadiness,
  };
}