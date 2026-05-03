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

import { createMaintenanceLockControlService } from '../../src/server/recovery/maintenance-lock-control-service.js';

test('getMaintenanceLockStatus returns active locks with normalized filters', async (t) => {
  const listActiveMaintenanceLocks = t.mock.fn(async ({ lockTypes }) => [{ id: 'lock-1', lockType: lockTypes[0] }]);
  const service = createMaintenanceLockControlService({ listActiveMaintenanceLocks });

  const result = await service.getMaintenanceLockStatus({
    lockTypes: [' MAINTENANCE ', '', 'restore'],
  });

  assert.equal(Array.isArray(result.activeLocks), true);
  assert.equal(result.lockCount, 1);
  assert.equal(result.hasActiveLocks, true);
  assert.deepEqual(result.lockTypes, ['maintenance', 'restore']);
  assert.equal(listActiveMaintenanceLocks.mock.callCount(), 1);
  assert.deepEqual(listActiveMaintenanceLocks.mock.calls[0].arguments, [{
    lockTypes: ['maintenance', 'restore'],
  }]);
});

test('enterMaintenanceLock validates lock type and records audit event', async (t) => {
  const acquireMaintenanceLock = t.mock.fn(async ({ lockType }) => ({
    id: 'lock-11',
    lockType,
    status: 'active',
    reason: 'patching',
    expiresAt: null,
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createMaintenanceLockControlService({
    acquireMaintenanceLock,
    recordAuditEventFn,
  });

  const result = await service.enterMaintenanceLock({
    lockType: 'maintenance',
    reason: 'patching',
    requestMetadata: {
      ipAddress: '198.51.100.41',
      userAgent: 'maintenance-control-test',
    },
    triggeredByUserId: 'user-1',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.lock.id, 'lock-11');
  assert.equal(acquireMaintenanceLock.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'maintenance_lock_entered');
});

test('enterMaintenanceLock rejects unsupported lock types', async () => {
  const service = createMaintenanceLockControlService();

  await assert.rejects(
    () => service.enterMaintenanceLock({ lockType: 'invalid-type' }),
    (error) => {
      assert.equal(error.status, 400);
      assert.equal(error.code, 'maintenance_lock_type_invalid');
      return true;
    },
  );
});

test('releaseMaintenanceLockById is idempotent when already released', async (t) => {
  const getMaintenanceLockById = t.mock.fn(async () => ({
    id: 'lock-22',
    lockType: 'maintenance',
    status: 'released',
    releasedAt: '2026-05-02T12:00:00.000Z',
  }));
  const releaseMaintenanceLock = t.mock.fn(async () => {
    throw new Error('release should not be called');
  });
  const service = createMaintenanceLockControlService({
    getMaintenanceLockById,
    releaseMaintenanceLock,
  });

  const result = await service.releaseMaintenanceLockById({ lockId: 'lock-22' });

  assert.equal(result.accepted, true);
  assert.equal(result.alreadyReleased, true);
  assert.equal(getMaintenanceLockById.mock.callCount(), 1);
  assert.equal(releaseMaintenanceLock.mock.callCount(), 0);
});

test('releaseMaintenanceLockById releases active lock and records audit event', async (t) => {
  const getMaintenanceLockById = t.mock.fn(async () => ({
    id: 'lock-33',
    lockType: 'maintenance',
    status: 'active',
    releasedAt: null,
  }));
  const releaseMaintenanceLock = t.mock.fn(async ({ lockId }) => ({
    id: lockId,
    lockType: 'maintenance',
    status: 'released',
    reason: 'completed',
    releasedAt: '2026-05-02T12:22:00.000Z',
  }));
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createMaintenanceLockControlService({
    getMaintenanceLockById,
    releaseMaintenanceLock,
    recordAuditEventFn,
  });

  const result = await service.releaseMaintenanceLockById({
    lockId: 'lock-33',
    requestMetadata: {
      ipAddress: '198.51.100.42',
      userAgent: 'maintenance-control-test',
    },
    triggeredByUserId: 'user-3',
  });

  assert.equal(result.accepted, true);
  assert.equal(result.alreadyReleased, false);
  assert.equal(result.lock.id, 'lock-33');
  assert.equal(releaseMaintenanceLock.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.callCount(), 1);
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'maintenance_lock_released');
});
