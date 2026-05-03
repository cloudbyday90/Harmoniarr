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

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { recordAuditEvent } from '../audit.js';
import { createApiError, findUserByUsername } from '../auth.js';
import { getPool } from '../database.js';
import { hashPassword } from '../security.js';
import { normalizeUsername, validatePassword } from '../validators/auth-validator.js';
import { createAdminRecoveryStore } from './admin-recovery-store.js';
import { createMaintenanceLockService } from './maintenance-lock-service.js';

const RECOVERY_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_SEGMENTS = 3;
const RECOVERY_CODE_SEGMENT_LENGTH = 4;
const DEFAULT_TTL_MINUTES = 15;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 30;
const DEFAULT_MAX_ATTEMPTS = 5;

function generateRecoveryCode() {
  const segments = [];
  for (let s = 0; s < RECOVERY_CODE_SEGMENTS; s++) {
    let segment = '';
    const bytes = randomBytes(RECOVERY_CODE_SEGMENT_LENGTH);
    for (let i = 0; i < RECOVERY_CODE_SEGMENT_LENGTH; i++) {
      segment += RECOVERY_CODE_CHARSET[bytes[i] % RECOVERY_CODE_CHARSET.length];
    }
    segments.push(segment);
  }
  return `HARM-${segments.join('-')}`;
}

function hashRecoveryCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

function verifyRecoveryCode(submittedCode, storedHash) {
  const submittedHash = hashRecoveryCode(submittedCode);
  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (submittedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(submittedBuffer, storedBuffer);
}

function clampTtlMinutes(ttlMinutes) {
  const parsed = Number(ttlMinutes);
  if (!Number.isFinite(parsed) || parsed < MIN_TTL_MINUTES) {
    return DEFAULT_TTL_MINUTES;
  }
  return Math.min(parsed, MAX_TTL_MINUTES);
}

export function createAdminRecoveryService({
  adminRecoveryStore = createAdminRecoveryStore(),
  maintenanceLockService = createMaintenanceLockService(),
  recordAuditEventFn = recordAuditEvent,
  getPoolFn = getPool,
  hashPasswordFn = hashPassword,
  findUserByUsernameFn = findUserByUsername,
  normalizeUsernameFn = normalizeUsername,
  validatePasswordFn = validatePassword,
} = {}) {
  async function expireStaleRuns() {
    return adminRecoveryStore.expireStaleArmedRuns();
  }

  async function armBootstrapAdminRecovery({
    ttlMinutes = DEFAULT_TTL_MINUTES,
    reason = null,
    force = false,
  } = {}) {
    await expireStaleRuns();

    const existingActive = await adminRecoveryStore.getActiveArmedRun();
    if (existingActive) {
      if (!force) {
        throw createApiError(409, 'RECOVERY_ALREADY_ARMED', 'Bootstrap-admin recovery is already armed');
      }

      await adminRecoveryStore.cancelRecoveryRun({
        reason: 'replaced_by_force_arm',
        runId: existingActive.id,
      });

      await recordAuditEventFn({
        actorType: 'system',
        eventType: 'bootstrap_admin_recovery_cancelled',
        summary: 'Previous armed recovery run cancelled by force re-arm',
        entityType: 'admin_recovery_run',
        entityId: existingActive.id,
        details: {
          replacedByForceArm: true,
        },
      });
    }

    const activeLocks = await maintenanceLockService.listActiveMaintenanceLocks({
      lockTypes: ['restore', 'upgrade', 'admin_recovery'],
    });

    if (activeLocks.length > 0) {
      throw createApiError(409, 'RECOVERY_LOCK_CONFLICT', 'Cannot arm recovery while conflicting maintenance locks are active');
    }

    const plaintextCode = generateRecoveryCode();
    const codeHash = hashRecoveryCode(plaintextCode);
    const clampedTtl = clampTtlMinutes(ttlMinutes);
    const expiresAt = new Date(Date.now() + clampedTtl * 60 * 1000);

    const run = await adminRecoveryStore.insertRecoveryRun({
      armedVia: 'harmoniarrctl',
      expiresAt,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      reason,
      recoveryCodeHash: codeHash,
    });

    await recordAuditEventFn({
      actorType: 'system',
      eventType: 'bootstrap_admin_recovery_armed',
      summary: 'Bootstrap-admin recovery armed',
      entityType: 'admin_recovery_run',
      entityId: run.id,
      details: {
        armedVia: 'harmoniarrctl',
        expiresAt: run.expiresAt,
        reason: reason ?? null,
      },
    });

    return {
      expiresAt: run.expiresAt,
      recoveryCode: plaintextCode,
      runId: run.id,
      replacedExistingRun: existingActive !== null,
      status: 'armed',
    };
  }

  async function getBootstrapAdminRecoveryStatus() {
    await expireStaleRuns();

    const activeRun = await adminRecoveryStore.getActiveArmedRun();
    if (!activeRun) {
      return {
        recoveryAvailable: false,
      };
    }

    const blockingLocks = await maintenanceLockService.listActiveMaintenanceLocks({
      lockTypes: ['restore', 'upgrade'],
    });

    return {
      armedVia: activeRun.armedVia,
      blockedByLock: blockingLocks.length > 0,
      expiresAt: activeRun.expiresAt,
      maxAttempts: activeRun.maxAttempts,
      recoveryAvailable: true,
      remainingAttempts: Math.max(0, activeRun.maxAttempts - activeRun.invalidAttemptCount),
      runId: activeRun.id,
      status: activeRun.status,
    };
  }

  async function cancelBootstrapAdminRecovery({
    force = false,
    reason = null,
  } = {}) {
    await expireStaleRuns();

    const activeRun = await adminRecoveryStore.getActiveArmedRun();
    if (!activeRun) {
      throw createApiError(404, 'RECOVERY_NOT_ARMED', 'No active recovery run exists');
    }

    if (!force) {
      throw createApiError(409, 'RECOVERY_FORCE_REQUIRED', 'Use --force to cancel an active recovery run');
    }

    const cancelled = await adminRecoveryStore.cancelRecoveryRun({
      reason,
      runId: activeRun.id,
    });

    await recordAuditEventFn({
      actorType: 'system',
      eventType: 'bootstrap_admin_recovery_cancelled',
      summary: 'Bootstrap-admin recovery cancelled',
      entityType: 'admin_recovery_run',
      entityId: activeRun.id,
      details: {
        cancelledAt: cancelled.cancelledAt,
        reason: reason ?? null,
      },
    });

    return {
      cancelledAt: cancelled.cancelledAt,
      runId: cancelled.id,
      status: 'cancelled',
    };
  }

  async function completeBootstrapAdminRecovery({
    recoveryCode,
    username,
    password,
    confirmPassword,
    requestMetadata = null,
  } = {}) {
    await expireStaleRuns();

    if (typeof recoveryCode !== 'string' || recoveryCode.trim().length < 1) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Recovery code is required');
    }

    if (typeof username !== 'string' || username.trim().length < 1) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Username is required');
    }

    const validatedPassword = validatePasswordFn(password);
    if (validatedPassword !== confirmPassword) {
      throw createApiError(400, 'RECOVERY_INVALID_ARGUMENT', 'Password and confirmation do not match');
    }

    const activeRun = await adminRecoveryStore.getActiveArmedRun();
    if (!activeRun) {
      throw createApiError(401, 'RECOVERY_NOT_ARMED', 'No active recovery run exists');
    }

    if (new Date(activeRun.expiresAt).getTime() <= Date.now()) {
      await adminRecoveryStore.expireStaleArmedRuns();
      throw createApiError(401, 'RECOVERY_CODE_INVALID_OR_EXPIRED', 'Recovery code is invalid or expired');
    }

    const blockingLocks = await maintenanceLockService.listActiveMaintenanceLocks({
      lockTypes: ['restore', 'upgrade'],
    });

    if (blockingLocks.length > 0) {
      throw createApiError(409, 'RECOVERY_LOCK_CONFLICT', 'Recovery cannot complete while conflicting maintenance locks are active');
    }

    if (!verifyRecoveryCode(recoveryCode, activeRun.recoveryCodeHash)) {
      const updated = await adminRecoveryStore.incrementInvalidAttemptCount({ runId: activeRun.id });

      if (updated && updated.invalidAttemptCount >= updated.maxAttempts) {
        await adminRecoveryStore.invalidateRecoveryRun({
          reason: 'max_attempts_reached',
          runId: activeRun.id,
        });

        await recordAuditEventFn({
          actorType: 'anonymous',
          eventType: 'bootstrap_admin_recovery_invalidated',
          summary: 'Bootstrap-admin recovery invalidated after too many invalid attempts',
          entityType: 'admin_recovery_run',
          entityId: activeRun.id,
          details: {
            invalidAttemptCount: updated.invalidAttemptCount,
          },
          ipAddress: requestMetadata?.ipAddress ?? null,
          userAgent: requestMetadata?.userAgent ?? null,
        });

        throw createApiError(429, 'RECOVERY_ATTEMPT_THRESHOLD_REACHED', 'Too many invalid attempts');
      }

      throw createApiError(401, 'RECOVERY_CODE_INVALID_OR_EXPIRED', 'Recovery code is invalid or expired');
    }

    const lock = await maintenanceLockService.acquireMaintenanceLock({
      lockType: 'admin_recovery',
      reason: 'bootstrap_admin_recovery',
    });

    let createdAdminUserId;

    try {
      const normalizedUsername = normalizeUsernameFn(username);
      const passwordHash = await hashPasswordFn(validatedPassword);

      const existingUser = await findUserByUsernameFn(normalizedUsername);

      if (existingUser) {
        await getPoolFn().query(
          `
            UPDATE app_users
            SET password_hash = $2,
                role = 'admin',
                is_disabled = FALSE,
                must_change_password = FALSE,
                password_changed_at = NOW(),
                failed_login_count = 0,
                locked_until = NULL,
                updated_at = NOW()
            WHERE id = $1
          `,
          [existingUser.id, passwordHash],
        );
        createdAdminUserId = existingUser.id;
      } else {
        const insertResult = await getPoolFn().query(
          `
            INSERT INTO app_users (username, password_hash, role, password_changed_at)
            VALUES ($1, $2, 'admin', NOW())
            RETURNING id
          `,
          [normalizedUsername, passwordHash],
        );
        createdAdminUserId = insertResult.rows[0].id;
      }

      const revokedSessionCount = await adminRecoveryStore.revokeAllInteractiveSessions({
        revokedReason: 'admin_recovery',
      });

      await adminRecoveryStore.completeRecoveryRun({
        completedFromIp: requestMetadata?.ipAddress ?? null,
        completedUserAgent: requestMetadata?.userAgent ?? null,
        createdAdminUserId,
        runId: activeRun.id,
      });

      await recordAuditEventFn({
        actorType: 'system',
        eventType: 'bootstrap_admin_recovery_completed',
        summary: 'Bootstrap-admin recovery completed',
        entityType: 'admin_recovery_run',
        entityId: activeRun.id,
        details: {
          completedAt: new Date().toISOString(),
          createdAdminUserId,
        },
        ipAddress: requestMetadata?.ipAddress ?? null,
        userAgent: requestMetadata?.userAgent ?? null,
      });

      await recordAuditEventFn({
        actorType: 'system',
        eventType: 'sessions_revoked_after_recovery',
        summary: 'All interactive sessions revoked after bootstrap-admin recovery',
        entityType: 'admin_recovery_run',
        entityId: activeRun.id,
        details: {
          revokedSessionCount,
        },
        ipAddress: requestMetadata?.ipAddress ?? null,
        userAgent: requestMetadata?.userAgent ?? null,
      });
    } finally {
      await maintenanceLockService.releaseMaintenanceLock({ lockId: lock.id });
    }

    return {
      recoveryChecklist: [
        'Log in with the recovered admin account',
        'Review existing admin users',
        'Rotate or revoke API keys if compromise is suspected',
      ],
      requiresLogin: true,
      runId: activeRun.id,
      success: true,
    };
  }

  return {
    armBootstrapAdminRecovery,
    cancelBootstrapAdminRecovery,
    completeBootstrapAdminRecovery,
    getBootstrapAdminRecoveryStatus,
  };
}

export { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode };
