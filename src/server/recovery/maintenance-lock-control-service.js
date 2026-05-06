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

export function createMaintenanceLockControlService({
  acquireMaintenanceLockFn = async () => null,
  getMaintenanceLockByIdFn = async () => null,
  listActiveMaintenanceLocksFn = async () => [],
  releaseMaintenanceLockFn = async () => null,
} = {}) {
  async function getMaintenanceLockStatus({ lockTypes = null } = {}) {
    const resolvedLockTypes = Array.isArray(lockTypes) && lockTypes.length > 0 ? lockTypes : [];
    const activeLocks = await listActiveMaintenanceLocksFn({
      lockTypes: resolvedLockTypes.length > 0 ? resolvedLockTypes : null,
    });

    return {
      checkedAt: new Date().toISOString(),
      activeLocks,
      lockCount: activeLocks.length,
      lockTypes: resolvedLockTypes,
      hasActiveLocks: activeLocks.length > 0,
    };
  }

  async function enterMaintenanceLock({
    expiresAt = null,
    lockType,
    reason = null,
    // eslint-disable-next-line no-unused-vars
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    if (typeof lockType !== 'string' || lockType.trim().length < 1) {
      throw createApiError(422, 'invalid_lock_type', 'lockType is required');
    }

    const lock = await acquireMaintenanceLockFn({
      acquiredByUserId: triggeredByUserId,
      expiresAt,
      lockType,
      reason,
    });

    return { accepted: true, lock };
  }

  async function releaseMaintenanceLockById({
    lockId,
    // eslint-disable-next-line no-unused-vars
    requestMetadata = null,
    // eslint-disable-next-line no-unused-vars
    triggeredByUserId = null,
  } = {}) {
    if (typeof lockId !== 'string' || lockId.trim().length < 1) {
      throw createApiError(422, 'invalid_lock_id', 'lockId is required');
    }

    const existing = await getMaintenanceLockByIdFn({ lockId });

    if (!existing) {
      throw createApiError(404, 'not_found', `Maintenance lock ${lockId} not found`);
    }

    if (existing.status !== 'active') {
      return { accepted: true, alreadyReleased: true, lock: existing };
    }

    const lock = await releaseMaintenanceLockFn({ lockId });

    return { accepted: true, alreadyReleased: false, lock };
  }

  return {
    enterMaintenanceLock,
    getMaintenanceLockStatus,
    releaseMaintenanceLockById,
  };
}
