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

import { createAuditReadService } from './audit-read-service.js';
import { recordAuditEvent } from './audit.js';
import {
  createApiError,
  issueSession,
  revokeRefreshToken,
} from './auth.js';
import { getPool } from './database.js';
import { hashPassword, verifyPassword } from './security.js';
import { validatePassword } from './validators/auth-validator.js';

function toActiveSession(row, currentRefreshTokenId) {
  return {
    expiresAt: row.expires_at,
    id: row.id,
    isCurrent: row.id === currentRefreshTokenId,
    issuedAt: row.issued_at,
    issuedIp: row.issued_ip,
    issuedUserAgent: row.issued_user_agent,
    lastUsedAt: row.last_used_at,
  };
}

export function createAccountSecurityService({
  auditReadService = createAuditReadService(),
  getPoolFn = getPool,
  hashPasswordFn = hashPassword,
  issueSessionFn = issueSession,
  recordAuditEventFn = recordAuditEvent,
  revokeRefreshTokenFn = revokeRefreshToken,
  validatePasswordFn = validatePassword,
  verifyPasswordFn = verifyPassword,
} = {}) {
  async function getUserById(userId) {
    const result = await getPoolFn().query('SELECT * FROM app_users WHERE id = $1 LIMIT 1', [userId]);
    return result.rows[0] ?? null;
  }

  async function revokeAllUserSessions(appUserId, revokedReason) {
    const result = await getPoolFn().query(
      `
        UPDATE refresh_tokens
        SET is_revoked = TRUE,
            revoked_at = NOW(),
            revoked_reason = $2
        WHERE app_user_id = $1
          AND is_revoked = FALSE
      `,
      [appUserId, revokedReason],
    );

    return result.rowCount ?? 0;
  }

  async function listActiveSessions({ session }) {
    const result = await getPoolFn().query(
      `
        SELECT
          id,
          issued_at,
          issued_ip,
          issued_user_agent,
          last_used_at,
          expires_at
        FROM refresh_tokens
        WHERE app_user_id = $1
          AND is_revoked = FALSE
          AND expires_at > NOW()
        ORDER BY issued_at DESC
      `,
      [session.appUserId],
    );

    const sessions = result.rows.map((row) => toActiveSession(row, session.refreshTokenId));
    sessions.sort((left, right) => Number(right.isCurrent) - Number(left.isCurrent));
    return sessions;
  }

  async function listRecentActivity({ limit = 10, session }) {
    return auditReadService.listRecentAuditEvents({
      actorUserId: session.appUserId,
      limit,
    });
  }

  async function revokeSession({ requestMetadata, refreshTokenId, session }) {
    if (refreshTokenId === session.refreshTokenId) {
      throw createApiError(400, 'current_session_revoke_unsupported', 'Use logout to end the current session');
    }

    const result = await getPoolFn().query(
      `
        SELECT id
        FROM refresh_tokens
        WHERE id = $1
          AND app_user_id = $2
          AND is_revoked = FALSE
          AND expires_at > NOW()
        LIMIT 1
      `,
      [refreshTokenId, session.appUserId],
    );

    if (!result.rows[0]) {
      throw createApiError(404, 'session_not_found', 'The requested session was not found');
    }

    await revokeRefreshTokenFn(refreshTokenId, 'user_revoked');
    await recordAuditEventFn({
      actorUserId: session.appUserId,
      actorType: 'user',
      entityId: refreshTokenId,
      entityType: 'refresh_token',
      eventType: 'session_revoked',
      summary: 'User revoked an active session',
      details: {
        revokedSessionId: refreshTokenId,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      revokedSessionId: refreshTokenId,
    };
  }

  async function changePassword({ currentPassword, newPassword, requestMetadata, session }) {
    const user = await getUserById(session.appUserId);
    if (!user || user.is_disabled) {
      throw createApiError(401, 'auth_required', 'Authentication is required');
    }

    const validatedCurrentPassword = validatePasswordFn(currentPassword);
    const validatedNewPassword = validatePasswordFn(newPassword);

    if (!await verifyPasswordFn(validatedCurrentPassword, user.password_hash)) {
      throw createApiError(401, 'current_password_invalid', 'Current password is incorrect');
    }

    if (await verifyPasswordFn(validatedNewPassword, user.password_hash)) {
      throw createApiError(400, 'validation_error', 'New password must be different from the current password');
    }

    const passwordHash = await hashPasswordFn(validatedNewPassword);
    const updateResult = await getPoolFn().query(
      `
        UPDATE app_users
        SET password_hash = $2,
            must_change_password = FALSE,
            password_changed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [session.appUserId, passwordHash],
    );

    const updatedUser = updateResult.rows[0];
    const revokedSessionCount = await revokeAllUserSessions(session.appUserId, 'password_changed');
    const issuedSession = await issueSessionFn({
      requestMetadata,
      userId: session.appUserId,
    });

    await recordAuditEventFn({
      actorUserId: session.appUserId,
      actorType: 'user',
      entityId: session.appUserId,
      entityType: 'app_user',
      eventType: 'password_changed',
      summary: 'User password changed',
      details: {
        revokedSessionCount,
      },
      ipAddress: requestMetadata?.ipAddress ?? null,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      issuedSession,
      user: updatedUser,
    };
  }

  return {
    changePassword,
    listActiveSessions,
    listRecentActivity,
    revokeSession,
  };
}