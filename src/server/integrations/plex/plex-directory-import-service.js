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
import { hashPassword } from '../../security.js';
import { normalizeOptionalEmail } from '../../validators/auth-validator.js';
import { createPlexHttpClient } from './plex-http-client.js';
import { createPlexOwnerLinkService } from './plex-owner-link-service.js';

function normalizePlexString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePlexEmail(value) {
  try {
    return normalizeOptionalEmail(value);
  } catch {
    return null;
  }
}

function buildUsernameCandidate(rawProfile) {
  const source = normalizePlexString(rawProfile.username)
    ?? normalizePlexString(rawProfile.title)
    ?? normalizePlexString(rawProfile.email)?.split('@')[0]
    ?? `plex-${normalizePlexString(rawProfile.id) ?? 'user'}`;

  const collapsed = source
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '')
    .slice(0, 32);

  if (collapsed.length >= 3) {
    return collapsed;
  }

  const idFallback = `plex-${String(rawProfile.id ?? 'user')}`
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .slice(0, 32);

  return idFallback.length >= 3 ? idFallback : `plex-user-${String(rawProfile.id ?? 'x').slice(-8)}`;
}

function withUniqueSuggestedUsernames(profiles) {
  const used = new Map();

  return profiles.map((profile) => {
    if (profile.classification !== 'create') {
      return profile;
    }

    const base = buildUsernameCandidate(profile);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);

    if (count === 0) {
      return {
        ...profile,
        suggestedUsername: base,
      };
    }

    const suffix = `-${count + 1}`;
    const truncatedBase = base.slice(0, Math.max(3, 32 - suffix.length));
    return {
      ...profile,
      suggestedUsername: `${truncatedBase}${suffix}`,
    };
  });
}

function inferHomeRole(rawProfile, currentLinkedUser) {
  const normalizedId = normalizePlexString(rawProfile.id);
  const isOwner = normalizedId && currentLinkedUser?.id && normalizedId === currentLinkedUser.id;
  const explicitManaged = rawProfile?.managed === true || rawProfile?.isManaged === true;
  const inferredManaged = !normalizePlexString(rawProfile.username) && !normalizePlexString(rawProfile.email);

  if (isOwner || rawProfile?.admin === true || rawProfile?.homeAdmin === true || rawProfile?.isAdmin === true) {
    return 'home_admin';
  }

  if (explicitManaged || inferredManaged) {
    return 'home_managed';
  }

  return 'home_member';
}

function inferLibraryAccess(rawProfile, homeRole) {
  if (homeRole === 'home_admin') {
    return {
      details: {},
      state: 'owner',
    };
  }

  const serverIds = Array.isArray(rawProfile?.servers)
    ? rawProfile.servers.map((value) => String(value))
    : Array.isArray(rawProfile?.serverIds)
      ? rawProfile.serverIds.map((value) => String(value))
      : [];
  const sharedHints = [
    rawProfile?.allowSync,
    rawProfile?.allowTuners,
    rawProfile?.allowChannels,
    rawProfile?.allowSubtitleAdmin,
  ].filter((value) => value !== undefined);

  if (serverIds.length > 0 || sharedHints.length > 0) {
    return {
      details: {
        allowChannels: rawProfile?.allowChannels ?? null,
        allowSubtitleAdmin: rawProfile?.allowSubtitleAdmin ?? null,
        allowSync: rawProfile?.allowSync ?? null,
        allowTuners: rawProfile?.allowTuners ?? null,
        serverIds,
      },
      state: 'shared',
    };
  }

  return {
    details: {
      source: 'plex_home_directory',
    },
    state: 'unknown',
  };
}

function normalizePlexDirectoryUser(rawProfile, currentLinkedUser) {
  const homeRole = inferHomeRole(rawProfile, currentLinkedUser);
  const libraryAccess = inferLibraryAccess(rawProfile, homeRole);

  return {
    email: normalizePlexEmail(rawProfile?.email),
    homeRole,
    id: normalizePlexString(rawProfile?.id),
    isManaged: homeRole === 'home_managed',
    libraryAccessDetails: libraryAccess.details,
    libraryAccessState: libraryAccess.state,
    thumbUrl: normalizePlexString(rawProfile?.thumb),
    title: normalizePlexString(rawProfile?.title)
      ?? normalizePlexString(rawProfile?.username)
      ?? normalizePlexString(rawProfile?.email)
      ?? 'Plex user',
    username: normalizePlexString(rawProfile?.username)?.toLowerCase() ?? null,
    uuid: normalizePlexString(rawProfile?.uuid),
  };
}

function toUserLookupMaps(localUsers) {
  const byEmail = new Map();
  const byLinkedSubject = new Map();
  const byUsername = new Map();

  for (const user of localUsers) {
    if (user.authProvider === 'plex' && user.authSubject) {
      byLinkedSubject.set(String(user.authSubject), user);
    }

    if (user.email) {
      byEmail.set(String(user.email).toLowerCase(), user);
    }

    byUsername.set(String(user.username).toLowerCase(), user);
  }

  return {
    byEmail,
    byLinkedSubject,
    byUsername,
  };
}

function classifyRemoteProfile(profile, lookupMaps, linkedOwner) {
  const subject = profile.uuid ?? profile.id;
  if (!subject || !profile.id) {
    return {
      ...profile,
      classification: 'skipped',
      skipReason: 'missing_identity',
      suggestedUsername: null,
    };
  }

  if ((linkedOwner?.uuid && profile.uuid === linkedOwner.uuid) || (linkedOwner?.id && profile.id === linkedOwner.id)) {
    return {
      ...profile,
      classification: 'owner_account',
      skipReason: 'linked_owner_account',
      suggestedUsername: null,
    };
  }

  const linkedUser = lookupMaps.byLinkedSubject.get(subject);
  if (linkedUser) {
    return {
      ...profile,
      classification: 'linked',
      existingUser: linkedUser,
      suggestedUsername: null,
    };
  }

  if (profile.email) {
    const emailMatch = lookupMaps.byEmail.get(profile.email);
    if (emailMatch) {
      return {
        ...profile,
        classification: 'conflict',
        conflictReason: 'email_match',
        existingUser: emailMatch,
        suggestedUsername: null,
      };
    }
  }

  const usernameMatch = lookupMaps.byUsername.get(buildUsernameCandidate(profile));
  if (usernameMatch) {
    return {
      ...profile,
      classification: 'conflict',
      conflictReason: 'username_match',
      existingUser: usernameMatch,
      suggestedUsername: null,
    };
  }

  return {
    ...profile,
    classification: 'create',
    suggestedUsername: null,
  };
}

function summarizeProfiles(profiles) {
  const summary = {
    conflicts: 0,
    created: 0,
    importable: 0,
    linked: 0,
    ownerAccounts: 0,
    skipped: 0,
    total: profiles.length,
  };

  for (const profile of profiles) {
    switch (profile.classification) {
      case 'conflict':
        summary.conflicts += 1;
        break;
      case 'create':
        summary.importable += 1;
        break;
      case 'linked':
        summary.linked += 1;
        break;
      case 'owner_account':
        summary.ownerAccounts += 1;
        break;
      default:
        summary.skipped += 1;
        break;
    }
  }

  return summary;
}

function mapPreviewProfile(profile) {
  return {
    classification: profile.classification,
    conflictReason: profile.conflictReason ?? null,
    email: profile.email,
    existingUser: profile.existingUser ? {
      authProvider: profile.existingUser.authProvider,
      authSubject: profile.existingUser.authSubject,
      email: profile.existingUser.email,
      id: profile.existingUser.id,
      isDisabled: profile.existingUser.isDisabled,
      managedLibraryRelativeRoot: profile.existingUser.managedLibraryRelativeRoot,
      plexProfile: profile.existingUser.plexProfile ?? null,
      role: profile.existingUser.role,
      username: profile.existingUser.username,
    } : null,
    homeRole: profile.homeRole,
    id: profile.id,
    isManaged: profile.isManaged,
    libraryAccessDetails: profile.libraryAccessDetails,
    libraryAccessState: profile.libraryAccessState,
    suggestedUsername: profile.suggestedUsername,
    thumbUrl: profile.thumbUrl,
    title: profile.title,
    username: profile.username,
    uuid: profile.uuid,
  };
}

export function createPlexDirectoryImportService({
  getNow = () => new Date(),
  getPoolFn = getPool,
  hashPasswordFn = hashPassword,
  listAppUsers = async () => [],
  plexHttpClient = createPlexHttpClient(),
  plexOwnerLinkService = createPlexOwnerLinkService({ plexHttpClient }),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function buildPreview() {
    const linkedAccount = await plexOwnerLinkService.resolveLinkedAccessToken(getPoolFn());
    if (!linkedAccount?.accessToken || !linkedAccount.clientIdentifier) {
      throw createApiError(409, 'plex_link_required', 'Link a Plex owner account before importing Plex users');
    }

    const [homeUsers, currentUser, localUsers] = await Promise.all([
      plexHttpClient.fetchHomeUsers({
        accessToken: linkedAccount.accessToken,
        clientIdentifier: linkedAccount.clientIdentifier,
      }),
      linkedAccount.linkedUser
        ? Promise.resolve(linkedAccount.linkedUser)
        : plexHttpClient.fetchCurrentUser({
          accessToken: linkedAccount.accessToken,
          clientIdentifier: linkedAccount.clientIdentifier,
        }),
      listAppUsers(),
    ]);

    const normalizedCurrentUser = {
      email: normalizePlexEmail(currentUser?.email),
      id: normalizePlexString(currentUser?.id),
      title: normalizePlexString(currentUser?.title) ?? normalizePlexString(currentUser?.username) ?? 'Plex owner',
      username: normalizePlexString(currentUser?.username)?.toLowerCase() ?? null,
      uuid: normalizePlexString(currentUser?.uuid),
    };
    const lookupMaps = toUserLookupMaps(localUsers);
    const classifiedProfiles = withUniqueSuggestedUsernames(homeUsers
      .map((profile) => normalizePlexDirectoryUser(profile, normalizedCurrentUser))
      .map((profile) => classifyRemoteProfile(profile, lookupMaps, normalizedCurrentUser)));

    return {
      fetchedAt: getNow().toISOString(),
      linkedOwner: normalizedCurrentUser,
      profiles: classifiedProfiles.map(mapPreviewProfile),
      summary: summarizeProfiles(classifiedProfiles),
    };
  }

  async function applyImport({ actorUserId, requestMetadata }) {
    const preview = await buildPreview();
    const importableProfiles = preview.profiles.filter((profile) => profile.classification === 'create');
    const refreshProfiles = preview.profiles.filter((profile) => profile.classification === 'linked');

    if (importableProfiles.length === 0 && refreshProfiles.length === 0) {
      return {
        ...preview,
        appliedAt: getNow().toISOString(),
        importedUsers: [],
        summary: {
          ...preview.summary,
          created: 0,
          updated: 0,
        },
      };
    }

    const pool = getPoolFn();
    const client = await pool.connect();
    const importedUsers = [];

    try {
      await client.query('BEGIN');

      for (const profile of importableProfiles) {
        const placeholderPasswordHash = await hashPasswordFn(`plex:${profile.id}:${getNow().toISOString()}`);
        const createdResult = await client.query(
          `
            INSERT INTO app_users (
              username,
              email,
              password_hash,
              role,
              auth_provider,
              auth_subject,
              must_change_password,
              password_changed_at
            )
            VALUES ($1, $2, $3, 'requester', 'plex', $4, FALSE, NULL)
            RETURNING id, username, email, role, auth_provider, auth_subject, is_disabled, must_change_password, managed_library_relative_root, created_at, updated_at, last_login_at
          `,
          [profile.suggestedUsername, profile.email, placeholderPasswordHash, profile.uuid ?? profile.id],
        );
        const user = createdResult.rows[0];

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
            user.id,
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

        importedUsers.push({
          authProvider: user.auth_provider,
          authSubject: user.auth_subject,
          email: user.email,
          id: user.id,
          role: user.role,
          username: user.username,
        });
      }

      for (const profile of refreshProfiles) {
        await client.query(
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
            profile.existingUser.id,
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

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    await recordAuditEventFn({
      actorType: 'user',
      actorUserId,
      details: {
        conflicts: preview.summary.conflicts,
        created: importableProfiles.length,
        linkedRefreshed: refreshProfiles.length,
        skipped: preview.summary.skipped + preview.summary.ownerAccounts,
      },
      entityType: 'plex_directory_import',
      eventType: 'plex_directory_import_applied',
      ipAddress: requestMetadata?.ipAddress ?? null,
      summary: 'Plex directory import applied',
      userAgent: requestMetadata?.userAgent ?? null,
    });

    return {
      ...preview,
      appliedAt: getNow().toISOString(),
      importedUsers,
      summary: {
        ...preview.summary,
        created: importableProfiles.length,
        updated: refreshProfiles.length,
      },
    };
  }

  return {
    applyImport,
    buildPreview,
  };
}
