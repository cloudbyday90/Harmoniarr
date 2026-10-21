/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminRecoveryOperatorService } from '../../src/server/recovery/admin-recovery-operator-service.js';

function fixture({ existing = true, blocked = false, fault = false, failure = null } = {}) {
  const client = {}; const calls = []; let transactional = false;
  const run = { id: 'old', status: 'armed', isExpired: false };
  const owned = input => { assert.equal(input.queryable, client); assert.equal(transactional, true); };
  const deps = {
    adminRecoveryStore: {
      lockOperatorLifecycle: async input => { owned(input); calls.push('lifecycle'); },
      expireStaleArmedRuns: async input => { owned(input); },
      getActiveArmedRun: async input => { owned(input); return existing ? run : null; },
      getRecoveryRunById: async input => { owned(input); return run; },
      cancelRecoveryRun: async input => { owned(input); calls.push('cancel'); return { ...run, cancelledAt: 'cancelled' }; },
      insertRecoveryRun: async input => { owned(input); calls.push('insert'); if (fault) throw failure;
        assert.equal(input.ttlMinutes, 15); assert.equal(input.recoveryCodeHash, 'hashed'); return { id: 'new', expiresAt: 'expiry' }; },
    },
    maintenanceLockService: { listActiveMaintenanceLocks: async input => { owned(input); assert.equal(input.lockForTransaction, true); calls.push('maintenance'); return blocked ? [{}] : []; } },
    withTransactionFn: async work => { transactional = true; try { const result = await work(client); calls.push('commit'); return result; }
      catch (error) { calls.push('rollback'); throw error; } finally { transactional = false; } },
    recordAuditEventFn: async (event, queryable) => { owned({ queryable }); calls.push(event.eventType); },
    generateRecoveryCodeFn: () => 'operator-only-code', hashRecoveryCodeFn: () => 'hashed', clampTtlMinutesFn: () => 15,
  };
  return { ...createAdminRecoveryOperatorService(deps), calls };
}

test('force replacement binds old cancellation, insertion and both audits to the transaction before returning material', async () => {
  const f = fixture(); const result = await f.armBootstrapAdminRecovery({ force: true });
  assert.equal(result.recoveryCode, 'operator-only-code'); assert.equal(result.replacedExistingRun, true);
  assert.deepEqual(f.calls, ['maintenance', 'lifecycle', 'cancel', 'bootstrap_admin_recovery_cancelled', 'insert', 'bootstrap_admin_recovery_armed', 'commit']);
});
test('maintenance denial preserves existing recovery material and publishes no cancellation', async () => {
  const f = fixture({ blocked: true }); await assert.rejects(f.armBootstrapAdminRecovery({ force: true }), { code: 'RECOVERY_LOCK_CONFLICT' });
  assert.deepEqual(f.calls, ['maintenance', 'lifecycle', 'commit']);
});
test('replacement Error/null rolls back rather than returning new recovery material', async () => {
  for (const failure of [new Error('owned insert failure'), null]) {
    const f = fixture({ fault: true, failure }); let rejected = false;
    try { await f.armBootstrapAdminRecovery({ force: true }); } catch (error) { rejected = true; assert.equal(error, failure); }
    assert.equal(rejected, true); assert.equal(f.calls.at(-1), 'rollback');
  }
});
test('forced cancellation stays allowed under maintenance while lack of force has no cancellation side effects', async () => {
  const f = fixture({ blocked: true }); assert.equal((await f.cancelBootstrapAdminRecovery({ force: true })).status, 'cancelled');
  assert.deepEqual(f.calls, ['maintenance', 'lifecycle', 'cancel', 'bootstrap_admin_recovery_cancelled', 'commit']);
  const refused = fixture(); await assert.rejects(refused.cancelBootstrapAdminRecovery(), { code: 'RECOVERY_FORCE_REQUIRED' });
  assert.deepEqual(refused.calls, ['maintenance', 'lifecycle', 'commit']);
});
