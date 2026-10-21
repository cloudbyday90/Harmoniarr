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
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { getPool } from '../database.js';
import { hashPassword } from '../security.js';
import { normalizeUsername, validatePassword } from '../validators/auth-validator.js';
import { createAdminRecoveryAccountStore } from './admin-recovery-account-store.js';
import { createAdminRecoveryCompletionService } from './admin-recovery-completion-service.js';
import { createAdminRecoveryOperatorService } from './admin-recovery-operator-service.js';
import { createAdminRecoveryStore } from './admin-recovery-store.js';
import { createMaintenanceLockService } from './maintenance-lock-service.js';

const RECOVERY_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RECOVERY_CODE_SEGMENTS = 3;
const RECOVERY_CODE_SEGMENT_LENGTH = 4;
const DEFAULT_TTL_MINUTES = 15;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 30;

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

  const { armBootstrapAdminRecovery, cancelBootstrapAdminRecovery } = createAdminRecoveryOperatorService({
    adminRecoveryStore, maintenanceLockService, withTransactionFn, recordAuditEventFn,
    generateRecoveryCodeFn: generateRecoveryCode, hashRecoveryCodeFn: hashRecoveryCode,
    clampTtlMinutesFn: clampTtlMinutes,
  });

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
