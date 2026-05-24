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

import { createApiError } from '../../auth.js';
import { recordAuditEvent } from '../../audit.js';
import { getPool } from '../../database.js';
import { mapDatabaseErrorWithConstraints } from '../../database-error-mapper.js';

const VALID_ACTIONS = new Set(['mark_stale', 'refresh_profile', 'safe_relink']);

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

function normalizeUserId(value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createApiError(400, 'validation_error', 'User id must be provided');
  }

  return value.trim();
}

function normalizeAction(value) {
  if (typeof value !== 'string') {
    throw createApiError(400, 'validation_error', 'Reconciliation action must be provided');
  }

  const normalized = value.trim();
  if (!VALID_ACTIONS.has(normalized)) {
    throw createApiError(400, 'validation_error', 'Reconciliation action must be one of: mark_stale, refresh_profile, safe_relink');
  }

  return normalized;
}

function buildPlexSubjectKeys(profile = null, authSubject = null) {
  return new Set([
    normalizeOptionalString(authSubject),
    normalizeOptionalString(profile?.plexUuid),
    normalizeOptionalString(profile?.plexUserId),
  ].filter(Boolean));
}

function findMatchingPreviewProfile(user, previewProfiles) {
  const subjectKeys = buildPlexSubjectKeys(user?.plexProfile, user?.authSubject);
  if (subjectKeys.size === 0 || !Array.isArray(previewProfiles)) {
    return null;
  }

  return previewProfiles.find((profile) => {
    const profileKeys = buildPlexSubjectKeys({
      plexUserId: profile?.id,
      plexUuid: profile?.uuid,
    });
    return Array.from(profileKeys).some((value) => subjectKeys.has(value));
  }) ?? null;
}

function resolvePlexSubject(profile) {
  return normalizeOptionalString(profile?.uuid) ?? normalizeOptionalString(profile?.id);
}

const mapDatabaseError = mapDatabaseErrorWithConstraints({
  app_users_auth_provider_subject_unique: {
    code: 'plex_linked_account_subject_conflict',
    message: 'Another app user already uses this Plex sign-in identity',
  },
  app_user_plex_profiles_plex_user_id_key: {
    code: 'plex_linked_account_profile_conflict',
    message: 'Another app user is already linked to this Plex profile',
  },
  app_user_plex_profiles_plex_uuid_key: {
    code: 'plex_linked_account_profile_conflict',
    message: 'Another app user is already linked to this Plex profile',
  },
});

async function upsertPlexProfile(client, userId, profile) {
  const updateProfileResult = await client.query(
    `
      UPDATE app_user_plex_profiles
      SET plex_user_id = $2,
          plex_uuid = $3,
          plex_username = $4,
          plex_email = $5,
          plex_title = $6,
          plex_thumb_url = $7,
          plex_home_role = $8,
          plex_library_access_state = $9,
          plex_library_access_details = $10::jsonb,
          raw_profile = $11::jsonb,
          synced_at = NOW(),
          updated_at = NOW()
      WHERE app_user_id = $1
    `,
    [
      userId,
      profile.id,
      profile.uuid,
      profile.username,
      profile.email,
      profile.title,
      profile.thumbUrl,
      profile.homeRole,
      profile.libraryAccessState,
      JSON.stringify(profile.libraryAccessDetails ?? {}),
      JSON.stringify(profile),
    ],
  );

  if ((updateProfileResult.rowCount ?? 0) > 0) {
    return;
  }

  await client.query(
    `
      INSERT INTO app_user_plex_profiles (
        app_user_id,
        plex_user_id,
        plex_uuid,
        plex_username,
        plex_email,
        plex_title,
        plex_thumb_url,
        plex_home_role,
        plex_library_access_state,
        plex_library_access_details,
        raw_profile,
        linked_at,
        synced_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, NOW(), NOW(), NOW())
    `,
    [
      userId,
      profile.id,
      profile.uuid,
      profile.username,
      profile.email,
      profile.title,
      profile.thumbUrl,
      profile.homeRole,
      profile.libraryAccessState,
      JSON.stringify(profile.libraryAccessDetails ?? {}),
      JSON.stringify(profile),
    ],
  );
}

function assertManagedUser(user) {
  if (!user) {
    throw createApiError(404, 'app_user_not_found', 'The requested user could not be found');
  }

  if (user.authProvider !== 'plex' && !user.plexProfile) {
    throw createApiError(409, 'plex_linked_account_not_managed', 'The requested user is not currently part of the Plex linked-account workspace');
  }
}

function assertPreviewProfile(profile) {
  if (!profile?.id) {
    throw createApiError(409, 'plex_linked_account_preview_profile_missing', 'The requested user was not found in the latest Plex preview');
  }
}

function assertSafeRelinkTarget(user, profile) {
  if (user.authProvider === 'plex') {
    throw createApiError(409, 'plex_linked_account_already_primary', 'The requested user already uses Plex as the primary sign-in provider');
  }

  if (!user.plexProfile) {
    throw createApiError(409, 'plex_linked_account_safe_relink_unavailable', 'Safe relink requires an existing Plex profile attachment on the app user');
  }

  if (profile?.classification === 'conflict' && profile?.existingUser?.id && profile.existingUser.id !== user.id) {
    throw createApiError(409, 'plex_linked_account_safe_relink_conflict', 'This Plex preview profile is currently blocked by a conflict with another app user');
  }
}

export function createPlexLinkedAccountReconciliationService({
  buildPlexDirectoryImportPreview = async () => ({ fetchedAt: null, profiles: [] }),
  getAppUserById = async () => null,
  getNow = () => new Date(),
  getPoolFn = getPool,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function reconcileUser({ action, actorUserId, requestMetadata, userId }) {
    const normalizedAction = normalizeAction(action);
    const normalizedUserId = normalizeUserId(userId);
    const [preview, currentUser] = await Promise.all([
      buildPlexDirectoryImportPreview(),
      getAppUserById({ userId: normalizedUserId }),
    ]);

    assertManagedUser(currentUser);

    const previewProfiles = Array.isArray(preview?.profiles) ? preview.profiles : [];
    const previewProfile = findMatchingPreviewProfile(currentUser, previewProfiles);
    const reconciledAt = getNow().toISOString();

    if (normalizedAction === 'mark_stale') {
      if (previewProfile) {
        throw createApiError(409, 'plex_linked_account_not_stale', 'The requested user is present in the latest Plex preview and cannot be marked stale');
      }

      await recordAuditEventFn({
        actorType: 'user',
        actorUserId,
        details: {
          plexUserId: currentUser.plexProfile?.plexUserId ?? null,
          plexUuid: currentUser.plexProfile?.plexUuid ?? null,
          previewFetchedAt: preview?.fetchedAt ?? null,
          username: currentUser.username,
        },
        entityId: currentUser.id,
        entityType: 'app_user',
        eventType: 'plex_linked_account_stale_acknowledged',
        ipAddress: requestMetadata?.ipAddress ?? null,
        summary: 'Plex linked account marked stale after preview review',
        userAgent: requestMetadata?.userAgent ?? null,
      });

      return {
        action: normalizedAction,
        reconciledAt,
        staleAcknowledgedAt: reconciledAt,
        user: currentUser,
      };
    }

    assertPreviewProfile(previewProfile);

    if (normalizedAction === 'safe_relink') {
      assertSafeRelinkTarget(currentUser, previewProfile);
    }

    const pool = getPoolFn();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      if (normalizedAction === 'safe_relink') {
        const subject = resolvePlexSubject(previewProfile);
        if (!subject) {
          throw createApiError(409, 'plex_linked_account_missing_subject', 'The latest Plex preview is missing a stable sign-in subject for this user');
        }

        await client.query(
          `
            UPDATE app_users
            SET auth_provider = 'plex',
                auth_subject = $2,
                updated_at = NOW()
            WHERE id = $1
          `,
          [normalizedUserId, subject],
        );
      }

      await upsertPlexProfile(client, normalizedUserId, previewProfile);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw mapDatabaseError(error);
    } finally {
      client.release();
    }

    const updatedUser = await getAppUserById({ userId: normalizedUserId });
    const eventType = normalizedAction === 'safe_relink'
      ? 'plex_linked_account_safely_relinked'
      : 'plex_linked_account_profile_refreshed';
    const summary = normalizedAction === 'safe_relink'
      ? 'Plex sign-in safely relinked from linked-account preview'
      : 'Plex linked account profile refreshed from preview';

    await recordAuditEventFn({
      actorType: 'user',
      actorUserId,
      details: {
        action: normalizedAction,
        plexUserId: previewProfile.id,
        plexUuid: previewProfile.uuid ?? null,
        previousAuthProvider: currentUser.authProvider,
        previewClassification: previewProfile.classification,
        username: updatedUser?.username ?? currentUser.username,
      },
      entityId: normalizedUserId,
      entityType: 'app_user',
      eventType,
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary,
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      action: normalizedAction,
      profile: previewProfile,
      reconciledAt,
      user: updatedUser,
    };
  }

  async function listLatestStaleAcknowledgements({ userIds = [] } = {}) {
    const normalizedUserIds = [...new Set(userIds
      .filter((value) => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim()))];

    if (normalizedUserIds.length === 0) {
      return new Map();
    }

    const result = await getPoolFn().query(
      `
        SELECT DISTINCT ON (entity_id)
          entity_id,
          actor_user_id,
          occurred_at
        FROM audit_events
        WHERE entity_type = 'app_user'
          AND event_type = 'plex_linked_account_stale_acknowledged'
          AND entity_id = ANY($1::uuid[])
        ORDER BY entity_id ASC, occurred_at DESC, id DESC
      `,
      [normalizedUserIds],
    );

    return new Map(result.rows.map((row) => [row.entity_id, {
      actorUserId: row.actor_user_id ?? null,
      occurredAt: row.occurred_at,
    }]));
  }

  return {
    listLatestStaleAcknowledgements,
    reconcileUser,
  };
}
