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

import { createApiError } from '../auth.js';
import { defaultBlockingMaintenanceLockTypes } from './maintenance-lock-policy.js';

export function createMaintenanceLockWriteGuardService({
  listActiveMaintenanceLocks = async () => [],
} = {}) {
  async function assertNoActiveWriteLocks({ operationLabel = 'write operations', queryable = null } = {}) {
    const blockingLocks = await listActiveMaintenanceLocks({
      lockTypes: [...defaultBlockingMaintenanceLockTypes],
      ...(queryable ? { queryable, lockForTransaction: true } : {}),
    });

    if (blockingLocks.length > 0) {
      throw createApiError(409, 'recovery_lock_conflict', `A conflicting maintenance lock prevents ${operationLabel}`);
    }
  }

  return {
    assertNoActiveWriteLocks,
  };
}
