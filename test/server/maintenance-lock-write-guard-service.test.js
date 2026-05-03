import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaintenanceLockWriteGuardService } from '../../src/server/recovery/maintenance-lock-write-guard-service.js';

test('assertNoActiveWriteLocks passes when no blocking maintenance locks are active', async (t) => {
  const listActiveMaintenanceLocks = t.mock.fn(async () => []);
  const service = createMaintenanceLockWriteGuardService({ listActiveMaintenanceLocks });

  await service.assertNoActiveWriteLocks({ operationLabel: 'import candidate apply' });

  assert.equal(listActiveMaintenanceLocks.mock.callCount(), 1);
  assert.deepEqual(listActiveMaintenanceLocks.mock.calls[0].arguments, [{
    lockTypes: ['admin_recovery', 'maintenance', 'restore', 'upgrade'],
  }]);
});

test('assertNoActiveWriteLocks rejects when a blocking lock exists', async () => {
  const service = createMaintenanceLockWriteGuardService({
    listActiveMaintenanceLocks: async () => ([{ id: 'lock-1', lockType: 'maintenance', status: 'active' }]),
  });

  await assert.rejects(
    () => service.assertNoActiveWriteLocks({ operationLabel: 'import candidate execution planning' }),
    (error) => error.code === 'recovery_lock_conflict',
  );
});
