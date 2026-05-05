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

  assert.equal(workflow.recentFailedRuns.value[0].operationType, 'backup_restore_apply');
  assert.equal(workflow.recentPrivilegedActions.value[0].eventType, 'backup_restore_failed');
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
