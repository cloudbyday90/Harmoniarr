<!--
  Harmoniarr - Soulseek-native music library management
  Copyright (C) 2026 Harmoniarr Contributors

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { clearPlexLink, fetchSettings, startPlexLink } from '../lib/settings-api.js';
import {
  buildUsersEmptyStateBody,
  describePlexLibraryAccessPolicy,
  describePlexLocalAuthStatus,
  formatAuthProvider,
  formatPlexConflictReason,
  formatPlexHomeRole,
  formatPlexLibraryAccessState,
  formatPlexLinkStatusDetail,
  formatPlexProfileClassification,
  formatPlexProfileClassificationClass,
  formatUserRole,
  hasPendingManagedLibraryRootChanges,
  plexLibraryAccessPolicyLabel,
  plexLibraryAccessPolicyTone,
} from '../lib/settings-users-presentation.js';
import {
  applyPlexUserImport,
  createUser,
  fetchUsers,
  issueUserClaimCode,
  previewPlexUserImport,
  provisionUserManagedLibraryRoot,
  relinkPlexUserConflict,
  resetUserPassword,
  unlinkPlexUser,
  updateUser,
} from '../lib/users-api.js';

const isUsersLoading = ref(true);
const isCreatingUser = ref(false);
const isPreviewingPlexUsers = ref(false);
const isImportingPlexUsers = ref(false);
const isStartingPlexLink = ref(false);
const isClearingPlexLink = ref(false);
const activePlexRelinkProfileId = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const secretStatus = ref(null);
const roleOptions = ref(['admin', 'operator', 'requester']);
const users = ref([]);
const plexUserImportPreview = ref(null);

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

function applyUsers(payload) {
  roleOptions.value = Array.isArray(payload.roleOptions) && payload.roleOptions.length > 0
    ? payload.roleOptions
    : ['admin', 'operator', 'requester'];
  users.value = Array.isArray(payload.users)
    ? payload.users.map((user) => toEditableUser(user))
    : [];
  if (!roleOptions.value.includes(newUserForm.role)) {
    newUserForm.role = roleOptions.value.at(-1) ?? 'requester';
  }
}

async function loadSettings() {
  try {
    const payload = await fetchSettings();
    secretStatus.value = payload.secretStatus ?? null;
  } catch {
    // secretStatus remains null — Plex link status unavailable
  }
}

async function loadUsers() {
  isUsersLoading.value = true;
  errorMessage.value = '';
  try {
    applyUsers(await fetchUsers());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'User load failed';
  } finally {
    isUsersLoading.value = false;
  }
}

async function connectPlexLink() {
  isStartingPlexLink.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await startPlexLink();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex link start failed';
    isStartingPlexLink.value = false;
  }
}

async function disconnectPlexLink() {
  isClearingPlexLink.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await clearPlexLink();
    if (secretStatus.value?.providers) secretStatus.value.providers.plex = payload.status;
    plexUserImportPreview.value = null;
    successMessage.value = 'Plex owner link cleared.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex link clear failed';
  } finally {
    isClearingPlexLink.value = false;
  }
}

async function loadPlexUserImportPreview() {
  isPreviewingPlexUsers.value = true;
  errorMessage.value = '';
  try {
    plexUserImportPreview.value = await previewPlexUserImport();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex user preview failed';
  } finally {
    isPreviewingPlexUsers.value = false;
  }
}

async function importPlexUsersNow() {
  isImportingPlexUsers.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await applyPlexUserImport();
    plexUserImportPreview.value = payload;
    await loadUsers();
    const created = payload.summary?.created ?? 0;
    const updated = payload.summary?.updated ?? 0;
    successMessage.value = `Plex user import applied. Created ${created}, refreshed ${updated}.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex user import failed';
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
    const payload = await relinkPlexUserConflict({ plexUserId: profile.id, userId: profile.existingUser.id });
    if (plexUserImportPreview.value?.profiles) {
      plexUserImportPreview.value = {
        ...plexUserImportPreview.value,
        profiles: plexUserImportPreview.value.profiles.map((candidate) => (
          candidate.id === payload.profile.id ? payload.profile : candidate
        )),
        summary: {
          ...plexUserImportPreview.value.summary,
          conflicts: Math.max(0, (plexUserImportPreview.value.summary?.conflicts ?? 0) - 1),
          linked: (plexUserImportPreview.value.summary?.linked ?? 0) + 1,
        },
      };
    }
    await loadUsers();
    successMessage.value = `Linked Plex profile ${payload.profile.title} to ${payload.user.username}.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Plex conflict relink failed';
  } finally {
    activePlexRelinkProfileId.value = '';
  }
}

async function saveNewUser() {
  isCreatingUser.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await createUser({
      managedLibraryRelativeRoot: newUserForm.managedLibraryRelativeRoot,
      password: newUserForm.password,
      role: newUserForm.role,
      username: newUserForm.username,
    });
    await loadUsers();
    resetNewUserForm();
    successMessage.value = `User ${payload.user.username} created.`;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'User creation failed';
  } finally {
    isCreatingUser.value = false;
  }
}

async function saveManagedUser(user) {
  user.saving = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await updateUser(user.id, {
      isDisabled: user.pendingIsDisabled,
      managedLibraryRelativeRoot: user.pendingManagedLibraryRelativeRoot,
      role: user.pendingRole,
    });
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users.value[index] = toEditableUser(payload.user, {
        claimCode: users.value[index].claimCode,
        claimCodeExpiresAt: users.value[index].claimCodeExpiresAt,
      });
    }
    successMessage.value = `User ${payload.user.username} updated.`;
  } catch (error) {
    user.saving = false;
    errorMessage.value = error instanceof Error ? error.message : 'User update failed';
  }
}

async function provisionManagedUserLibraryRoot(user) {
  user.provisioning = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await provisionUserManagedLibraryRoot(user.id);
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users.value[index] = toEditableUser(payload.user, {
        claimCode: users.value[index].claimCode,
        claimCodeExpiresAt: users.value[index].claimCodeExpiresAt,
      });
    }
    successMessage.value = payload.provisioning?.created
      ? `Managed library folder provisioned for ${payload.user.username}.`
      : `Managed library folder already existed for ${payload.user.username}.`;
  } catch (error) {
    user.provisioning = false;
    errorMessage.value = error instanceof Error ? error.message : 'Managed library folder provisioning failed';
  }
}

async function issueManagedUserClaimCode(user) {
  user.issuingClaimCode = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await issueUserClaimCode(user.id);
    Object.assign(user, toEditableUser(payload.user, {
      claimCode: payload.claimCode,
      claimCodeExpiresAt: payload.expiresAt,
    }));
    successMessage.value = `Claim code issued for ${payload.user.username}. Share it before ${new Date(payload.expiresAt).toLocaleString()}.`;
  } catch (error) {
    user.issuingClaimCode = false;
    errorMessage.value = error instanceof Error ? error.message : 'User claim code issuance failed';
  }
}

async function resetManagedUserPassword(user) {
  user.resettingPassword = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await resetUserPassword(user.id, user.pendingPasswordReset);
    Object.assign(user, toEditableUser(payload.user, {
      claimCode: user.claimCode,
      claimCodeExpiresAt: user.claimCodeExpiresAt,
    }));
    successMessage.value = `Temporary password set for ${payload.user.username}. The user must change it on next login.`;
  } catch (error) {
    user.resettingPassword = false;
    errorMessage.value = error instanceof Error ? error.message : 'User password reset failed';
  }
}

async function unlinkManagedPlexUser(user) {
  user.unlinkingPlex = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await unlinkPlexUser(user.id);
    Object.assign(user, toEditableUser(payload.user, {
      claimCode: user.claimCode,
      claimCodeExpiresAt: user.claimCodeExpiresAt,
    }));
    if (plexUserImportPreview.value) await loadPlexUserImportPreview();
    successMessage.value = `Plex link removed for ${payload.user.username}. Local sign-in remains available.`;
  } catch (error) {
    user.unlinkingPlex = false;
    errorMessage.value = error instanceof Error ? error.message : 'Plex unlink failed';
  }
}

onMounted(() => { void Promise.all([loadSettings(), loadUsers()]); });
</script>

<template>
  <div class="cfg-page">

    <!-- Plex directory import -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Plex import</h3>
          <p class="hx-card-subtitle">Link your Plex account to preview your Plex home users, then import them as Harmoniarr accounts.</p>
        </div>
        <span class="review-status-pill" :class="secretStatus?.providers?.plex?.linked ? 'review-status-selected' : 'review-status-held'">
          {{ secretStatus?.providers?.plex?.linked ? 'Linked' : 'Not linked' }}
        </span>
      </header>
      <div class="hx-card-body">
        <p class="hx-text-muted" v-if="formatPlexLinkStatusDetail(secretStatus?.providers?.plex)">{{ formatPlexLinkStatusDetail(secretStatus?.providers?.plex) }}</p>
        <div class="hx-card-actions">
          <button type="button" class="hx-btn" @click="connectPlexLink" :disabled="isStartingPlexLink">
            {{ isStartingPlexLink ? 'Starting…' : 'Connect Plex owner account' }}
          </button>
          <button type="button" class="hx-btn" @click="disconnectPlexLink" :disabled="isClearingPlexLink || !secretStatus?.providers?.plex?.linked">
            {{ isClearingPlexLink ? 'Clearing…' : 'Clear Plex link' }}
          </button>
          <button type="button" class="hx-btn" @click="loadPlexUserImportPreview" :disabled="isPreviewingPlexUsers || !secretStatus?.providers?.plex?.linked">
            {{ isPreviewingPlexUsers ? 'Refreshing…' : 'Preview Plex users' }}
          </button>
          <button type="button" class="hx-btn" data-variant="primary" @click="importPlexUsersNow" :disabled="isImportingPlexUsers || !secretStatus?.providers?.plex?.linked">
              {{ isImportingPlexUsers ? 'Importing…' : 'Import ready Plex users' }}
          </button>
        </div>

        <div class="hx-empty" v-if="!plexUserImportPreview">
          <p class="hx-empty-copy">Click Preview to see which Plex home users can be imported, which already exist, and which need attention before importing.</p>
        </div>

        <template v-else>
          <dl class="review-meta-grid review-meta-grid-wide">
            <div><dt>Ready to import</dt><dd>{{ plexUserImportPreview.summary?.importable ?? 0 }}</dd></div>
            <div><dt>Already linked</dt><dd>{{ plexUserImportPreview.summary?.linked ?? 0 }}</dd></div>
            <div><dt>Conflicts</dt><dd>{{ plexUserImportPreview.summary?.conflicts ?? 0 }}</dd></div>
            <div><dt>Owner (skipped)</dt><dd>{{ plexUserImportPreview.summary?.ownerAccounts ?? 0 }}</dd></div>
          </dl>

          <div class="cfg-mapping-list" v-if="plexUserImportPreview.profiles?.length">
            <div class="cfg-mapping-card" v-for="profile in plexUserImportPreview.profiles" :key="`plex-preview-${profile.uuid ?? profile.id}`">
              <div class="cfg-provider-header">
                <div>
                  <p class="hx-text-muted" style="margin-bottom: var(--hx-space-1)">{{ formatPlexHomeRole(profile.homeRole) }}</p>
                  <strong>{{ profile.title }}</strong>
                  <p class="hx-text-muted">{{ profile.email ?? profile.username ?? profile.id }}</p>
                </div>
                <span class="review-status-pill" :class="formatPlexProfileClassificationClass(profile.classification)">
                  {{ formatPlexProfileClassification(profile.classification) }}
                </span>
              </div>
              <p class="hx-text-muted">Library access: {{ formatPlexLibraryAccessState(profile.libraryAccessState) }}</p>
              <p class="hx-text-muted">
                Access policy:
                <span class="hx-pill" :data-tone="plexLibraryAccessPolicyTone(profile.accessPolicy)">{{ plexLibraryAccessPolicyLabel(profile.accessPolicy) }}</span>
              </p>
              <p class="hx-text-muted">{{ describePlexLibraryAccessPolicy(profile.accessPolicy) }}</p>
              <p class="hx-text-muted" v-if="profile.suggestedUsername">Suggested username: {{ profile.suggestedUsername }}</p>
              <p class="hx-text-muted" v-if="profile.existingUser">Existing user: {{ profile.existingUser.username }}<span v-if="profile.conflictReason"> ({{ formatPlexConflictReason(profile.conflictReason) }})</span></p>
              <div v-if="profile.classification === 'conflict' && profile.existingUser?.id">
                <button type="button" class="hx-btn" @click="relinkPlexConflict(profile)" :disabled="activePlexRelinkProfileId === profile.id">
                  {{ activePlexRelinkProfileId === profile.id ? 'Linking…' : `Link to ${profile.existingUser.username}` }}
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </article>

    <!-- Create user + role guide -->
    <div class="cfg-2col">
      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Create user</h3>
            <p class="hx-card-subtitle">New users get a temporary password they must change on first login.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <form @submit.prevent="saveNewUser">
            <div class="hx-field">
              <label class="hx-field-label">Username</label>
              <input class="hx-input" v-model="newUserForm.username" placeholder="listener" />
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Temporary password</label>
              <input class="hx-input" v-model="newUserForm.password" type="password" autocomplete="new-password" placeholder="At least 10 characters" />
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Personal library folder</label>
              <input class="hx-input" v-model="newUserForm.managedLibraryRelativeRoot" placeholder="household/listener" />
              <p class="cfg-field-hint">A subfolder inside the music library that belongs to this user. Their imports go here instead of the shared library root. Leave blank to use the shared root. Example: <code>family/alice</code></p>
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Role</label>
              <select class="hx-select" v-model="newUserForm.role">
                <option v-for="roleOption in roleOptions" :key="roleOption" :value="roleOption">{{ roleOption }}</option>
              </select>
            </div>
            <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
              <button type="submit" class="hx-btn" data-variant="primary" :disabled="isCreatingUser">
                {{ isCreatingUser ? 'Creating…' : 'Create user' }}
              </button>
            </div>
          </form>
        </div>
      </article>

      <article class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Role reference</h3>
            <p class="hx-card-subtitle">What each role can and can't do.</p>
          </div>
        </header>
        <div class="hx-card-body">
          <dl class="review-meta-grid">
            <div>
              <dt>admin</dt>
              <dd>Full control — settings, users, imports, library management, everything.</dd>
            </div>
            <div>
              <dt>operator</dt>
              <dd>Can review and run imports, trigger library scans. Cannot change settings or manage users.</dd>
            </div>
            <div>
              <dt>requester</dt>
              <dd>Can submit music requests through the Request Music screen. Cannot see or manage other users' content.</dd>
            </div>
          </dl>
        </div>
      </article>
    </div>

    <!-- Status message -->
    <div v-if="errorMessage || successMessage" style="display: flex; align-items: center; gap: var(--hx-space-3); padding: var(--hx-space-2) 0">
      <span style="font-size: var(--hx-text-sm); color: var(--hx-danger)" v-if="errorMessage">{{ errorMessage }}</span>
      <span style="font-size: var(--hx-text-sm); color: var(--hx-success)" v-else-if="successMessage">{{ successMessage }}</span>
    </div>

    <!-- User list -->
    <article class="hx-card" v-if="isUsersLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading users…</p>
      </div>
    </article>

    <article class="hx-card" v-else-if="!users.length">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">No users yet</h3>
          <p class="hx-card-subtitle">{{ buildUsersEmptyStateBody() }}</p>
        </div>
      </div>
    </article>

    <div class="cfg-mapping-list" v-else>
      <article class="hx-card" v-for="user in users" :key="user.id">
        <header class="hx-card-header">
          <div>
            <p class="hx-text-muted" style="font-size: var(--hx-text-xs); letter-spacing: 0.08em; margin-bottom: var(--hx-space-1)">{{ formatUserRole(user.role) }}</p>
            <h3 class="hx-card-title">{{ user.username }}</h3>
            <p class="hx-card-subtitle">Signs in with {{ formatAuthProvider(user.authProvider) }}</p>
          </div>
          <span class="hx-pill" :data-tone="user.isDisabled ? 'warning' : 'success'">
            {{ user.isDisabled ? 'Disabled' : 'Active' }}
          </span>
        </header>
        <div class="hx-card-body">
          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label">Role</label>
              <select class="hx-select" v-model="user.pendingRole">
                <option v-for="roleOption in roleOptions" :key="`${user.id}-${roleOption}`" :value="roleOption">{{ roleOption }}</option>
              </select>
            </div>
            <div class="hx-field">
              <label class="hx-field-label">Personal library folder</label>
              <input class="hx-input" v-model="user.pendingManagedLibraryRelativeRoot" placeholder="household/listener" />
            </div>
          </div>
          <div class="hx-form-row">
            <div class="hx-field">
              <label class="hx-field-label">Temporary password</label>
              <input class="hx-input" v-model="user.pendingPasswordReset" type="password" autocomplete="new-password" placeholder="Set a temporary password" />
            </div>
          </div>
          <label class="cfg-check">
            <input type="checkbox" v-model="user.pendingIsDisabled" />
            <span>Disable user access</span>
          </label>
          <p class="hx-text-muted" v-if="user.managedLibraryRelativeRoot" style="margin-top: var(--hx-space-2)">Personal library folder: {{ user.managedLibraryRelativeRoot }}</p>
          <p class="hx-text-muted" v-else style="margin-top: var(--hx-space-2)">No personal library folder — imports go to the shared library root.</p>
          <template v-if="user.plexProfile">
            <p class="hx-text-muted">
              Plex access:
              <span class="hx-pill" :data-tone="plexLibraryAccessPolicyTone(user.plexProfile.accessPolicy)">{{ plexLibraryAccessPolicyLabel(user.plexProfile.accessPolicy) }}</span>
            </p>
            <p class="hx-text-muted">{{ describePlexLibraryAccessPolicy(user.plexProfile.accessPolicy) }}</p>
          </template>
          <p class="hx-text-muted" v-if="hasPendingManagedLibraryRootChanges(user)">Save the personal library folder change before provisioning the folder.</p>
          <p class="hx-text-muted" v-if="user.authProvider === 'plex'">You can set a temporary password to give this user a local sign-in option without removing their Plex link.</p>
          <p class="hx-text-muted" v-if="user.authProvider === 'plex'">{{ describePlexLocalAuthStatus(user) }}</p>
          <p class="hx-text-muted" v-if="user.claimCode">Current claim code: {{ user.claimCode }}</p>
          <p class="hx-text-muted" v-if="user.claimCodeExpiresAt">Claim code expires {{ new Date(user.claimCodeExpiresAt).toLocaleString() }}. The user can complete setup at /claim-account using username {{ user.username }}.</p>
          <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
            <button type="button" class="hx-btn" data-variant="primary" @click="saveManagedUser(user)" :disabled="user.saving">
              {{ user.saving ? 'Saving…' : 'Save user' }}
            </button>
            <button type="button" class="hx-btn" @click="provisionManagedUserLibraryRoot(user)" :disabled="user.provisioning || !user.managedLibraryRelativeRoot || hasPendingManagedLibraryRootChanges(user)">
              {{ user.provisioning ? 'Provisioning…' : 'Provision folder' }}
            </button>
            <button type="button" class="hx-btn" @click="resetManagedUserPassword(user)" :disabled="user.resettingPassword || !user.pendingPasswordReset">
              {{ user.resettingPassword ? 'Setting password…' : 'Set temporary password' }}
            </button>
            <button type="button" class="hx-btn" @click="issueManagedUserClaimCode(user)" :disabled="user.issuingClaimCode">
              {{ user.issuingClaimCode ? 'Issuing claim code…' : 'Issue claim code' }}
            </button>
            <button v-if="user.authProvider === 'plex'" type="button" class="hx-btn" @click="unlinkManagedPlexUser(user)" :disabled="user.unlinkingPlex || !user.localAuth?.unlinkPlexReady">
              {{ user.unlinkingPlex ? 'Removing Plex link…' : 'Unlink Plex account' }}
            </button>
          </div>
        </div>
      </article>
    </div>

  </div>
</template>
