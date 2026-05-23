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
import { usePlexLinkedAccounts } from '../composables/usePlexLinkedAccounts.js';
import { useAdminUserList } from '../composables/useAdminUserList.js';
import { useSettingsUserMutations } from '../composables/useSettingsUserMutations.js';
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
});

watch(() => userList.users.value, (rawUsers) => {
  users.value = rawUsers.map((user) => toEditableUser(user));
}, { immediate: true });

const plexOwnerLinked = computed(() => plexLinkedAccountsOverview.value.ownerLink?.linked === true);
const plexRepairQueueActive = computed(() => hasPlexRepairQueue(plexLinkedAccountsOverview.value));

async function loadMoreUsers() {
  await userList.loadMore();
}

onMounted(() => { void Promise.all([loadUsers(), loadPlexLinkedAccountsOverview()]); });
</script>

<template>
  <div class="cfg-page">

    <!-- Plex linked accounts -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Plex connected accounts</h3>
          <p class="hx-card-subtitle">Manage the Plex owner connection, linked Harmoniarr users, and relink conflicts from one repair-oriented workspace.</p>
        </div>
        <span class="hx-pill" :data-tone="formatPlexOwnerLinkTone(plexLinkedAccountsOverview.ownerLink)">
          {{ formatPlexOwnerLinkLabel(plexLinkedAccountsOverview.ownerLink) }}
        </span>
      </header>
      <div class="hx-card-body">
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

    <!-- User list filters -->
    <div class="hx-card">
      <div class="hx-card-body suf-bar">
        <input class="hx-input suf-search" v-model="searchQuery" type="search" placeholder="Search users…" @input="void loadUsers()" />
        <select class="hx-select" v-model="userRoleFilter" @change="void loadUsers()">
          <option value="">All roles</option>
          <option v-for="opt in roleOptions" :key="opt" :value="opt">{{ formatUserRole(opt) }}</option>
        </select>
        <select class="hx-select" v-model="userStatusFilter" @change="void loadUsers()">
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
.suf-bar {
  display: flex;
  gap: var(--hx-space-3);
  align-items: center;
  flex-wrap: wrap;
}

.suf-search {
  flex: 1;
  min-width: 180px;
}
</style>
