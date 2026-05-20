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

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

const REPAIR_PRIORITY = Object.freeze({
  provider_mismatch: 0,
  profile_sync_missing: 1,
  remote_profile_missing: 2,
  local_auth_required: 3,
  preview_unavailable: 4,
  healthy: 5,
});

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

function buildLinkedUserEntry(user, { ownerLinked, previewProfiles, previewReady }) {
  const previewProfile = findMatchingPreviewProfile(user, previewProfiles);
  const unlinkReady = user?.localAuth?.unlinkPlexReady === true;
  let repairState = 'healthy';
  let repairMessage = 'Linked and ready for normal operator maintenance.';

  if (user?.authProvider === 'plex' && !user?.plexProfile) {
    repairState = 'profile_sync_missing';
    repairMessage = 'This user still signs in with Plex, but their synced Plex profile record is missing locally.';
  } else if (user?.authProvider !== 'plex' && user?.plexProfile) {
    repairState = 'provider_mismatch';
    repairMessage = 'A Plex profile is still attached, but this user no longer uses Plex as their primary sign-in provider.';
  } else if (previewReady && !previewProfile) {
    repairState = 'remote_profile_missing';
    repairMessage = 'This linked app user was not found in the latest Plex home preview. Review before relying on this link.';
  } else if (ownerLinked && !previewReady) {
    repairState = 'preview_unavailable';
    repairMessage = 'Plex is linked, but the latest directory preview could not be loaded. Review remote status before changing links.';
  } else if (!unlinkReady) {
    repairState = 'local_auth_required';
    repairMessage = user?.localAuth?.unlinkPlexBlockedReason
      ?? 'Set a temporary password or have the user claim local sign-in before unlinking Plex.';
  }

  return {
    authProvider: user?.authProvider ?? 'local',
    authSubject: user?.authSubject ?? null,
    id: user?.id ?? null,
    localAuth: user?.localAuth ?? null,
    plexProfile: user?.plexProfile ?? null,
    previewProfile,
    repairMessage,
    repairState,
    unlinkReady,
    username: user?.username ?? '',
  };
}

function sortLinkedUsers(a, b) {
  const priorityA = REPAIR_PRIORITY[a?.repairState] ?? 99;
  const priorityB = REPAIR_PRIORITY[b?.repairState] ?? 99;
  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  return String(a?.username ?? '').localeCompare(String(b?.username ?? ''), undefined, { sensitivity: 'base' });
}

function buildPreviewStatus({ ownerLink, preview, previewError }) {
  if (!ownerLink?.linked) {
    return {
      code: 'plex_link_required',
      message: 'Connect a Plex owner account before previewing or repairing linked accounts.',
      state: 'owner_link_required',
    };
  }

  if (previewError) {
    return {
      code: previewError.code ?? 'plex_preview_failed',
      message: previewError.message ?? 'Plex linked-account preview is unavailable.',
      state: 'error',
    };
  }

  return {
    code: null,
    fetchedAt: preview?.fetchedAt ?? null,
    message: 'Plex linked-account preview is current.',
    state: 'ready',
  };
}

function summarizeLinkedAccounts({ conflictProfiles, importableProfiles, linkedUsers, ownerLink, previewLinkedProfiles }) {
  return {
    conflictProfiles: conflictProfiles.length,
    importableProfiles: importableProfiles.length,
    linkedUsers: linkedUsers.length,
    ownerLinked: ownerLink?.linked === true,
    repairRequiredUsers: linkedUsers.filter((entry) => entry.repairState !== 'healthy').length,
    staleUsers: linkedUsers.filter((entry) => ['profile_sync_missing', 'provider_mismatch', 'remote_profile_missing'].includes(entry.repairState)).length,
    unlinkBlockedUsers: linkedUsers.filter((entry) => entry.unlinkReady !== true).length,
    unlinkReadyUsers: linkedUsers.filter((entry) => entry.unlinkReady === true).length,
    previewLinkedProfiles: previewLinkedProfiles.length,
  };
}

export function createPlexLinkedAccountManagementService({
  buildPlexDirectoryImportPreview = async () => ({ fetchedAt: null, linkedOwner: null, profiles: [], summary: {} }),
  buildPlexLinkStatus = async () => ({ linked: false }),
  listAppUsers = async () => [],
} = {}) {
  async function buildOverview() {
    const [ownerLink, localUsers] = await Promise.all([
      buildPlexLinkStatus(),
      listAppUsers(),
    ]);

    let preview = null;
    let previewError = null;
    if (ownerLink?.linked) {
      try {
        preview = await buildPlexDirectoryImportPreview();
      } catch (error) {
        previewError = {
          code: error?.code ?? 'plex_preview_failed',
          message: error?.message ?? 'Plex linked-account preview is unavailable.',
        };
      }
    }

    const previewProfiles = Array.isArray(preview?.profiles) ? preview.profiles : [];
    const previewReady = previewError == null && ownerLink?.linked === true;
    const linkedUsers = Array.isArray(localUsers)
      ? localUsers
        .filter((user) => user?.authProvider === 'plex' || user?.plexProfile)
        .map((user) => buildLinkedUserEntry(user, {
          ownerLinked: ownerLink?.linked === true,
          previewProfiles,
          previewReady,
        }))
        .sort(sortLinkedUsers)
      : [];
    const importableProfiles = previewProfiles.filter((profile) => profile?.classification === 'create');
    const conflictProfiles = previewProfiles.filter((profile) => profile?.classification === 'conflict');
    const previewLinkedProfiles = previewProfiles.filter((profile) => profile?.classification === 'linked');

    return {
      checkedAt: new Date().toISOString(),
      conflictProfiles,
      importableProfiles,
      linkedUsers,
      ownerLink,
      previewLinkedProfiles,
      previewStatus: buildPreviewStatus({ ownerLink, preview, previewError }),
      summary: summarizeLinkedAccounts({
        conflictProfiles,
        importableProfiles,
        linkedUsers,
        ownerLink,
        previewLinkedProfiles,
      }),
    };
  }

  return {
    buildOverview,
  };
}
