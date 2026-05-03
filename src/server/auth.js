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

import { randomUUID } from 'node:crypto';
import { getPool } from './database.js';
import {
  csrfProtectionModeEnvVar,
  csrfProtectionModes,
  resolveCsrfProtectionMode,
  resolveSecureCookiesEnabled,
} from './deployment-security-service.js';
import {
  hashPassword,
  hashToken,
  createOpaqueToken,
  parseCookieHeader,
  serializeCookie,
  verifyPassword,
} from './security.js';
export { csrfProtectionModeEnvVar, csrfProtectionModes, resolveCsrfProtectionMode };
import { recordAuditEvent } from './audit.js';
import { normalizeUsername, validatePassword } from './validators/auth-validator.js';

const refreshCookieName = 'harmoniarr_refresh';
const csrfCookieName = 'harmoniarr_csrf';
const refreshTokenMaxAgeSeconds = 60 * 60 * 24 * 14;

export function createApiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function getRequestMetadata(request) {
  const forwarded = request.headers['x-forwarded-for'];
  const ipAddress = typeof forwarded === 'string'
    ? forwarded.split(',')[0].trim()
    : request.socket.remoteAddress ?? null;

  return {
    ipAddress,
    userAgent: request.headers['user-agent'] ?? null,
  };
}

export function toSessionUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    mustChangePassword: row.must_change_password,
    lastLoginAt: row.last_login_at,
  };
}

export async function isBootstrapRequired() {
  const result = await getPool().query('SELECT EXISTS (SELECT 1 FROM app_users) AS has_users');
  return !result.rows[0]?.has_users;
}

export async function getSessionFromRequest(request) {
  const cookies = parseCookieHeader(request.headers.cookie ?? '');
  const refreshToken = cookies[refreshCookieName];
  if (!refreshToken) {
    return null;
  }

  const result = await getPool().query(
    `
      SELECT
        refresh_tokens.id AS refresh_token_id,
        refresh_tokens.app_user_id,
        refresh_tokens.token_family_id,
        refresh_tokens.csrf_token_hash,
        refresh_tokens.expires_at,
        refresh_tokens.is_revoked,
        refresh_tokens.revoked_reason,
        refresh_tokens.replaced_by_refresh_token_id,
        app_users.id,
        app_users.username,
        app_users.role,
        app_users.must_change_password,
        app_users.last_login_at,
        app_users.is_disabled
      FROM refresh_tokens
      JOIN app_users ON app_users.id = refresh_tokens.app_user_id
      WHERE refresh_tokens.token_hash = $1
      LIMIT 1
    `,
    [hashToken(refreshToken)],
  );

  return resolveSessionFromRefreshTokenLookup({
    row: result.rows[0] ?? null,
    refreshToken,
    csrfToken: cookies[csrfCookieName] ?? null,
    requestMetadata: getRequestMetadata(request),
  });
}

export async function requireSession(request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw createApiError(401, 'auth_required', 'Authentication is required');
  }

  return session;
}

export async function requireAdminSession(request, requireSessionFn = requireSession) {
  const session = await requireSessionFn(request);
  if (session.user?.role !== 'admin') {
    throw createApiError(403, 'admin_required', 'Administrator access is required');
  }

  return session;
}

export async function requireFreshSession(request, requireSessionFn = requireSession) {
  const session = await requireSessionFn(request);
  if (session.user?.mustChangePassword) {
    throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
  }

  return session;
}

export async function requireFreshAdminSession(
  request,
  requireAdminSessionFn = requireAdminSession,
  requireFreshSessionFn = requireFreshSession,
) {
  return requireAdminSessionFn(request, requireFreshSessionFn);
}

function enforceCsrf(request, session) {
  const headerToken = request.headers['x-csrf-token'];
  if (typeof headerToken !== 'string' || !session.csrfToken) {
    throw createApiError(403, 'csrf_required', 'CSRF token is required');
  }

  if (headerToken !== session.csrfToken || hashToken(headerToken) !== session.csrfTokenHash) {
    throw createApiError(403, 'csrf_invalid', 'CSRF token is invalid');
  }
}

export function createRequireCsrf({ mode = null, modeResolver = null } = {}) {
  return function configuredRequireCsrf(request, session) {
    const effectiveMode = mode ?? modeResolver?.(request, session) ?? resolveCsrfProtectionMode();
    if (effectiveMode === csrfProtectionModes.disabled) {
      return;
    }

    enforceCsrf(request, session);
  };
}

export const requireCsrf = createRequireCsrf({
  modeResolver(request) {
    return request?.deploymentSecurityPolicy?.csrfProtectionMode
      ?? request?.res?.locals?.deploymentSecurityPolicy?.csrfProtectionMode
      ?? resolveCsrfProtectionMode();
  },
});

export async function revokeRefreshToken(refreshTokenId, revokedReason) {
  await getPool().query(
    `
      UPDATE refresh_tokens
      SET is_revoked = TRUE,
          revoked_at = NOW(),
          revoked_reason = $2
      WHERE id = $1 AND is_revoked = FALSE
    `,
    [refreshTokenId, revokedReason],
  );
}

export async function revokeRefreshTokenFamily(tokenFamilyId, revokedReason) {
  const result = await getPool().query(
    `
      UPDATE refresh_tokens
      SET is_revoked = TRUE,
          revoked_at = NOW(),
          revoked_reason = $2
      WHERE token_family_id = $1
        AND is_revoked = FALSE
    `,
    [tokenFamilyId, revokedReason],
  );

  return result.rowCount ?? 0;
}

export async function resolveSessionFromRefreshTokenLookup({
  row,
  refreshToken,
  csrfToken,
  requestMetadata,
  now = () => Date.now(),
  revokeRefreshTokenFamilyFn = revokeRefreshTokenFamily,
  recordAuditEventFn = recordAuditEvent,
}) {
  if (!row || row.is_disabled) {
    return null;
  }

  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= now()) {
    return null;
  }

  if (row.is_revoked) {
    if (row.replaced_by_refresh_token_id) {
      const revokedSessions = await revokeRefreshTokenFamilyFn(row.token_family_id, 'reuse_detected');

      if (revokedSessions > 0) {
        await recordAuditEventFn({
          actorUserId: row.app_user_id,
          actorType: 'user',
          eventType: 'refresh_token_reuse_detected',
          summary: 'Refresh token reuse detected; active session family revoked',
          entityType: 'refresh_token',
          entityId: row.refresh_token_id,
          details: {
            tokenFamilyId: row.token_family_id,
            previousRevokedReason: row.revoked_reason,
          },
          ipAddress: requestMetadata?.ipAddress ?? null,
          userAgent: requestMetadata?.userAgent ?? null,
        });
      }
    }

    return null;
  }

  return {
    refreshTokenId: row.refresh_token_id,
    appUserId: row.app_user_id,
    tokenFamilyId: row.token_family_id,
    csrfTokenHash: row.csrf_token_hash,
    expiresAt: row.expires_at,
    user: toSessionUser(row),
    refreshToken,
    csrfToken,
  };
}

export async function issueSession({ userId, parentRefreshTokenId = null, tokenFamilyId = null, requestMetadata }) {
  const refreshToken = createOpaqueToken(32);
  const csrfToken = createOpaqueToken(24);
  const expiresAt = new Date(Date.now() + refreshTokenMaxAgeSeconds * 1000);
  const familyId = tokenFamilyId ?? randomUUID();

  const result = await getPool().query(
    `
      INSERT INTO refresh_tokens (
        app_user_id,
        token_hash,
        token_family_id,
        parent_refresh_token_id,
        csrf_token_hash,
        issued_at,
        expires_at,
        issued_ip,
        issued_user_agent
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
      RETURNING id
    `,
    [
      userId,
      hashToken(refreshToken),
      familyId,
      parentRefreshTokenId,
      hashToken(csrfToken),
      expiresAt,
      requestMetadata.ipAddress,
      requestMetadata.userAgent,
    ],
  );

  if (parentRefreshTokenId) {
    await getPool().query(
      'UPDATE refresh_tokens SET replaced_by_refresh_token_id = $2, last_used_at = NOW() WHERE id = $1',
      [parentRefreshTokenId, result.rows[0].id],
    );
  }

  return {
    refreshToken,
    csrfToken,
    expiresAt,
    refreshTokenId: result.rows[0].id,
    tokenFamilyId: familyId,
  };
}

export async function findUserByUsername(username) {
  const result = await getPool().query('SELECT * FROM app_users WHERE username = $1 LIMIT 1', [username]);
  return result.rows[0] ?? null;
}

export async function buildSessionPayload(request, session = null) {
  const activeSession = session ?? await getSessionFromRequest(request);
  return {
    bootstrapRequired: await isBootstrapRequired(),
    user: activeSession ? activeSession.user : null,
    csrfToken: activeSession?.csrfToken ?? parseCookieHeader(request.headers.cookie ?? '')[csrfCookieName] ?? null,
  };
}

export async function handleLoginFailure(user, requestMetadata, username) {
  if (user) {
    const nextFailureCount = Number(user.failed_login_count ?? 0) + 1;
    const lockedUntil = nextFailureCount >= 5
      ? new Date(Date.now() + 15 * 60 * 1000)
      : null;

    await getPool().query(
      `
        UPDATE app_users
        SET failed_login_count = $2,
            locked_until = COALESCE($3, locked_until),
            updated_at = NOW()
        WHERE id = $1
      `,
      [user.id, nextFailureCount, lockedUntil],
    );
  }

  await recordAuditEvent({
    actorType: 'anonymous',
    eventType: 'login_failed',
    summary: 'Login failed',
    details: { username },
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
  });
}

export async function createBootstrapAdmin({ username, password, requestMetadata }) {
  if (!await isBootstrapRequired()) {
    throw createApiError(409, 'bootstrap_unavailable', 'Bootstrap admin setup is no longer available');
  }

  const normalizedUsername = normalizeUsername(username);
  const validatedPassword = validatePassword(password);
  const passwordHash = await hashPassword(validatedPassword);

  const result = await getPool().query(
    `
      INSERT INTO app_users (username, password_hash, role, password_changed_at)
      VALUES ($1, $2, 'admin', NOW())
      RETURNING *
    `,
    [normalizedUsername, passwordHash],
  );

  const user = result.rows[0];
  const issuedSession = await issueSession({ userId: user.id, requestMetadata });

  await recordAuditEvent({
    actorUserId: user.id,
    actorType: 'user',
    eventType: 'bootstrap_admin_created',
    summary: 'Bootstrap admin account created',
    entityType: 'app_user',
    entityId: user.id,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
  });

  return {
    user,
    issuedSession,
  };
}

export async function loginUser({ username, password, requestMetadata }) {
  if (await isBootstrapRequired()) {
    throw createApiError(409, 'bootstrap_required', 'Create the bootstrap admin account before logging in');
  }

  const normalizedUsername = normalizeUsername(username);
  const validatedPassword = validatePassword(password);
  const user = await findUserByUsername(normalizedUsername);

  if (!user || user.is_disabled) {
    await handleLoginFailure(user, requestMetadata, normalizedUsername);
    throw createApiError(401, 'invalid_credentials', 'Username or password is incorrect');
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    throw createApiError(423, 'account_locked', 'Account is temporarily locked after repeated failed logins');
  }

  if (!await verifyPassword(validatedPassword, user.password_hash)) {
    await handleLoginFailure(user, requestMetadata, normalizedUsername);
    throw createApiError(401, 'invalid_credentials', 'Username or password is incorrect');
  }

  await getPool().query(
    `
      UPDATE app_users
      SET failed_login_count = 0,
          locked_until = NULL,
          last_login_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [user.id],
  );

  const issuedSession = await issueSession({ userId: user.id, requestMetadata });

  await recordAuditEvent({
    actorUserId: user.id,
    actorType: 'user',
    eventType: 'login_succeeded',
    summary: 'User login succeeded',
    entityType: 'app_user',
    entityId: user.id,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
  });

  return {
    user: {
      ...user,
      last_login_at: new Date().toISOString(),
    },
    issuedSession,
  };
}

export async function rotateSession(session, requestMetadata) {
  await revokeRefreshToken(session.refreshTokenId, 'rotated');

  const issuedSession = await issueSession({
    userId: session.appUserId,
    parentRefreshTokenId: session.refreshTokenId,
    tokenFamilyId: session.tokenFamilyId,
    requestMetadata,
  });

  return issuedSession;
}

export async function logoutSession(session, requestMetadata) {
  await revokeRefreshToken(session.refreshTokenId, 'logout');

  await recordAuditEvent({
    actorUserId: session.appUserId,
    actorType: 'user',
    eventType: 'logout_succeeded',
    summary: 'User logout succeeded',
    entityType: 'app_user',
    entityId: session.appUserId,
    ipAddress: requestMetadata.ipAddress,
    userAgent: requestMetadata.userAgent,
  });
}

export function setAuthCookies(response, refreshToken, csrfToken, maxAgeSeconds = refreshTokenMaxAgeSeconds) {
  const secureCookies = response?.locals?.deploymentSecurityPolicy?.secureCookies
    ?? resolveSecureCookiesEnabled();

  response.setHeader('Set-Cookie', [
    serializeCookie(refreshCookieName, refreshToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: secureCookies,
      maxAge: maxAgeSeconds,
    }),
    serializeCookie(csrfCookieName, csrfToken, {
      path: '/',
      sameSite: 'Strict',
      secure: secureCookies,
      maxAge: maxAgeSeconds,
    }),
  ]);
}

export function clearAuthCookies(response) {
  const secureCookies = response?.locals?.deploymentSecurityPolicy?.secureCookies
    ?? resolveSecureCookiesEnabled();

  response.setHeader('Set-Cookie', [
    serializeCookie(refreshCookieName, '', {
      path: '/',
      httpOnly: true,
      sameSite: 'Strict',
      secure: secureCookies,
      maxAge: 0,
    }),
    serializeCookie(csrfCookieName, '', {
      path: '/',
      sameSite: 'Strict',
      secure: secureCookies,
      maxAge: 0,
    }),
  ]);
}
