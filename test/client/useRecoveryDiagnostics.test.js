import assert from 'node:assert/strict';
import test from 'node:test';
import { useRecoveryDiagnostics } from '../../src/client/composables/useRecoveryDiagnostics.js';

test('useRecoveryDiagnostics loads queue and recovery state together', async () => {
  const workflow = useRecoveryDiagnostics({
    fetchQueueDiagnostics: async () => ({
      checkedAt: '2026-05-03T12:00:00.000Z',
      queueState: {
        failed: 1,
        pending: 2,
        running: 3,
        totalTracked: 6,
      },
      recentRuns: [{
        id: 'run-1',
        operationType: 'library_scan',
        status: 'running',
      }],
    }),
    fetchRecoveryDiagnostics: async () => ({
      checkedAt: '2026-05-03T12:01:00.000Z',
      maintenance: {
        activeLocks: [{
          id: 'lock-1',
          lockType: 'maintenance',
          status: 'active',
        }],
      },
      recentFailedRuns: [{
        errorMessage: 'Restore failed',
        id: 'run-restore-1',
        operationType: 'backup_restore_apply',
        status: 'failed',
      }],
      recentPrivilegedActions: [{
        entityId: 'run-restore-1',
        entityType: 'operation_run',
        eventType: 'backup_restore_failed',
        id: 'audit-1',
      }],
    }),
  });

  await workflow.loadDiagnostics();

  assert.equal(workflow.queueState.value.totalTracked, 6);
  assert.equal(workflow.activeLocks.value.length, 1);
  assert.equal(workflow.recentFailedRuns.value[0].operationType, 'backup_restore_apply');
  assert.equal(workflow.recentPrivilegedActions.value[0].eventType, 'backup_restore_failed');
});

test('useRecoveryDiagnostics enters a maintenance lock and reloads diagnostics', async (t) => {
  const loadQueueDiagnostics = t.mock.fn(async () => ({
    checkedAt: '2026-05-03T12:00:00.000Z',
    queueState: {
      failed: 0,
      pending: 0,
      running: 0,
      totalTracked: 0,
    },
    recentRuns: [],
  }));
  const loadRecoveryDiagnostics = t.mock.fn(async () => ({
    checkedAt: '2026-05-03T12:01:00.000Z',
    maintenance: {
      activeLocks: [{
        id: 'lock-1',
        lockType: 'maintenance',
      }],
    },
    recentFailedRuns: [],
    recentPrivilegedActions: [],
  }));
  const workflow = useRecoveryDiagnostics({
    enterMaintenanceLock: t.mock.fn(async () => ({
      accepted: true,
      lock: {
        id: 'lock-1',
        lockType: 'maintenance',
      },
    })),
    fetchQueueDiagnostics: loadQueueDiagnostics,
    fetchRecoveryDiagnostics: loadRecoveryDiagnostics,
  });

  const result = await workflow.createMaintenanceLock({
    lockType: 'maintenance',
    reason: 'Patch window',
  });

  assert.equal(result.accepted, true);
  assert.equal(loadQueueDiagnostics.mock.callCount(), 1);
  assert.equal(loadRecoveryDiagnostics.mock.callCount(), 1);
  assert.equal(workflow.activeLocks.value[0].id, 'lock-1');
});

test('useRecoveryDiagnostics releases a maintenance lock and reloads diagnostics', async (t) => {
  const loadQueueDiagnostics = t.mock.fn(async () => ({
    checkedAt: '2026-05-03T12:00:00.000Z',
    queueState: {
      failed: 0,
      pending: 0,
      running: 0,
      totalTracked: 0,
    },
    recentRuns: [],
  }));
  const loadRecoveryDiagnostics = t.mock.fn(async () => ({
    checkedAt: '2026-05-03T12:01:00.000Z',
    maintenance: {
      activeLocks: [],
    },
    recentFailedRuns: [],
    recentPrivilegedActions: [],
  }));
  const workflow = useRecoveryDiagnostics({
    fetchQueueDiagnostics: loadQueueDiagnostics,
    fetchRecoveryDiagnostics: loadRecoveryDiagnostics,
    releaseMaintenanceLock: t.mock.fn(async () => ({
      accepted: true,
      alreadyReleased: false,
      lock: {
        id: 'lock-2',
        lockType: 'maintenance',
      },
    })),
  });

  const result = await workflow.releaseLock('lock-2');

  assert.equal(result.accepted, true);
  assert.equal(loadQueueDiagnostics.mock.callCount(), 1);
  assert.equal(loadRecoveryDiagnostics.mock.callCount(), 1);
  assert.equal(workflow.activeLocks.value.length, 0);
});

test('useRecoveryDiagnostics clears stale state when diagnostics loading fails', async () => {
  const workflow = useRecoveryDiagnostics({
    fetchQueueDiagnostics: async () => {
      throw new Error('diagnostics unavailable');
    },
    fetchRecoveryDiagnostics: async () => ({
      maintenance: {
        activeLocks: [],
      },
      recentFailedRuns: [],
      recentPrivilegedActions: [],
    }),
  });

  await workflow.loadDiagnostics();

  assert.equal(workflow.queueDiagnostics.value, null);
  assert.equal(workflow.recoveryDiagnostics.value, null);
  assert.equal(workflow.errorMessage.value, 'diagnostics unavailable');
});
