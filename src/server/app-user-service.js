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

import { createApiError } from './auth.js';
import { recordAuditEvent } from './audit.js';
import { getPool } from './database.js';
import { createAppUserPermissionService } from './app-user-permission-service.js';
import { normalizeOptionalManagedLibraryRelativeRoot } from './paths/user-music-root-service.js';
import { hashPassword } from './security.js';
import { normalizeUsername, validatePassword } from './validators/auth-validator.js';

function normalizeUserId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'User id must be a non-empty string');
  }

  return value.trim();
}

function mapAppUserRow(row, permissionService) {
  return {
    authProvider: row.auth_provider ?? 'local',
    authSubject: row.auth_subject ?? null,
    createdAt: row.created_at,
    email: row.email ?? null,
    id: row.id,
    isDisabled: row.is_disabled,
    lastLoginAt: row.last_login_at,
    managedLibraryRelativeRoot: row.managed_library_relative_root ?? null,
    mustChangePassword: row.must_change_password,
    permissions: permissionService.listPermissionsForRole(row.role),
    plexProfile: row.plex_user_id ? {
      homeRole: row.plex_home_role,
      libraryAccessDetails: row.plex_library_access_details ?? {},
      libraryAccessState: row.plex_library_access_state ?? 'unknown',
      plexEmail: row.plex_email ?? null,
      plexTitle: row.plex_title,
      plexUserId: row.plex_user_id,
      plexUsername: row.plex_username ?? null,
      plexUuid: row.plex_uuid ?? null,
      thumbUrl: row.plex_thumb_url ?? null,
      syncedAt: row.plex_synced_at ?? null,
    } : null,
    role: row.role,
    updatedAt: row.updated_at,
    username: row.username,
  };
}

function mapDatabaseError(error) {
  if (error?.code === '23505') {
    if (error?.constraint === 'app_users_managed_library_relative_root_unique') {
      throw createApiError(409, 'app_user_managed_library_root_conflict', 'Another user already owns that managed library subdirectory');
    }

    if (error?.constraint === 'app_users_email_unique') {
      throw createApiError(409, 'app_user_email_conflict', 'A user with that email already exists');
    }

    throw createApiError(409, 'app_user_username_conflict', 'A user with that username already exists');
  }

  throw error;
}

export function createAppUserService({
  getPoolFn = getPool,
  hashPasswordFn = hashPassword,
  permissionService = createAppUserPermissionService(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  const appUserSelectSql = `
    SELECT
      app_users.*,
      app_user_plex_profiles.plex_user_id,
      app_user_plex_profiles.plex_uuid,
      app_user_plex_profiles.plex_username,
      app_user_plex_profiles.plex_email,
      app_user_plex_profiles.plex_title,
      app_user_plex_profiles.plex_thumb_url,
      app_user_plex_profiles.plex_home_role,
      app_user_plex_profiles.plex_library_access_state,
      app_user_plex_profiles.plex_library_access_details,
      app_user_plex_profiles.synced_at AS plex_synced_at
    FROM app_users
    LEFT JOIN app_user_plex_profiles
      ON app_user_plex_profiles.app_user_id = app_users.id
  `;

  async function getAppUserById({ userId }) {
    const normalizedUserId = normalizeUserId(userId);
    const result = await getPoolFn().query(`${appUserSelectSql} WHERE app_users.id = $1 LIMIT 1`, [normalizedUserId]);

    if ((result.rowCount ?? result.rows.length ?? 0) === 0) {
      return null;
    }

    return mapAppUserRow(result.rows[0], permissionService);
  }

  async function listAppUsers() {
    const result = await getPoolFn().query(`
      ${appUserSelectSql}
      ORDER BY app_users.username ASC
    `);

    return result.rows.map((row) => mapAppUserRow(row, permissionService));
  }

  async function createAppUser({ actorUserId, managedLibraryRelativeRoot, password, requestMetadata, role = 'requester', username }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedManagedLibraryRelativeRoot = normalizeOptionalManagedLibraryRelativeRoot(managedLibraryRelativeRoot, {
      fieldName: 'managedLibraryRelativeRoot',
    }) ?? null;
    const normalizedUsername = normalizeUsername(username);
    const normalizedRole = permissionService.normalizeAppUserRole(role);
    const passwordHash = await hashPasswordFn(validatePassword(password));

    let result;
    try {
      result = await getPoolFn().query(
        `
          INSERT INTO app_users (
            username,
            password_hash,
            role,
            managed_library_relative_root,
            must_change_password,
            password_changed_at
          )
          VALUES ($1, $2, $3, $4, TRUE, NOW())
          RETURNING *
        `,
        [normalizedUsername, passwordHash, normalizedRole, normalizedManagedLibraryRelativeRoot],
      );
    } catch (error) {
      mapDatabaseError(error);
    }

    const user = mapAppUserRow(result.rows[0], permissionService);

    await recordAuditEventFn({
      actorUserId: normalizedActorUserId,
      actorType: 'user',
      details: {
        managedLibraryRelativeRoot: user.managedLibraryRelativeRoot,
        role: user.role,
        username: user.username,
      },
      entityId: user.id,
      entityType: 'app_user',
      eventType: 'app_user_created',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'App user created',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return user;
  }

  async function updateAppUser({ actorUserId, isDisabled, managedLibraryRelativeRoot, requestMetadata, role, userId }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedUserId = normalizeUserId(userId);
    const updates = [];
    const values = [normalizedUserId];

    if (role !== undefined) {
      values.push(permissionService.normalizeAppUserRole(role));
      updates.push(`role = $${values.length}`);
    }

    if (isDisabled !== undefined) {
      if (typeof isDisabled !== 'boolean') {
        throw createApiError(400, 'validation_error', 'User disabled state must be a boolean');
      }
      if (normalizedUserId === normalizedActorUserId && isDisabled) {
        throw createApiError(400, 'validation_error', 'Administrators cannot disable their current account');
      }

      values.push(isDisabled);
      updates.push(`is_disabled = $${values.length}`);
    }

    if (managedLibraryRelativeRoot !== undefined) {
      values.push(normalizeOptionalManagedLibraryRelativeRoot(managedLibraryRelativeRoot, {
        fieldName: 'managedLibraryRelativeRoot',
      }));
      updates.push(`managed_library_relative_root = $${values.length}`);
    }

    if (updates.length === 0) {
      throw createApiError(400, 'validation_error', 'At least one user field must be updated');
    }

    values.push(new Date().toISOString());
    updates.push(`updated_at = $${values.length}`);

    const result = await getPoolFn().query(
      `
        UPDATE app_users
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING *
      `,
      values,
    );

    if ((result.rowCount ?? 0) === 0) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    const user = mapAppUserRow(result.rows[0], permissionService);

    await recordAuditEventFn({
      actorUserId: normalizedActorUserId,
      actorType: 'user',
      details: {
        isDisabled: user.isDisabled,
        managedLibraryRelativeRoot: user.managedLibraryRelativeRoot,
        role: user.role,
        username: user.username,
      },
      entityId: user.id,
      entityType: 'app_user',
      eventType: 'app_user_updated',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'App user updated',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return user;
  }

  async function resetAppUserPassword({ actorUserId, password, requestMetadata, userId }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedUserId = normalizeUserId(userId);
    const passwordHash = await hashPasswordFn(validatePassword(password));

    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `
          UPDATE app_users
          SET password_hash = $2,
              must_change_password = TRUE,
              password_changed_at = NOW(),
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [normalizedUserId, passwordHash],
      );

      if ((result.rowCount ?? 0) === 0) {
        throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
      }

      const revokedSessionsResult = await client.query(
        `
          UPDATE refresh_tokens
          SET is_revoked = TRUE,
              revoked_at = NOW(),
              revoked_reason = 'admin_password_reset'
          WHERE app_user_id = $1
            AND is_revoked = FALSE
        `,
        [normalizedUserId],
      );

      await client.query('COMMIT');

      const user = mapAppUserRow(result.rows[0], permissionService);

      await recordAuditEventFn({
        actorUserId: normalizedActorUserId,
        actorType: 'user',
        details: {
          revokedSessionCount: revokedSessionsResult.rowCount ?? 0,
          username: user.username,
        },
        entityId: user.id,
        entityType: 'app_user',
        eventType: 'app_user_password_reset',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'App user password reset',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      return {
        revokedSessionCount: revokedSessionsResult.rowCount ?? 0,
        user,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    createAppUser,
    getAppUserById,
    listAppUsers,
    resetAppUserPassword,
    roleOptions: [...permissionService.roleOptions],
    updateAppUser,
  };
}
