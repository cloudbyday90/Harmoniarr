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
import { buildMediaRequestTargetEligibility } from './media-request-target-eligibility.js';
import { createAppUserPermissionService } from './app-user-permission-service.js';
import { buildLocalAuthStatus } from './local-auth-readiness.js';
import { buildPlexLibraryAccessPolicy } from './plex-library-access-policy.js';
import { normalizeOptionalManagedLibraryRelativeRoot } from './paths/user-music-root-service.js';
import { hashPassword } from './security.js';
import { normalizeUsername, validatePassword } from './validators/auth-validator.js';
import {
  NOTIFICATION_CATEGORY_KEYS,
  buildDefaultNotificationPreferences,
} from './notification/notification-preference-constants.js';

/** Allowed values for the per-user preferred audio format preference. */
export const VALID_PREFERRED_FORMATS = /** @type {const} */ (['any', 'flac', 'mp3_320', 'mp3_v0']);

/** Allowed values for the per-user minimum quality floor preference. */
export const VALID_MINIMUM_QUALITIES = /** @type {const} */ (['any', 'lossless', 'high']);

function normalizeUserId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'User id must be a non-empty string');
  }

  return value.trim();
}

/**
 * Produce a fully-normalised preferences object from a raw JSONB value.
 * Missing or invalid keys fall back to the safe default 'any'.
 *
 * @param {unknown} raw - the raw value stored in the database column (may be null or partial)
 * @returns {{ preferredFormat: string, minimumQuality: string }}
 */
export function normalizeUserPreferences(raw) {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const notifRaw = obj.notificationPreferences;
  const notifDefaults = buildDefaultNotificationPreferences();
  const notificationPreferences = notifRaw && typeof notifRaw === 'object' && !Array.isArray(notifRaw)
    ? normalizeNotificationPreferences(notifRaw, notifDefaults)
    : notifDefaults;

  return {
    minimumQuality: VALID_MINIMUM_QUALITIES.includes(obj.minimumQuality)
      ? obj.minimumQuality
      : 'any',
    notificationPreferences,
    preferredFormat: VALID_PREFERRED_FORMATS.includes(obj.preferredFormat)
      ? obj.preferredFormat
      : 'any',
  };
}

function normalizeNotificationPreferences(raw, defaults) {
  const result = {};
  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    result[key] = typeof raw[key] === 'boolean' ? raw[key] : defaults[key];
  }
  return result;
}

/**
 * Validate a preferences patch from an API request body.
 * Returns a clean object containing only recognised, valid keys.
 * Throws a 400 API error for any invalid field value.
 *
 * @param {unknown} patch - raw request body
 * @returns {{ preferredFormat?: string, minimumQuality?: string }}
 */
function validatePreferencesPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw createApiError(400, 'validation_error', 'Preferences must be an object');
  }

  const cleaned = {};

  if ('preferredFormat' in patch) {
    if (!VALID_PREFERRED_FORMATS.includes(patch.preferredFormat)) {
      throw createApiError(
        400,
        'validation_error',
        `preferredFormat must be one of: ${VALID_PREFERRED_FORMATS.join(', ')}`,
      );
    }
    cleaned.preferredFormat = patch.preferredFormat;
  }

  if ('minimumQuality' in patch) {
    if (!VALID_MINIMUM_QUALITIES.includes(patch.minimumQuality)) {
      throw createApiError(
        400,
        'validation_error',
        `minimumQuality must be one of: ${VALID_MINIMUM_QUALITIES.join(', ')}`,
      );
    }
    cleaned.minimumQuality = patch.minimumQuality;
  }

  if ('notificationPreferences' in patch) {
    cleaned.notificationPreferences = validateNotificationPreferencesPatch(patch.notificationPreferences);
  }

  return cleaned;
}

function validateNotificationPreferencesPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw createApiError(400, 'validation_error', 'notificationPreferences must be an object');
  }

  const defaults = buildDefaultNotificationPreferences();
  const result = {};
  const unknownKeys = Object.keys(raw).filter((k) => !NOTIFICATION_CATEGORY_KEYS.includes(k));
  if (unknownKeys.length > 0) {
    throw createApiError(
      400,
      'validation_error',
      `Unknown notification categories: ${unknownKeys.join(', ')}`,
    );
  }

  for (const key of NOTIFICATION_CATEGORY_KEYS) {
    if (key in raw) {
      if (typeof raw[key] !== 'boolean') {
        throw createApiError(
          400,
          'validation_error',
          `notificationPreferences.${key} must be a boolean`,
        );
      }
      result[key] = raw[key];
    } else {
      result[key] = defaults[key];
    }
  }

  return result;
}

function mapAppUserRow(row, permissionService) {
  const plexProfile = row.plex_user_id ? {
    accessPolicy: buildPlexLibraryAccessPolicy({
      homeRole: row.plex_home_role,
      libraryAccessDetails: row.plex_library_access_details ?? {},
      libraryAccessState: row.plex_library_access_state ?? 'unknown',
    }),
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
  } : null;

  return {
    authProvider: row.auth_provider ?? 'local',
    authSubject: row.auth_subject ?? null,
    createdAt: row.created_at,
    email: row.email ?? null,
    id: row.id,
    isDisabled: row.is_disabled,
    lastLoginAt: row.last_login_at,
    localAuth: buildLocalAuthStatus(row),
    managedLibraryRelativeRoot: row.managed_library_relative_root ?? null,
    mediaRequestTarget: buildMediaRequestTargetEligibility({
      isDisabled: row.is_disabled,
      plexProfile,
    }),
    mustChangePassword: row.must_change_password,
    permissions: permissionService.listPermissionsForRole(row.role),
    plexProfile,
    role: row.role,
    updatedAt: row.updated_at,
    userPreferences: normalizeUserPreferences(row.user_preferences),
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

  async function getUserPreferences({ userId }) {
    const normalizedUserId = normalizeUserId(userId);
    const result = await getPoolFn().query(
      `SELECT user_preferences FROM app_users WHERE id = $1 LIMIT 1`,
      [normalizedUserId],
    );

    if ((result.rowCount ?? result.rows.length ?? 0) === 0) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    return normalizeUserPreferences(result.rows[0].user_preferences);
  }

  async function updateUserPreferences({ actorUserId, requestMetadata, userId, preferences }) {
    const normalizedActorUserId = normalizeUserId(actorUserId);
    const normalizedUserId = normalizeUserId(userId);

    const cleanedPatch = validatePreferencesPatch(preferences);

    if (Object.keys(cleanedPatch).length === 0) {
      throw createApiError(400, 'validation_error', 'At least one preference field must be provided');
    }

    // Merge the patch into the existing JSONB value so unspecified keys are preserved.
    const result = await getPoolFn().query(
      `
        UPDATE app_users
        SET user_preferences = user_preferences || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING user_preferences
      `,
      [normalizedUserId, JSON.stringify(cleanedPatch)],
    );

    if ((result.rowCount ?? 0) === 0) {
      throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
    }

    const updatedPreferences = normalizeUserPreferences(result.rows[0].user_preferences);

    await recordAuditEventFn({
      actorUserId: normalizedActorUserId,
      actorType: 'user',
      details: { preferences: updatedPreferences },
      entityId: normalizedUserId,
      entityType: 'app_user',
      eventType: 'app_user_preferences_updated',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'App user preferences updated',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return updatedPreferences;
  }

  return {
    createAppUser,
    getAppUserById,
    getUserPreferences,
    listAppUsers,
    resetAppUserPassword,
    roleOptions: [...permissionService.roleOptions],
    updateAppUser,
    updateUserPreferences,
  };
}
