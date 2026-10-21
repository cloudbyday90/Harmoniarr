/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../auth.js';

const invalidCode = () => createApiError(401, 'RECOVERY_CODE_INVALID_OR_EXPIRED', 'Recovery code is invalid or expired');
const notArmed = () => createApiError(401, 'RECOVERY_NOT_ARMED', 'No active recovery run exists');
const lockConflict = () => createApiError(409, 'RECOVERY_LOCK_CONFLICT', 'Recovery cannot complete while conflicting maintenance locks are active');

export function createAdminRecoveryCompletionService({ adminRecoveryStore, recoveryAccountStore,
  maintenanceLockService, recordAuditEventFn, withTransactionFn, hashPasswordFn,
  normalizeUsernameFn, validatePasswordFn, verifyRecoveryCodeFn }) {
  async function completeBootstrapAdminRecovery({ recoveryCode, username, password, confirmPassword, requestMetadata = null } = {}) {
    if (typeof recoveryCode !== 'string' || recoveryCode.trim().length < 1) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Recovery code is required');
    }
    if (typeof username !== 'string' || username.trim().length < 1) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Username is required');
    }
    const normalizedUsername = normalizeUsernameFn(username);
    const validatedPassword = validatePasswordFn(password);
    if (validatedPassword !== confirmPassword) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Password and confirmation do not match');
    }
    await adminRecoveryStore.expireStaleArmedRuns();
    const observed = await adminRecoveryStore.getActiveArmedRun();
    if (!observed) throw notArmed();
    const blockers = { lockTypes: ['restore', 'upgrade'] };
    if ((await maintenanceLockService.listActiveMaintenanceLocks(blockers)).length) throw lockConflict();
    // Preparation grants no write authority. Everything is checked again under
    // the original run's row lock; hashing does not occupy a transaction client.
    const passwordHash = verifyRecoveryCodeFn(recoveryCode, observed.recoveryCodeHash)
      ? await hashPasswordFn(validatedPassword) : null;
    let lock; let failed = false; let failure; let outcome;
    try {
      if (passwordHash) lock = await maintenanceLockService.acquireMaintenanceLock({ lockType: 'admin_recovery', reason: 'bootstrap_admin_recovery' });
      outcome = await withTransactionFn(async queryable => {
        if ((await maintenanceLockService.listActiveMaintenanceLocks({ ...blockers, queryable, lockForTransaction: true })).length) throw lockConflict();
        const run = await adminRecoveryStore.getRecoveryRunById({ runId: observed.id, queryable, lockForTransaction: true });
        if (!run || run.status !== 'armed') return { error: notArmed() };
        if (run.isExpired) {
          await adminRecoveryStore.expireRecoveryRun({ runId: run.id, queryable });
          return { error: invalidCode() };
        }
        const audit = event => recordAuditEventFn({ entityType: 'admin_recovery_run', entityId: run.id,
          ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null, ...event }, queryable);
        if (!verifyRecoveryCodeFn(recoveryCode, run.recoveryCodeHash) || run.invalidAttemptCount >= run.maxAttempts) {
          const updated = run.invalidAttemptCount >= run.maxAttempts ? run
            : await adminRecoveryStore.incrementInvalidAttemptCount({ runId: run.id, queryable });
          if (!updated) throw notArmed();
          if (updated.invalidAttemptCount >= updated.maxAttempts) {
            await adminRecoveryStore.invalidateRecoveryRun({ reason: 'max_attempts_reached', runId: run.id, queryable });
            await audit({ actorType: 'anonymous', eventType: 'bootstrap_admin_recovery_invalidated',
              summary: 'Bootstrap-admin recovery invalidated after too many invalid attempts', details: { invalidAttemptCount: updated.invalidAttemptCount } });
            return { error: createApiError(429, 'RECOVERY_ATTEMPT_THRESHOLD_REACHED', 'Too many invalid attempts') };
          }
          return { error: invalidCode() };
        }
        if (!passwordHash) throw invalidCode();
        const createdAdminUserId = await recoveryAccountStore.upsertAdminAccount({ username: normalizedUsername, passwordHash, queryable });
        const revokedSessionCount = await adminRecoveryStore.revokeAllInteractiveSessions({ revokedReason: 'admin_recovery', queryable });
        const consumed = await adminRecoveryStore.completeRecoveryRun({ runId: run.id, createdAdminUserId,
          completedFromIp: requestMetadata?.ipAddress ?? null, completedUserAgent: requestMetadata?.userAgent ?? null, queryable });
        if (!consumed) throw invalidCode(); // Roll back account and session changes too.
        await audit({ actorType: 'system', eventType: 'bootstrap_admin_recovery_completed', summary: 'Bootstrap-admin recovery completed',
          details: { completedAt: consumed.completedAt, createdAdminUserId } });
        await audit({ actorType: 'system', eventType: 'sessions_revoked_after_recovery', summary: 'All interactive sessions revoked after bootstrap-admin recovery',
          details: { revokedSessionCount } });
        return { recoveryChecklist: ['Log in with the recovered admin account', 'Review existing admin users', 'Rotate or revoke API keys if compromise is suspected'],
          requiresLogin: true, runId: run.id, success: true };
      });
      // Business refusals commit budget/expiry changes before reaching the caller.
      if (outcome.error) { failed = true; failure = outcome.error; }
    } catch (error) { failed = true; failure = error; }
    if (lock) {
      try { await maintenanceLockService.releaseMaintenanceLock({ lockId: lock.id }); }
      catch (error) { if (!failed) { failed = true; failure = error; } }
    }
    if (failed) throw failure;
    return outcome;
  }
  return { completeBootstrapAdminRecovery };
}
