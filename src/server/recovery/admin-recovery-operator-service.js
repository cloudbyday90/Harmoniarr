/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';

export function createAdminRecoveryOperatorService({ adminRecoveryStore, maintenanceLockService,
  withTransactionFn, recordAuditEventFn, generateRecoveryCodeFn, hashRecoveryCodeFn, clampTtlMinutesFn }) {
  async function readActive(queryable) {
    await adminRecoveryStore.expireStaleArmedRuns({ queryable });
    const observed = await adminRecoveryStore.getActiveArmedRun({ queryable });
    if (!observed) return null;
    const run = await adminRecoveryStore.getRecoveryRunById({ runId: observed.id, queryable, lockForTransaction: true });
    if (!run || run.status !== 'armed') return null;
    if (run.isExpired) { await adminRecoveryStore.expireRecoveryRun({ runId: run.id, queryable }); return null; }
    return run;
  }
  async function beginLifecycle(queryable) {
    const locks = await maintenanceLockService.listActiveMaintenanceLocks({
      lockTypes: ['restore', 'upgrade', 'admin_recovery'], queryable, lockForTransaction: true,
    });
    await adminRecoveryStore.lockOperatorLifecycle({ queryable });
    return locks;
  }
  const audit = (event, queryable) => recordAuditEventFn({ actorType: 'system', entityType: 'admin_recovery_run', ...event }, queryable);
  async function armBootstrapAdminRecovery({ ttlMinutes = 15, reason = null, force = false } = {}) {
    const outcome = await withTransactionFn(async queryable => {
      if ((await beginLifecycle(queryable)).length) {
        return { error: createApiError(409, 'RECOVERY_LOCK_CONFLICT', 'Cannot arm recovery while conflicting maintenance locks are active') };
      }
      const existing = await readActive(queryable);
      if (existing && !force) return { error: createApiError(409, 'RECOVERY_ALREADY_ARMED', 'Bootstrap-admin recovery is already armed') };
      if (existing) {
        const cancelled = await adminRecoveryStore.cancelRecoveryRun({ runId: existing.id, reason: 'replaced_by_force_arm', queryable });
        if (!cancelled) throw createApiError(409, 'RECOVERY_ALREADY_ARMED', 'Recovery run changed before replacement');
        await audit({ eventType: 'bootstrap_admin_recovery_cancelled', summary: 'Previous armed recovery run cancelled by force re-arm',
          entityId: existing.id, details: { replacedByForceArm: true } }, queryable);
      }
      const plaintextCode = generateRecoveryCodeFn();
      const run = await adminRecoveryStore.insertRecoveryRun({ armedVia: 'harmoniarrctl', ttlMinutes: clampTtlMinutesFn(ttlMinutes),
        maxAttempts: 5, reason, recoveryCodeHash: hashRecoveryCodeFn(plaintextCode), queryable });
      await audit({ eventType: 'bootstrap_admin_recovery_armed', summary: 'Bootstrap-admin recovery armed', entityId: run.id,
        details: { armedVia: 'harmoniarrctl', expiresAt: run.expiresAt, reason: reason ?? null } }, queryable);
      return { expiresAt: run.expiresAt, recoveryCode: plaintextCode, runId: run.id, replacedExistingRun: existing !== null, status: 'armed' };
    });
    if (outcome.error) throw outcome.error;
    return outcome;
  }
  async function cancelBootstrapAdminRecovery({ force = false, reason = null } = {}) {
    const outcome = await withTransactionFn(async queryable => {
      await beginLifecycle(queryable); // Disarming remains allowed under a maintenance hold.
      const active = await readActive(queryable);
      if (!active) return { error: createApiError(404, 'RECOVERY_NOT_ARMED', 'No active recovery run exists') };
      if (!force) return { error: createApiError(409, 'RECOVERY_FORCE_REQUIRED', 'Use --force to cancel an active recovery run') };
      const cancelled = await adminRecoveryStore.cancelRecoveryRun({ runId: active.id, reason, queryable });
      if (!cancelled) throw createApiError(404, 'RECOVERY_NOT_ARMED', 'No active recovery run exists');
      await audit({ eventType: 'bootstrap_admin_recovery_cancelled', summary: 'Bootstrap-admin recovery cancelled', entityId: active.id,
        details: { cancelledAt: cancelled.cancelledAt, reason: reason ?? null } }, queryable);
      return { cancelledAt: cancelled.cancelledAt, runId: cancelled.id, status: 'cancelled' };
    });
    if (outcome.error) throw outcome.error;
    return outcome;
  }
  return { armBootstrapAdminRecovery, cancelBootstrapAdminRecovery };
}
