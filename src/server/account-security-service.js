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
  revokeRefreshToken,
} from './auth.js';
import { getPool } from './database.js';
import { createPasswordChangeService } from './password-change-service.js';

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
  passwordChangeService = createPasswordChangeService(),
  recordAuditEventFn = recordAuditEvent,
  revokeRefreshTokenFn = revokeRefreshToken,
} = {}) {
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

  async function adminRevokeUserSession({ adminUserId, refreshTokenId, requestMetadata }) {
    const tokenResult = await getPoolFn().query(
      `
        SELECT rt.id, rt.app_user_id, u.username
        FROM refresh_tokens rt
        JOIN app_users u ON u.id = rt.app_user_id
        WHERE rt.id = $1
          AND rt.is_revoked = FALSE
          AND rt.expires_at > NOW()
        LIMIT 1
      `,
      [refreshTokenId],
    );

    if (!tokenResult.rows[0]) {
      throw createApiError(404, 'session_not_found', 'The requested session was not found');
    }

    const targetUserId = tokenResult.rows[0].app_user_id;
    const targetUsername = tokenResult.rows[0].username;

    await revokeRefreshTokenFn(refreshTokenId, 'admin_revoked');
    await recordAuditEventFn({
      actorUserId: adminUserId,
      actorType: 'admin',
      details: {
        targetSessionId: refreshTokenId,
        targetUserId,
        targetUsername,
      },
      entityId: refreshTokenId,
      entityType: 'refresh_token',
      eventType: 'admin_session_revoked',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Admin revoked a session for user "${targetUsername}"`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      revokedSessionId: refreshTokenId,
      targetUserId,
      targetUsername,
    };
  }

  async function adminRevokeAllUserSessions({ adminUserId, requestMetadata, targetUserId }) {
    const userResult = await getPoolFn().query(
      'SELECT username FROM app_users WHERE id = $1 LIMIT 1',
      [targetUserId],
    );

    if (!userResult.rows[0]) {
      throw createApiError(404, 'user_not_found', 'Target user not found');
    }

    const targetUsername = userResult.rows[0].username;

    const revokedSessionCount = await revokeAllUserSessions(targetUserId, 'admin_revoked');
    await recordAuditEventFn({
      actorUserId: adminUserId,
      actorType: 'admin',
      details: {
        revokedSessionCount,
        targetUserId,
        targetUsername,
      },
      entityId: targetUserId,
      entityType: 'app_user',
      eventType: 'admin_sessions_revoked',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: `Admin revoked all sessions for user "${targetUsername}" (${revokedSessionCount} session${revokedSessionCount === 1 ? '' : 's'})`,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      revokedSessionCount,
      targetUserId,
      targetUsername,
    };
  }

  return {
    adminRevokeAllUserSessions,
    adminRevokeUserSession,
    changePassword: passwordChangeService.changePassword,
    listActiveSessions,
    listRecentActivity,
    revokeSession,
  };
}