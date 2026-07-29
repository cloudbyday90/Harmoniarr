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
import { computed, onMounted, ref, watch } from 'vue';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import { usePlexLinkedAccounts } from '../composables/usePlexLinkedAccounts.js';
import { useAdminUserList } from '../composables/useAdminUserList.js';
import { useSettingsUserMutations } from '../composables/useSettingsUserMutations.js';
import { buildUsersAccessPosture } from '../lib/settings-users-access-presentation.js';
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
  formatPlexLinkedAccountActionLabel,
  formatPlexLinkedAccountsCountLabel,
  formatPlexOwnerLinkLabel,
  formatPlexOwnerLinkTone,
  formatPlexPreviewStateLabel,
  formatPlexRepairStateLabel,
  formatPlexRepairStateTone,
  hasPlexRepairQueue,
} from '../lib/plex-linked-accounts-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import { fetchPlexLinkedAccountsOverview } from '../lib/users-api.js';

const userList = useAdminUserList();
const users = ref([]);

const isUsersLoading = computed(() => userList.isLoading.value);
const searchQuery = ref('');
const userRoleFilter = ref('');
const userStatusFilter = ref('');

const {
  errorMessage: plexLinkedAccountsErrorMessage,
  isLoading: isLoadingPlexLinkedAccounts,
  load: loadPlexLinkedAccountsOverview,
  overview: plexLinkedAccountsOverview,
} = usePlexLinkedAccounts({ fetchPlexLinkedAccountsOverview });

async function loadUsers() {
  userList.setSearch(searchQuery.value);
  userList.setRoleFilter(userRoleFilter.value);
  userList.setStatusFilter(userStatusFilter.value);
  await userList.load();
  users.value = userList.users.value.map((user) => toEditableUser(user));
}

const {
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
  loadPlexUserImportPreview,
  newUserForm,
  provisionManagedUserLibraryRoot,
  relinkPlexConflict,
  resetManagedUserPassword,
  roleOptions,
  runPlexLinkedAccountAction,
  saveManagedUser,
  saveNewUser,
  successMessage,
  toEditableUser,
  unlinkLinkedPlexAccount,
  unlinkManagedPlexUser,
} = useSettingsUserMutations({
  users,
  loadUsers,
  loadPlexLinkedAccountsOverview,
  revalidateUsers: () => userList.revalidate(),
});

watch(() => userList.users.value, (rawUsers) => {
  users.value = rawUsers.map((user) => toEditableUser(user));
}, { immediate: true });

const plexOwnerLinked = computed(() => plexLinkedAccountsOverview.value.ownerLink?.linked === true);
const plexRepairQueueActive = computed(() => hasPlexRepairQueue(plexLinkedAccountsOverview.value));
const accessPosture = computed(() => buildUsersAccessPosture({
  isFiltered: Boolean(searchQuery.value || userRoleFilter.value || userStatusFilter.value),
  isLoading: isUsersLoading.value,
  plexOwnerLinked: plexOwnerLinked.value,
  totalCount: userList.totalCount.value,
  users: users.value,
}));

async function loadMoreUsers() {
  await userList.loadMore();
}

onMounted(() => {
  void Promise.all([loadUsers(), loadPlexLinkedAccountsOverview()]);
});
</script>

<template>
  <div class="cfg-page">

    <article class="hx-card settings-users__posture">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Account access</h2>
          <p class="hx-card-subtitle">Saved account and integration state. Role and sign-in changes are enforced by the server.</p>
        </div>
        <span class="hx-pill" :data-tone="accessPosture.tone">{{ accessPosture.statusLabel }}</span>
      </header>
      <div class="hx-card-body">
        <p class="settings-users__posture-message" role="status" aria-atomic="true">{{ accessPosture.message }}</p>
        <div v-if="accessPosture.checks.length" class="settings-users__posture-checks">
          <div v-for="check in accessPosture.checks" :key="check.label" class="settings-users__posture-check">
            <span>{{ check.label }}</span>
            <span class="hx-pill" :data-tone="check.tone">{{ check.statusLabel }}</span>
          </div>
        </div>
      </div>
    </article>

    <!-- Plex linked accounts -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Plex account</h2>
          <p class="hx-card-subtitle">Optional sign-in and household-account connection.</p>
        </div>
        <span class="hx-pill" :data-tone="formatPlexOwnerLinkTone(plexLinkedAccountsOverview.ownerLink)">
          {{ formatPlexOwnerLinkLabel(plexLinkedAccountsOverview.ownerLink) }}
        </span>
      </header>
      <div class="hx-card-body">
        <SettingsDisclosure
          panel-id="settings-plex-account-maintenance"
          :heading-level="3"
          title="Plex account maintenance"
          subtitle="Connect the owner account, review linked people, and resolve import or relink issues."
          show-label="Manage Plex accounts"
          hide-label="Hide Plex account maintenance"
          variant="inline"
        >
        <div class="hx-card-actions" style="margin-bottom: var(--hx-space-3)">
          <button type="button" class="hx-btn" @click="connectPlexLink" :disabled="isStartingPlexLink">
            {{ isStartingPlexLink ? 'Starting…' : 'Connect Plex owner account' }}
          </button>
          <button type="button" class="hx-btn" @click="disconnectPlexLink" :disabled="isClearingPlexLink || !plexOwnerLinked">
            {{ isClearingPlexLink ? 'Clearing…' : 'Clear Plex owner link' }}
          </button>
          <button type="button" class="hx-btn" @click="loadPlexUserImportPreview" :disabled="isLoadingPlexLinkedAccounts">
            {{ isLoadingPlexLinkedAccounts ? 'Refreshing…' : 'Refresh linked-account preview' }}
          </button>
          <button type="button" class="hx-btn" data-variant="primary" @click="importPlexUsersNow" :disabled="isImportingPlexUsers || !plexOwnerLinked">
            {{ isImportingPlexUsers ? 'Importing…' : 'Import ready Plex users' }}
          </button>
        </div>

        <p class="hx-text-muted" v-if="formatPlexLinkStatusDetail(plexLinkedAccountsOverview.ownerLink)">{{ formatPlexLinkStatusDetail(plexLinkedAccountsOverview.ownerLink) }}</p>
        <p class="hx-text-muted" v-if="plexLinkedAccountsOverview.ownerLink?.linkedAt">Owner linked {{ formatOperationTimestampShort(plexLinkedAccountsOverview.ownerLink.linkedAt) }}</p>
        <p class="hx-text-muted" v-if="plexRepairQueueActive">Repair queue active: review link blockers, stale profiles, and import conflicts before treating Plex sign-in as stable.</p>
        <p class="hx-text-muted" v-if="plexLinkedAccountsOverview.summary.acknowledgedStaleUsers > 0">{{ formatPlexLinkedAccountsCountLabel(plexLinkedAccountsOverview.summary.acknowledgedStaleUsers, 'stale acknowledged') }} after the latest preview.</p>

        <div class="hx-stat-grid" style="margin-top: var(--hx-space-4); margin-bottom: var(--hx-space-4)">
          <div class="hx-stat">
            <span class="hx-stat-label">LINKED USERS</span>
            <span class="hx-stat-value">{{ plexLinkedAccountsOverview.summary.linkedUsers }}</span>
            <span class="hx-stat-meta">{{ formatPlexLinkedAccountsCountLabel(plexLinkedAccountsOverview.summary.unlinkReadyUsers, 'unlink-ready') }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">REPAIR REQUIRED</span>
            <span class="hx-stat-value">{{ plexLinkedAccountsOverview.summary.repairRequiredUsers }}</span>
            <span class="hx-stat-meta">{{ formatPlexLinkedAccountsCountLabel(plexLinkedAccountsOverview.summary.staleUsers, 'stale') }}</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">IMPORT READY</span>
            <span class="hx-stat-value">{{ plexLinkedAccountsOverview.summary.importableProfiles }}</span>
            <span class="hx-stat-meta">Profiles that can become app users now</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">CONFLICTS</span>
            <span class="hx-stat-value">{{ plexLinkedAccountsOverview.summary.conflictProfiles }}</span>
            <span class="hx-stat-meta">Profiles that need explicit relink decisions</span>
          </div>
          <div class="hx-stat">
            <span class="hx-stat-label">PREVIEW</span>
            <span class="hx-stat-value" style="font-size: var(--hx-text-sm)">{{ formatPlexPreviewStateLabel(plexLinkedAccountsOverview.previewStatus) }}</span>
            <span class="hx-stat-meta">{{ plexLinkedAccountsOverview.previewStatus.message }}</span>
          </div>
        </div>

        <div v-if="plexLinkedAccountsErrorMessage" class="hx-card-body" style="padding-inline: 0">
          <span class="hx-pill" data-tone="danger">{{ plexLinkedAccountsErrorMessage }}</span>
        </div>

        <div v-else-if="!plexOwnerLinked && !isLoadingPlexLinkedAccounts" class="hx-empty">
          <p class="hx-empty-title">No Plex owner account connected</p>
          <p class="hx-empty-copy">Connect the Plex owner account first. Once linked, this workspace will show linked Harmoniarr users, importable home members, and repair blockers.</p>
        </div>

        <template v-else>
          <div class="hx-table-scroll" v-if="plexLinkedAccountsOverview.linkedUsers.length">
            <table class="hx-table" aria-label="Plex linked users">
              <thead>
                <tr>
                  <th>App user</th>
                  <th>Plex identity</th>
                  <th>Health</th>
                  <th>Local auth</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="linkedUser in plexLinkedAccountsOverview.linkedUsers" :key="linkedUser.id">
                  <td>
                    <strong>{{ linkedUser.username }}</strong>
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)">{{ linkedUser.plexProfile?.plexTitle ?? linkedUser.previewProfile?.title ?? 'Plex user' }}</div>
                  </td>
                  <td>
                    {{ linkedUser.plexProfile?.plexEmail ?? linkedUser.previewProfile?.email ?? linkedUser.plexProfile?.plexUsername ?? linkedUser.previewProfile?.username ?? linkedUser.authSubject ?? '—' }}
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)">Synced {{ linkedUser.plexProfile?.syncedAt ? formatOperationTimestampShort(linkedUser.plexProfile.syncedAt) : '—' }}</div>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="formatPlexRepairStateTone(linkedUser.repairState)">{{ formatPlexRepairStateLabel(linkedUser.repairState) }}</span>
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)">{{ linkedUser.repairMessage }}</div>
                    <div class="hx-text-muted" style="margin-top: var(--hx-space-1)" v-if="linkedUser.staleAcknowledgement?.occurredAt">Acknowledged {{ formatOperationTimestampShort(linkedUser.staleAcknowledgement.occurredAt) }}</div>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="linkedUser.unlinkReady ? 'success' : 'warning'">
                      {{ linkedUser.unlinkReady ? 'Ready' : 'Needs password' }}
                    </span>
                  </td>
                  <td>
                    <div class="hx-card-actions">
                      <a :href="`#user-card-${linkedUser.id}`" class="hx-btn" data-variant="ghost">Review user</a>
                      <button
                        v-for="action in linkedUser.availableActions ?? []"
                        :key="`${linkedUser.id}-${action}`"
                        type="button"
                        class="hx-btn"
                        :data-variant="action === 'safe_relink' ? 'primary' : null"
                        :disabled="isPlexLinkedAccountActionPending(linkedUser.id, action)"
                        @click="runPlexLinkedAccountAction(linkedUser, action)"
                      >
                        {{ isPlexLinkedAccountActionPending(linkedUser.id, action) ? 'Working…' : formatPlexLinkedAccountActionLabel(action) }}
                      </button>
                      <button
                        type="button"
                        class="hx-btn"
                        :disabled="!linkedUser.unlinkReady || findEditableUser(linkedUser.id)?.unlinkingPlex"
                        @click="unlinkLinkedPlexAccount(linkedUser.id)"
                      >
                        {{ findEditableUser(linkedUser.id)?.unlinkingPlex ? 'Removing…' : 'Unlink Plex' }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="hx-empty" v-else>
            <p class="hx-empty-title">No linked Plex app users</p>
            <p class="hx-empty-copy">Use the import queue below to create or relink Harmoniarr users from the connected Plex home.</p>
          </div>

          <div class="cfg-mapping-list" v-if="plexLinkedAccountsOverview.importableProfiles.length || plexLinkedAccountsOverview.conflictProfiles.length" style="margin-top: var(--hx-space-4)">
            <div
              class="cfg-mapping-card"
              v-for="profile in [...plexLinkedAccountsOverview.conflictProfiles, ...plexLinkedAccountsOverview.importableProfiles]"
              :key="`plex-linked-overview-${profile.uuid ?? profile.id}`"
            >
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
        </SettingsDisclosure>
      </div>
    </article>

    <div class="settings-users__support">
      <SettingsDisclosure
        panel-id="settings-add-user"
        title="Add a user"
        subtitle="Create a sign-in for a household member or operator. New users must change their temporary password on first login."
        show-label="Add user"
        hide-label="Hide add user"
      >
        <form @submit.prevent="saveNewUser">
          <div class="hx-field">
            <label class="hx-field-label" for="settings-new-user-username">Username</label>
            <input id="settings-new-user-username" class="hx-input" v-model="newUserForm.username" placeholder="listener" />
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="settings-new-user-password">Temporary password</label>
            <input id="settings-new-user-password" class="hx-input" v-model="newUserForm.password" type="password" autocomplete="new-password" placeholder="At least 10 characters" />
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="settings-new-user-library-folder">Personal library folder</label>
            <input id="settings-new-user-library-folder" class="hx-input" v-model="newUserForm.managedLibraryRelativeRoot" placeholder="household/listener" />
            <p class="cfg-field-hint">A subfolder inside the music library that belongs to this user. Their imports go here instead of the shared library root. Leave blank to use the shared root. Example: <code>family/alice</code></p>
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="settings-new-user-role">Role</label>
            <select id="settings-new-user-role" class="hx-select" v-model="newUserForm.role">
              <option v-for="roleOption in roleOptions" :key="roleOption" :value="roleOption">{{ formatUserRole(roleOption) }}</option>
            </select>
          </div>
          <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
            <button type="submit" class="hx-btn" data-variant="primary" :disabled="isCreatingUser">
              {{ isCreatingUser ? 'Creating…' : 'Create user' }}
            </button>
          </div>
        </form>
      </SettingsDisclosure>

      <SettingsDisclosure
        panel-id="settings-user-role-reference"
        title="About roles"
        subtitle="Check the scope of a role before assigning it. Permissions remain enforced on every server request."
        show-label="Show role guide"
        hide-label="Hide role guide"
      >
        <dl class="review-meta-grid">
          <div>
            <dt>Admin</dt>
            <dd>Full control of settings, people, imports, and the library.</dd>
          </div>
          <div>
            <dt>Operator</dt>
            <dd>Can review and run imports and trigger library scans. Cannot change settings or manage people.</dd>
          </div>
          <div>
            <dt>Requester</dt>
            <dd>Can request music. Cannot view or manage other people’s content.</dd>
          </div>
        </dl>
      </SettingsDisclosure>
    </div>

    <!-- Status message -->
    <div v-if="errorMessage || successMessage" style="display: flex; align-items: center; gap: var(--hx-space-3); padding: var(--hx-space-2) 0">
      <span style="font-size: var(--hx-text-sm); color: var(--hx-danger)" v-if="errorMessage">{{ errorMessage }}</span>
      <span style="font-size: var(--hx-text-sm); color: var(--hx-success)" v-else-if="successMessage">{{ successMessage }}</span>
    </div>

    <div class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">People</h2>
          <p class="hx-card-subtitle">Review access at a glance, then open a specific task only when you need to change an account.</p>
        </div>
        <span class="hx-pill" data-tone="info">{{ userList.totalCount.value }} total</span>
      </header>
      <div class="hx-card-body suf-bar">
        <input class="hx-input suf-search" v-model="searchQuery" type="search" placeholder="Search users…" aria-label="Search users" @input="void loadUsers()" />
        <select class="hx-select" v-model="userRoleFilter" aria-label="Filter people by role" @change="void loadUsers()">
          <option value="">All roles</option>
          <option v-for="opt in roleOptions" :key="opt" :value="opt">{{ formatUserRole(opt) }}</option>
        </select>
        <select class="hx-select" v-model="userStatusFilter" aria-label="Filter people by status" @change="void loadUsers()">
          <option value="">All statuses</option>
          <option value="false">Enabled</option>
          <option value="true">Disabled</option>
        </select>
      </div>
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
      <article class="hx-card" v-for="user in users" :id="`user-card-${user.id}`" :key="user.id">
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
          <div class="settings-users__user-summary">
            <p><span>Sign-in</span><strong>{{ formatAuthProvider(user.authProvider) }}</strong></p>
            <p><span>Library folder</span><strong>{{ user.managedLibraryRelativeRoot || 'Shared library' }}</strong></p>
            <p><span>Access</span><strong>{{ user.isDisabled ? 'Disabled' : 'Enabled' }}</strong></p>
          </div>
          <template v-if="user.plexProfile">
            <p class="hx-text-muted">
              Plex access:
              <span class="hx-pill" :data-tone="plexLibraryAccessPolicyTone(user.plexProfile.accessPolicy)">{{ plexLibraryAccessPolicyLabel(user.plexProfile.accessPolicy) }}</span>
            </p>
            <p class="hx-text-muted">{{ describePlexLibraryAccessPolicy(user.plexProfile.accessPolicy) }}</p>
          </template>
          <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
            <router-link :to="{ name: 'settings-user-detail', params: { userId: user.id } }" class="hx-btn" data-variant="ghost">View user details</router-link>
          </div>

          <SettingsDisclosure
            :panel-id="`settings-user-${user.id}-access`"
            :heading-level="4"
            title="Manage access"
            subtitle="Change the role, account availability, or personal library folder."
            show-label="Manage access"
            hide-label="Hide access controls"
            variant="inline"
          >
            <div class="hx-form-row">
              <div class="hx-field">
                <label class="hx-field-label" :for="`settings-user-${user.id}-role`">Role</label>
                <select :id="`settings-user-${user.id}-role`" class="hx-select" v-model="user.pendingRole">
                  <option v-for="roleOption in roleOptions" :key="`${user.id}-${roleOption}`" :value="roleOption">{{ formatUserRole(roleOption) }}</option>
                </select>
              </div>
              <div class="hx-field">
                <label class="hx-field-label" :for="`settings-user-${user.id}-library-folder`">Personal library folder</label>
                <input :id="`settings-user-${user.id}-library-folder`" class="hx-input" v-model="user.pendingManagedLibraryRelativeRoot" placeholder="household/listener" />
              </div>
            </div>
            <label class="cfg-check">
              <input type="checkbox" v-model="user.pendingIsDisabled" />
              <span>Disable user access</span>
            </label>
            <p class="hx-text-muted" v-if="hasPendingManagedLibraryRootChanges(user)">Save the personal library folder change before provisioning the folder.</p>
            <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
              <button type="button" class="hx-btn" data-variant="primary" @click="saveManagedUser(user)" :disabled="user.saving">
                {{ user.saving ? 'Saving…' : 'Save access changes' }}
              </button>
              <button type="button" class="hx-btn" @click="provisionManagedUserLibraryRoot(user)" :disabled="user.provisioning || !user.managedLibraryRelativeRoot || hasPendingManagedLibraryRootChanges(user)">
                {{ user.provisioning ? 'Provisioning…' : 'Provision folder' }}
              </button>
            </div>
          </SettingsDisclosure>

          <SettingsDisclosure
            :panel-id="`settings-user-${user.id}-recovery`"
            :heading-level="4"
            title="Sign-in recovery"
            subtitle="Set a temporary password or issue a time-limited claim code when this person cannot sign in."
            show-label="Open sign-in recovery"
            hide-label="Hide sign-in recovery"
            variant="inline"
          >
            <div class="hx-field">
              <label class="hx-field-label" :for="`settings-user-${user.id}-temporary-password`">Temporary password</label>
              <input :id="`settings-user-${user.id}-temporary-password`" class="hx-input" v-model="user.pendingPasswordReset" type="password" autocomplete="new-password" placeholder="Set a temporary password" />
            </div>
            <p class="hx-text-muted" v-if="user.authProvider === 'plex'">You can set a temporary password to give this person a password sign-in without removing their Plex link.</p>
            <p class="hx-text-muted" v-if="user.claimCode">Current claim code: {{ user.claimCode }}</p>
            <p class="hx-text-muted" v-if="user.claimCodeExpiresAt">Claim code expires {{ new Date(user.claimCodeExpiresAt).toLocaleString() }}. The person completes setup at /claim-account using username {{ user.username }}.</p>
            <div class="hx-card-actions" style="margin-top: var(--hx-space-3)">
              <button type="button" class="hx-btn" @click="resetManagedUserPassword(user)" :disabled="user.resettingPassword || !user.pendingPasswordReset">
                {{ user.resettingPassword ? 'Setting password…' : 'Set temporary password' }}
              </button>
              <button type="button" class="hx-btn" @click="issueManagedUserClaimCode(user)" :disabled="user.issuingClaimCode">
                {{ user.issuingClaimCode ? 'Issuing claim code…' : 'Issue claim code' }}
              </button>
            </div>
          </SettingsDisclosure>

          <SettingsDisclosure
            v-if="user.authProvider === 'plex'"
            :panel-id="`settings-user-${user.id}-plex-link`"
            :heading-level="4"
            title="Plex link"
            subtitle="Remove the Plex sign-in only after a password sign-in is ready."
            show-label="Manage Plex link"
            hide-label="Hide Plex link controls"
            variant="inline"
          >
            <p class="hx-text-muted">{{ describePlexLocalAuthStatus(user) }}</p>
            <button type="button" class="hx-btn" data-variant="danger" @click="unlinkManagedPlexUser(user)" :disabled="user.unlinkingPlex || !user.localAuth?.unlinkPlexReady">
              {{ user.unlinkingPlex ? 'Removing Plex link…' : 'Unlink Plex account' }}
            </button>
          </SettingsDisclosure>
        </div>
      </article>
    </div>

    <div v-if="userList.hasMore()" class="hx-card">
      <div class="hx-card-body" style="text-align: center">
        <button type="button" class="hx-btn" data-variant="ghost" :disabled="userList.isLoadingMore.value" @click="loadMoreUsers">
          {{ userList.isLoadingMore.value ? 'Loading\u2026' : 'Load more users' }}
        </button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.settings-users__posture,
.settings-users__support {
  margin-bottom: var(--hx-space-4);
}

.settings-users__posture-message {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
  margin: 0 0 var(--hx-space-3);
}

.settings-users__posture-checks {
  display: grid;
  gap: var(--hx-space-2);
}

.settings-users__posture-check {
  align-items: center;
  border-top: 1px solid var(--hx-border-subtle);
  color: var(--hx-text-muted);
  display: flex;
  font-size: var(--hx-text-sm);
  justify-content: space-between;
  padding-top: var(--hx-space-2);
}

.settings-users__support {
  display: grid;
  gap: var(--hx-space-4);
}

.settings-users__user-summary {
  display: grid;
  gap: var(--hx-space-2);
}

.settings-users__user-summary p {
  align-items: baseline;
  color: var(--hx-text-muted);
  display: flex;
  font-size: var(--hx-text-sm);
  gap: var(--hx-space-2);
  justify-content: space-between;
  margin: 0;
}

.settings-users__user-summary strong {
  color: var(--hx-text);
  font-weight: 600;
  text-align: right;
}

.suf-bar {
  align-items: center;
  display: flex;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.suf-search {
  flex: 1;
  min-width: 180px;
}
</style>
