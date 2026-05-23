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

import { computed, reactive, ref } from 'vue';
import { getErrorMessage } from '../lib/error-utils.js';
import { startPlexLink as defaultStartPlexLink, clearPlexLink as defaultClearPlexLink } from '../lib/settings-api.js';
import {
  applyPlexUserImport as defaultApplyPlexUserImport,
  createUser as defaultCreateUser,
  issueUserClaimCode as defaultIssueUserClaimCode,
  provisionUserManagedLibraryRoot as defaultProvisionUserManagedLibraryRoot,
  reconcilePlexLinkedAccount as defaultReconcilePlexLinkedAccount,
  relinkPlexUserConflict as defaultRelinkPlexUserConflict,
  resetUserPassword as defaultResetUserPassword,
  unlinkPlexUser as defaultUnlinkPlexUser,
  updateUser as defaultUpdateUser,
} from '../lib/users-api.js';

export function useSettingsUserMutations({
  users,
  loadUsers,
  loadPlexLinkedAccountsOverview,
  revalidateUsers,
  startPlexLinkFn = defaultStartPlexLink,
  clearPlexLinkFn = defaultClearPlexLink,
  createUserFn = defaultCreateUser,
  updateUserFn = defaultUpdateUser,
  provisionUserManagedLibraryRootFn = defaultProvisionUserManagedLibraryRoot,
  issueUserClaimCodeFn = defaultIssueUserClaimCode,
  resetUserPasswordFn = defaultResetUserPassword,
  unlinkPlexUserFn = defaultUnlinkPlexUser,
  applyPlexUserImportFn = defaultApplyPlexUserImport,
  relinkPlexUserConflictFn = defaultRelinkPlexUserConflict,
  reconcilePlexLinkedAccountFn = defaultReconcilePlexLinkedAccount,
} = {}) {
  const errorMessage = ref('');
  const successMessage = ref('');
  const isCreatingUser = ref(false);
  const isStartingPlexLink = ref(false);
  const isClearingPlexLink = ref(false);
  const isImportingPlexUsers = ref(false);
  const activePlexRelinkProfileId = ref('');
  const activePlexLinkedAccountActionKey = ref('');
  const roleOptions = ref(['admin', 'operator', 'requester']);

  const linkedUsersById = computed(() => new Map(users.value.map((user) => [user.id, user])));

  const newUserForm = reactive({
    managedLibraryRelativeRoot: '',
    password: '',
    role: 'requester',
    username: '',
  });

  function toEditableUser(user, overrides = {}) {
    return {
      ...user,
      claimCode: overrides.claimCode ?? null,
      claimCodeExpiresAt: overrides.claimCodeExpiresAt ?? null,
      issuingClaimCode: false,
      pendingIsDisabled: Boolean(user.isDisabled),
      pendingManagedLibraryRelativeRoot: user.managedLibraryRelativeRoot ?? '',
      pendingPasswordReset: '',
      pendingRole: user.role,
      provisioning: false,
      resettingPassword: false,
      saving: false,
      unlinkingPlex: false,
    };
  }

  function resetNewUserForm() {
    newUserForm.managedLibraryRelativeRoot = '';
    newUserForm.password = '';
    newUserForm.role = roleOptions.value.includes('requester') ? 'requester' : (roleOptions.value[0] ?? 'requester');
    newUserForm.username = '';
  }

  function findEditableUser(userId) {
    return linkedUsersById.value.get(userId) ?? null;
  }

  function buildPlexLinkedAccountActionKey(userId, action) {
    return `${userId}:${action}`;
  }

  function isPlexLinkedAccountActionPending(userId, action) {
    return activePlexLinkedAccountActionKey.value === buildPlexLinkedAccountActionKey(userId, action);
  }

  function replaceUserEntry(user, overrides) {
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users.value[index] = toEditableUser(user, overrides);
    }
  }

  async function connectPlexLink() {
    isStartingPlexLink.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await startPlexLinkFn();
      window.location.href = payload.authorizationUrl;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Plex link start failed');
      isStartingPlexLink.value = false;
    }
  }

  async function disconnectPlexLink() {
    isClearingPlexLink.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      await clearPlexLinkFn();
      await loadPlexLinkedAccountsOverview();
      successMessage.value = 'Plex owner link cleared.';
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Plex link clear failed');
    } finally {
      isClearingPlexLink.value = false;
    }
  }

  async function loadPlexUserImportPreview() {
    errorMessage.value = '';
    await loadPlexLinkedAccountsOverview();
  }

  async function importPlexUsersNow() {
    isImportingPlexUsers.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await applyPlexUserImportFn();
      await Promise.all([loadUsers(), loadPlexLinkedAccountsOverview()]);
      const created = payload.summary?.created ?? 0;
      const updated = payload.summary?.updated ?? 0;
      successMessage.value = `Plex user import applied. Created ${created}, refreshed ${updated}.`;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Plex user import failed');
    } finally {
      isImportingPlexUsers.value = false;
    }
  }

  async function relinkPlexConflict(profile) {
    if (!profile?.existingUser?.id || !profile?.id) return;
    activePlexRelinkProfileId.value = profile.id;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await relinkPlexUserConflictFn({ plexUserId: profile.id, userId: profile.existingUser.id });
      await Promise.all([loadUsers(), loadPlexLinkedAccountsOverview()]);
      successMessage.value = `Linked Plex profile ${payload.profile.title} to ${payload.user.username}.`;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Plex conflict relink failed');
    } finally {
      activePlexRelinkProfileId.value = '';
    }
  }

  async function runPlexLinkedAccountAction(linkedUser, action) {
    if (!linkedUser?.id) return;

    activePlexLinkedAccountActionKey.value = buildPlexLinkedAccountActionKey(linkedUser.id, action);
    errorMessage.value = '';
    successMessage.value = '';

    try {
      const payload = await reconcilePlexLinkedAccountFn(linkedUser.id, action);
      await Promise.all([loadUsers(), loadPlexLinkedAccountsOverview()]);

      switch (action) {
        case 'mark_stale':
          successMessage.value = `Marked ${linkedUser.username} as a reviewed stale Plex link.`;
          break;
        case 'safe_relink':
          successMessage.value = `Relinked ${payload.user.username} back to Plex sign-in using the latest preview.`;
          break;
        default:
          successMessage.value = `Refreshed the Plex profile snapshot for ${payload.user.username}.`;
          break;
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'Plex linked-account reconciliation failed');
    } finally {
      activePlexLinkedAccountActionKey.value = '';
    }
  }

  async function saveNewUser() {
    isCreatingUser.value = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await createUserFn({
        managedLibraryRelativeRoot: newUserForm.managedLibraryRelativeRoot,
        password: newUserForm.password,
        role: newUserForm.role,
        username: newUserForm.username,
      });
      await loadUsers();
      resetNewUserForm();
      successMessage.value = `User ${payload.user.username} created.`;
    } catch (error) {
      errorMessage.value = getErrorMessage(error, 'User creation failed');
    } finally {
      isCreatingUser.value = false;
    }
  }

  async function saveManagedUser(user) {
    user.saving = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await updateUserFn(user.id, {
        isDisabled: user.pendingIsDisabled,
        managedLibraryRelativeRoot: user.pendingManagedLibraryRelativeRoot,
        role: user.pendingRole,
      });
      replaceUserEntry(payload.user, {
        claimCode: user.claimCode,
        claimCodeExpiresAt: user.claimCodeExpiresAt,
      });
      successMessage.value = `User ${payload.user.username} updated.`;
      if (revalidateUsers) void revalidateUsers();
    } catch (error) {
      user.saving = false;
      errorMessage.value = getErrorMessage(error, 'User update failed');
    }
  }

  async function provisionManagedUserLibraryRoot(user) {
    user.provisioning = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await provisionUserManagedLibraryRootFn(user.id);
      replaceUserEntry(payload.user, {
        claimCode: user.claimCode,
        claimCodeExpiresAt: user.claimCodeExpiresAt,
      });
      successMessage.value = payload.provisioning?.created
        ? `Managed library folder provisioned for ${payload.user.username}.`
        : `Managed library folder already existed for ${payload.user.username}.`;
      if (revalidateUsers) void revalidateUsers();
    } catch (error) {
      user.provisioning = false;
      errorMessage.value = getErrorMessage(error, 'Managed library folder provisioning failed');
    }
  }

  async function issueManagedUserClaimCode(user) {
    user.issuingClaimCode = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await issueUserClaimCodeFn(user.id);
      Object.assign(user, toEditableUser(payload.user, {
        claimCode: payload.claimCode,
        claimCodeExpiresAt: payload.expiresAt,
      }));
      successMessage.value = `Claim code issued for ${payload.user.username}. Share it before ${new Date(payload.expiresAt).toLocaleString()}.`;
    } catch (error) {
      user.issuingClaimCode = false;
      errorMessage.value = getErrorMessage(error, 'User claim code issuance failed');
    }
  }

  async function resetManagedUserPassword(user) {
    user.resettingPassword = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await resetUserPasswordFn(user.id, user.pendingPasswordReset);
      Object.assign(user, toEditableUser(payload.user, {
        claimCode: user.claimCode,
        claimCodeExpiresAt: user.claimCodeExpiresAt,
      }));
      successMessage.value = `Temporary password set for ${payload.user.username}. The user must change it on next login.`;
      if (revalidateUsers) void revalidateUsers();
    } catch (error) {
      user.resettingPassword = false;
      errorMessage.value = getErrorMessage(error, 'User password reset failed');
    }
  }

  async function unlinkManagedPlexUser(user) {
    user.unlinkingPlex = true;
    errorMessage.value = '';
    successMessage.value = '';
    try {
      const payload = await unlinkPlexUserFn(user.id);
      Object.assign(user, toEditableUser(payload.user, {
        claimCode: user.claimCode,
        claimCodeExpiresAt: user.claimCodeExpiresAt,
      }));
      await loadPlexLinkedAccountsOverview();
      if (revalidateUsers) await revalidateUsers();
      successMessage.value = `Plex link removed for ${payload.user.username}. Local sign-in remains available.`;
    } catch (error) {
      user.unlinkingPlex = false;
      errorMessage.value = getErrorMessage(error, 'Plex unlink failed');
    }
  }

  async function unlinkLinkedPlexAccount(userId) {
    const user = findEditableUser(userId);
    if (!user) return;
    await unlinkManagedPlexUser(user);
  }

  return {
    activePlexLinkedAccountActionKey,
    activePlexRelinkProfileId,
    connectPlexLink,
    disconnectPlexLink,
    errorMessage,
    findEditableUser,
    importPlexUsersNow,
    isClearingPlexLink,
    isCreatingUser,
    isImportingPlexUsers,
    isPlexLinkedAccountActionPending,
    isStartingPlexLink,
    issueManagedUserClaimCode,
    linkedUsersById,
    loadPlexUserImportPreview,
    newUserForm,
    provisionManagedUserLibraryRoot,
    relinkPlexConflict,
    resetManagedUserPassword,
    resetNewUserForm,
    roleOptions,
    runPlexLinkedAccountAction,
    saveManagedUser,
    saveNewUser,
    successMessage,
    toEditableUser,
    unlinkLinkedPlexAccount,
    unlinkManagedPlexUser,
  };
}
