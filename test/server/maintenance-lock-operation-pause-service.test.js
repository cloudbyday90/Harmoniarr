import assert from 'node:assert/strict';
import test from 'node:test';

import { createMaintenanceLockOperationPauseService } from '../../src/server/recovery/maintenance-lock-operation-pause-service.js';

test('resolveDispatchReadiness returns allowed when no blocking maintenance locks are active', async () => {
  const service = createMaintenanceLockOperationPauseService({
    listActiveMaintenanceLocks: async () => [],
  });

  const result = await service.resolveDispatchReadiness({
    operationTypes: ['library_scan', 'metadata_artist_refresh'],
  });

  assert.deepEqual(result, {
    allowed: true,
    pausedOperationTypes: ['library_scan', 'metadata_artist_refresh'],
  });
});

test('resolveDispatchReadiness returns paused metadata when a blocking maintenance lock is active', async () => {
  const service = createMaintenanceLockOperationPauseService({
    listActiveMaintenanceLocks: async () => [{
      expiresAt: '2026-05-04T12:30:00.000Z',
      id: 'lock-7',
      lockType: 'restore',
    }],
  });

  const result = await service.resolveDispatchReadiness({
    operationTypes: ['library_scan'],
  });

  assert.deepEqual(result, {
    allowed: false,
    blockingLock: {
      expiresAt: '2026-05-04T12:30:00.000Z',
      id: 'lock-7',
      lockType: 'restore',
    },
    blockingLocks: [{
      expiresAt: '2026-05-04T12:30:00.000Z',
      id: 'lock-7',
      lockType: 'restore',
    }],
    nextRetryAt: '2026-05-04T12:30:00.000Z',
    pauseCode: 'recovery_lock_conflict',
    pauseMessage: 'Operation queue dispatch is paused while the restore maintenance lock is active.',
    pauseProvider: 'restore',
    pausedOperationTypes: ['library_scan'],
  });
});