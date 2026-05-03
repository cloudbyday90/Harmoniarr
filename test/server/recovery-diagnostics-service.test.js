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

import { createRecoveryDiagnosticsService } from '../../src/server/recovery/recovery-diagnostics-service.js';

test('getQueueDiagnostics returns status totals with recent runs', async (t) => {
  const query = t.mock.fn(async () => ({
    rows: [
      { status: 'pending', count: 2 },
      { status: 'running', count: 1 },
      { status: 'failed', count: 3 },
    ],
  }));
  const listRecentOperationRuns = t.mock.fn(async () => [{ id: 'run-1', status: 'failed' }]);
  const service = createRecoveryDiagnosticsService({
    getPoolFn: () => ({ query }),
    listRecentOperationRuns,
    nowFn: () => new Date('2026-05-02T13:00:00.000Z'),
  });

  const result = await service.getQueueDiagnostics({ runLimit: 15 });

  assert.equal(result.checkedAt, '2026-05-02T13:00:00.000Z');
  assert.deepEqual(result.queueState, {
    failed: 3,
    pending: 2,
    running: 1,
    totalTracked: 6,
  });
  assert.deepEqual(result.recentRuns, [{ id: 'run-1', status: 'failed' }]);
  assert.equal(query.mock.callCount(), 1);
  assert.equal(listRecentOperationRuns.mock.callCount(), 1);
});

test('getRecoveryDiagnostics returns maintenance locks, failed runs, and privileged audit actions', async (t) => {
  const listActiveMaintenanceLocks = t.mock.fn(async () => [{ id: 'lock-1', lockType: 'maintenance' }]);
  const listRecentOperationRuns = t.mock.fn(async () => ([
    { id: 'run-failed', status: 'failed', operationType: 'backup_restore_apply', errorMessage: 'failed' },
    { id: 'run-ok', status: 'completed', operationType: 'backup_restore_apply' },
  ]));
  const listRecentAuditEvents = t.mock.fn(async () => ([
    {
      id: 'audit-1',
      eventType: 'maintenance_lock_entered',
      entityType: 'maintenance_lock',
      entityId: 'lock-1',
      occurredAt: '2026-05-02T12:55:00.000Z',
      summary: 'Maintenance lock entered',
      details: { lockType: 'maintenance' },
    },
    {
      id: 'audit-2',
      eventType: 'metadata_release_group_detected',
      entityType: 'metadata_release_group',
      entityId: 'rg-1',
      occurredAt: '2026-05-02T12:56:00.000Z',
      summary: 'Detected',
      details: {},
    },
  ]));
  const service = createRecoveryDiagnosticsService({
    listActiveMaintenanceLocks,
    listRecentAuditEvents,
    listRecentOperationRuns,
    nowFn: () => new Date('2026-05-02T13:01:00.000Z'),
  });

  const result = await service.getRecoveryDiagnostics({
    auditLimit: 10,
    lockTypes: ['maintenance'],
    runLimit: 20,
  });

  assert.equal(result.checkedAt, '2026-05-02T13:01:00.000Z');
  assert.equal(result.maintenance.lockCount, 1);
  assert.equal(result.maintenance.hasActiveLocks, true);
  assert.equal(result.recentFailedRuns.length, 1);
  assert.equal(result.recentFailedRuns[0].id, 'run-failed');
  assert.equal(result.recentPrivilegedActions.length, 1);
  assert.equal(result.recentPrivilegedActions[0].eventType, 'maintenance_lock_entered');
  assert.equal(listActiveMaintenanceLocks.mock.callCount(), 1);
  assert.equal(listRecentOperationRuns.mock.callCount(), 1);
  assert.equal(listRecentAuditEvents.mock.callCount(), 1);
});
