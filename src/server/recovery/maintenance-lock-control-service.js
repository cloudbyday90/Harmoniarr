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

import { recordAuditEvent } from '../audit.js';
import { createApiError } from '../auth.js';
import { createControlPlaneRedactionService } from '../control-plane-redaction-service.js';

const supportedLockTypes = new Set(['admin_recovery', 'maintenance', 'restore', 'upgrade']);

function normalizeLockType(lockType) {
  if (typeof lockType !== 'string' || lockType.trim().length < 1) {
    return 'maintenance';
  }

  return lockType.trim().toLowerCase();
}

function normalizeLockTypeFilter(lockTypes) {
  if (!Array.isArray(lockTypes)) {
    return [];
  }

  return lockTypes
    .filter((lockType) => typeof lockType === 'string' && lockType.trim().length > 0)
    .map((lockType) => lockType.trim().toLowerCase());
}

export function createMaintenanceLockControlService({
  acquireMaintenanceLock = async () => {
    throw new Error('acquireMaintenanceLock dependency is required');
  },
  getMaintenanceLockById = async () => null,
  listActiveMaintenanceLocks = async () => [],
  controlPlaneRedactionService = createControlPlaneRedactionService(),
  recordAuditEventFn = recordAuditEvent,
  releaseMaintenanceLock = async () => null,
} = {}) {
  async function getMaintenanceLockStatus({ lockTypes = null } = {}) {
    const normalizedLockTypes = normalizeLockTypeFilter(lockTypes);
    const activeLocks = await listActiveMaintenanceLocks({
      lockTypes: normalizedLockTypes.length > 0 ? normalizedLockTypes : null,
    });

    return {
      checkedAt: new Date().toISOString(),
      activeLocks: activeLocks.map((lock) => controlPlaneRedactionService.redactMaintenanceLock(lock)),
      lockCount: activeLocks.length,
      lockTypes: normalizedLockTypes,
      hasActiveLocks: activeLocks.length > 0,
    };
  }

  async function enterMaintenanceLock({
    expiresAt = null,
    lockType = 'maintenance',
    reason = null,
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    const normalizedLockType = normalizeLockType(lockType);
    if (!supportedLockTypes.has(normalizedLockType)) {
      throw createApiError(400, 'maintenance_lock_type_invalid', 'Maintenance lock type is not supported');
    }

    const lock = await acquireMaintenanceLock({
      acquiredByUserId: triggeredByUserId,
      expiresAt,
      lockType: normalizedLockType,
      reason,
      status: 'active',
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        expiresAt: lock.expiresAt,
        lockId: lock.id,
        lockType: lock.lockType,
        reason: lock.reason,
      },
      entityId: lock.id,
      entityType: 'maintenance_lock',
      eventType: 'maintenance_lock_entered',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Maintenance lock entered (${lock.lockType})`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      lock: controlPlaneRedactionService.redactMaintenanceLock(lock),
    };
  }

  async function releaseMaintenanceLockById({
    lockId,
    requestMetadata = null,
    triggeredByUserId = null,
  } = {}) {
    if (typeof lockId !== 'string' || lockId.trim().length < 1) {
      throw createApiError(400, 'maintenance_lock_id_required', 'Maintenance lock id is required');
    }

    const existingLock = await getMaintenanceLockById({ lockId });
    if (!existingLock) {
      throw createApiError(404, 'maintenance_lock_not_found', 'Maintenance lock was not found');
    }

    if (existingLock.releasedAt) {
      return {
        accepted: true,
        alreadyReleased: true,
        lock: controlPlaneRedactionService.redactMaintenanceLock(existingLock),
      };
    }

    const releasedLock = await releaseMaintenanceLock({
      lockId,
      status: 'released',
    });

    if (!releasedLock) {
      throw createApiError(404, 'maintenance_lock_not_found', 'Maintenance lock was not found');
    }

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        lockId: releasedLock.id,
        lockType: releasedLock.lockType,
        reason: releasedLock.reason,
      },
      entityId: releasedLock.id,
      entityType: 'maintenance_lock',
      eventType: 'maintenance_lock_released',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Maintenance lock released (${releasedLock.lockType})`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      accepted: true,
      alreadyReleased: false,
      lock: controlPlaneRedactionService.redactMaintenanceLock(releasedLock),
    };
  }

  return {
    enterMaintenanceLock,
    getMaintenanceLockStatus,
    releaseMaintenanceLockById,
  };
}
