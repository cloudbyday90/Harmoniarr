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
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { getPool } from '../database.js';
import { hashPassword } from '../security.js';
import { normalizeUsername, validatePassword } from '../validators/auth-validator.js';
import { createAdminRecoveryAccountStore } from './admin-recovery-account-store.js';
import { createAdminRecoveryCompletionService } from './admin-recovery-completion-service.js';
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
  getPoolFn = getPool,
  adminRecoveryStore = createAdminRecoveryStore({ getPoolFn }),
  recoveryAccountStore = createAdminRecoveryAccountStore(),
  withTransactionFn = createDatabaseTransactionRunner({ getPoolFn }),
  maintenanceLockService = createMaintenanceLockService({ getPoolFn }),
  recordAuditEventFn = recordAuditEvent,
  hashPasswordFn = hashPassword,
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

  const { completeBootstrapAdminRecovery } = createAdminRecoveryCompletionService({
    adminRecoveryStore, recoveryAccountStore, maintenanceLockService, recordAuditEventFn,
    withTransactionFn, hashPasswordFn, normalizeUsernameFn, validatePasswordFn,
    verifyRecoveryCodeFn: verifyRecoveryCode,
  });

  return {
    armBootstrapAdminRecovery,
    cancelBootstrapAdminRecovery,
    completeBootstrapAdminRecovery,
    getBootstrapAdminRecoveryStatus,
  };
}

export { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode };
