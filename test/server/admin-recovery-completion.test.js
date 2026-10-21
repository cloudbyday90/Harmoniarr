/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createAdminRecoveryCompletionService } from '../../src/server/recovery/admin-recovery-completion-service.js';

function fixture(overrides = {}) {
  const client = {}; const calls = []; let inTransaction = false;
  const run = { id: 'run', status: 'armed', recoveryCodeHash: 'code', invalidAttemptCount: 0, maxAttempts: 5, isExpired: false };
  const check = input => { assert.equal(input.queryable, client); assert.equal(inTransaction, true); };
  const deps = {
    adminRecoveryStore: {
      expireStaleArmedRuns: async () => {}, getActiveArmedRun: async () => run,
      getRecoveryRunById: async input => { check(input); return run; },
      revokeAllInteractiveSessions: async input => { check(input); return 3; },
      completeRecoveryRun: async input => { check(input); return { completedAt: 'committed-time' }; },
      incrementInvalidAttemptCount: async input => { check(input); return { ...run, invalidAttemptCount: 1 }; },
    },
    recoveryAccountStore: { upsertAdminAccount: async input => { check(input); assert.equal(input.username, 'admin'); return 'user'; } },
    maintenanceLockService: { listActiveMaintenanceLocks: async input => { if (input.lockForTransaction) check(input); return []; },
      acquireMaintenanceLock: async () => ({ id: 'lock' }), releaseMaintenanceLock: async () => { calls.push('released'); } },
    recordAuditEventFn: async (event, queryable) => { check({ queryable }); calls.push(event.eventType); },
    withTransactionFn: async work => { inTransaction = true; try { const value = await work(client); calls.push('committed'); return value; }
      catch (error) { calls.push('rolled-back'); throw error; } finally { inTransaction = false; } },
    hashPasswordFn: async () => { assert.equal(inTransaction, false); return 'hash'; },
    normalizeUsernameFn: value => value.toLowerCase(), validatePasswordFn: value => value,
    verifyRecoveryCodeFn: (value, hash) => value === hash,
  };
  for (const [key, value] of Object.entries(overrides)) deps[key] = typeof value === 'object' ? { ...deps[key], ...value } : value;
  return { ...createAdminRecoveryCompletionService(deps), calls, client };
}
const form = { username: 'ADMIN', recoveryCode: 'code', password: 'password', confirmPassword: 'password' };

test('recovery hashes outside the transaction and binds account/session/consumption/audits to one client before success', async () => {
  const f = fixture(); assert.equal((await f.completeBootstrapAdminRecovery(form)).success, true);
  assert.deepEqual(f.calls, ['bootstrap_admin_recovery_completed', 'sessions_revoked_after_recovery', 'committed', 'released']);
});

test('invalid-code refusal commits its attempt instead of rolling it back', async () => {
  const f = fixture(); await assert.rejects(f.completeBootstrapAdminRecovery({ ...form, recoveryCode: 'wrong' }), { status: 401 });
  assert.deepEqual(f.calls, ['committed']);
});

test('primary Error/null survives a later maintenance release failure and rolls the transaction back', async () => {
  for (const failure of [new Error('owned failure'), null]) {
    const f = fixture({ recoveryAccountStore: { upsertAdminAccount: async () => { throw failure; } },
      maintenanceLockService: { releaseMaintenanceLock: async () => { throw new Error('release failure'); } } });
    let rejected = false;
    try { await f.completeBootstrapAdminRecovery(form); } catch (error) { rejected = true; assert.equal(error, failure); }
    assert.equal(rejected, true); assert.deepEqual(f.calls, ['rolled-back']);
  }
});

test('fresh cancelled ownership refuses before account writes; successful commit followed by failed release does not retry', async () => {
  const f = fixture({ adminRecoveryStore: { getRecoveryRunById: async () => ({ status: 'cancelled' }) } });
  await assert.rejects(f.completeBootstrapAdminRecovery(form), { status: 401 }); assert.deepEqual(f.calls, ['committed', 'released']);
  const release = new Error('owned release failure');
  const success = fixture({ maintenanceLockService: { releaseMaintenanceLock: async () => { throw release; } } });
  await assert.rejects(success.completeBootstrapAdminRecovery(form), error => error === release);
  assert.deepEqual(success.calls, ['bootstrap_admin_recovery_completed', 'sessions_revoked_after_recovery', 'committed']);
});

test('a refused guarded consumption rolls account/session changes back rather than reporting completion', async () => {
  const f = fixture({ adminRecoveryStore: { completeRecoveryRun: async () => null } });
  await assert.rejects(f.completeBootstrapAdminRecovery(form), { status: 401 }); assert.deepEqual(f.calls, ['rolled-back', 'released']);
});
