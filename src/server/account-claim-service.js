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

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { findUserByLoginIdentifier, createApiError } from './auth.js';
import { recordAuditEvent } from './audit.js';
import { createAccountClaimStore } from './account-claim-store.js';
import { getPool } from './database.js';
import { hashPassword, hashToken } from './security.js';
import { validatePassword } from './validators/auth-validator.js';

const CLAIM_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CLAIM_CODE_PREFIX = 'HCLM';
const CLAIM_CODE_SEGMENTS = 3;
const CLAIM_CODE_SEGMENT_LENGTH = 4;
const DEFAULT_TTL_MINUTES = 60;
const MIN_TTL_MINUTES = 5;
const MAX_TTL_MINUTES = 24 * 60;

function normalizeUserId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'User id must be a non-empty string');
  }

  return value.trim();
}

function normalizeClaimCode(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return trimmed.length > 0 ? trimmed : null;
}

function clampTtlMinutes(ttlMinutes) {
  const parsed = Number(ttlMinutes);
  if (!Number.isFinite(parsed) || parsed < MIN_TTL_MINUTES) {
    return DEFAULT_TTL_MINUTES;
  }

  return Math.min(parsed, MAX_TTL_MINUTES);
}

function createClaimInvalidError() {
  return createApiError(401, 'app_user_claim_invalid_or_expired', 'Claim code or user identity is incorrect');
}

async function readFallbackUserById(getPoolFn, userId) {
  const result = await getPoolFn().query('SELECT id, username, is_disabled FROM app_users WHERE id = $1 LIMIT 1', [userId]);
  const row = result.rows[0] ?? null;

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    isDisabled: row.is_disabled,
    username: row.username,
  };
}

function generateClaimCode() {
  const segments = [];
  for (let segmentIndex = 0; segmentIndex < CLAIM_CODE_SEGMENTS; segmentIndex += 1) {
    const bytes = randomBytes(CLAIM_CODE_SEGMENT_LENGTH);
    let segment = '';
    for (let index = 0; index < CLAIM_CODE_SEGMENT_LENGTH; index += 1) {
      segment += CLAIM_CODE_CHARSET[bytes[index] % CLAIM_CODE_CHARSET.length];
    }
    segments.push(segment);
  }

  return `${CLAIM_CODE_PREFIX}-${segments.join('-')}`;
}

function hashClaimCode(code) {
  const normalizedCode = normalizeClaimCode(code);
  return normalizedCode ? hashToken(normalizedCode) : null;
}

function verifyClaimCode(submittedCode, storedHash) {
  const submittedHash = hashClaimCode(submittedCode);
  if (!submittedHash || typeof storedHash !== 'string' || storedHash.length === 0) {
    return false;
  }

  const submittedBuffer = Buffer.from(submittedHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');
  if (submittedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return timingSafeEqual(submittedBuffer, storedBuffer);
}

export function createAccountClaimService({
  accountClaimStore = createAccountClaimStore(),
  createClaimCodeFn = generateClaimCode,
  findUserByLoginIdentifierFn = findUserByLoginIdentifier,
  getAppUserByIdFn = null,
  getPoolFn = getPool,
  hashPasswordFn = hashPassword,
  recordAuditEventFn = recordAuditEvent,
  validatePasswordFn = validatePassword,
} = {}) {
  async function issueClaimCode({ actorUserId, requestMetadata, ttlMinutes = DEFAULT_TTL_MINUTES, userId }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedUserId = normalizeUserId(userId);
    const user = getAppUserByIdFn
      ? await getAppUserByIdFn({ userId: normalizedUserId })
      : await readFallbackUserById(getPoolFn, normalizedUserId);

    if (!user) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    if (user.isDisabled) {
      throw createApiError(409, 'app_user_claim_unavailable', 'Disabled users cannot receive claim codes');
    }

    const claimCode = createClaimCodeFn();
    const claimCodeHash = hashClaimCode(claimCode);
    const expiresAt = new Date(Date.now() + clampTtlMinutes(ttlMinutes) * 60 * 1000);
    const client = await getPoolFn().connect();

    try {
      await client.query('BEGIN');
      const revokedClaimCount = await accountClaimStore.revokeActiveClaimCodesForUser({
        client,
        reason: 'reissued',
        userId: normalizedUserId,
      });
      const claim = await accountClaimStore.insertClaimCode({
        appUserId: normalizedUserId,
        claimCodeHash,
        client,
        expiresAt,
        issuedByUserId: normalizedActorUserId,
      });
      await client.query('COMMIT');

      await recordAuditEventFn({
        actorUserId: normalizedActorUserId,
        actorType: 'user',
        details: {
          expiresAt: claim.expiresAt,
          revokedClaimCount,
          username: user.username,
        },
        entityId: user.id,
        entityType: 'app_user',
        eventType: 'app_user_claim_code_issued',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'App user claim code issued',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      return {
        claimCode,
        expiresAt: claim.expiresAt,
        replacedExistingClaim: revokedClaimCount > 0,
        user,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function completeClaim({ claimCode, password, requestMetadata, username }) {
    const validatedPassword = validatePasswordFn(password);
    const user = await findUserByLoginIdentifierFn(username);
    if (!user || user.is_disabled) {
      throw createClaimInvalidError();
    }

    const client = await getPoolFn().connect();

    try {
      await client.query('BEGIN');

      const activeClaim = await accountClaimStore.getActiveClaimForUser({
        client,
        lockForUpdate: true,
        userId: user.id,
      });
      if (!activeClaim || !verifyClaimCode(claimCode, activeClaim.claimCodeHash)) {
        throw createClaimInvalidError();
      }

      const passwordHash = await hashPasswordFn(validatedPassword);
      const updatedUserResult = await client.query(
        `
          UPDATE app_users
          SET password_hash = $2,
              must_change_password = FALSE,
              password_changed_at = NOW(),
              updated_at = NOW(),
              failed_login_count = 0,
              locked_until = NULL
          WHERE id = $1
          RETURNING *
        `,
        [user.id, passwordHash],
      );
      const updatedUser = updatedUserResult.rows[0] ?? null;
      if (!updatedUser) {
        throw createClaimInvalidError();
      }

      const revokedSessionsResult = await client.query(
        `
          UPDATE refresh_tokens
          SET is_revoked = TRUE,
              revoked_at = NOW(),
              revoked_reason = 'account_claim_completed'
          WHERE app_user_id = $1
            AND is_revoked = FALSE
        `,
        [user.id],
      );
      await accountClaimStore.consumeClaimCode({ claimId: activeClaim.id, client });
      await client.query('COMMIT');

      await recordAuditEventFn({
        actorUserId: updatedUser.id,
        actorType: 'user',
        details: {
          revokedSessionCount: revokedSessionsResult.rowCount ?? 0,
          username: updatedUser.username,
        },
        entityId: updatedUser.id,
        entityType: 'app_user',
        eventType: 'app_user_claim_completed',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'App user claim completed',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      return {
        requiresLogin: true,
        username: updatedUser.username,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    completeClaim,
    issueClaimCode,
  };
}

export {
  DEFAULT_TTL_MINUTES as defaultAccountClaimTtlMinutes,
  MAX_TTL_MINUTES as maxAccountClaimTtlMinutes,
  MIN_TTL_MINUTES as minAccountClaimTtlMinutes,
  generateClaimCode,
  hashClaimCode,
  verifyClaimCode,
};