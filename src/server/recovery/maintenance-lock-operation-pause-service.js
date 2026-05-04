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

function normalizeOperationTypes(operationTypes) {
  if (!Array.isArray(operationTypes)) {
    return [];
  }

  return operationTypes
    .filter((operationType) => typeof operationType === 'string')
    .map((operationType) => operationType.trim())
    .filter(Boolean);
}

function formatDispatchPauseMessage({ blockingLock }) {
  const lockType = typeof blockingLock?.lockType === 'string' && blockingLock.lockType.trim().length > 0
    ? blockingLock.lockType.trim()
    : 'maintenance';
  const lockLabel = lockType === 'maintenance'
    ? 'maintenance lock'
    : `${lockType} maintenance lock`;

  return `Operation queue dispatch is paused while the ${lockLabel} is active.`;
}

export function createMaintenanceLockOperationPauseService({
  blockingLockTypes = defaultBlockingMaintenanceLockTypes,
  listActiveMaintenanceLocks = async () => [],
} = {}) {
  async function resolveDispatchReadiness({ operationTypes } = {}) {
    const normalizedOperationTypes = normalizeOperationTypes(operationTypes);

    if (normalizedOperationTypes.length < 1) {
      return {
        allowed: true,
        pausedOperationTypes: [],
      };
    }

    const blockingLocks = await listActiveMaintenanceLocks({
      lockTypes: [...blockingLockTypes],
    });

    if (!Array.isArray(blockingLocks) || blockingLocks.length < 1) {
      return {
        allowed: true,
        pausedOperationTypes: normalizedOperationTypes,
      };
    }

    const blockingLock = blockingLocks[0];
    return {
      allowed: false,
      blockingLock,
      blockingLocks,
      nextRetryAt: blockingLock?.expiresAt ?? null,
      pauseCode: maintenanceLockPauseCode,
      pauseMessage: formatDispatchPauseMessage({ blockingLock }),
      pauseProvider: blockingLock?.lockType ?? 'maintenance',
      pausedOperationTypes: normalizedOperationTypes,
    };
  }

  return {
    resolveDispatchReadiness,
  };
}