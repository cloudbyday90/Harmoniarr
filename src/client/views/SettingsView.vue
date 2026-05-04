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
import {
  clearPlexLink,
  clearSpotifyOAuth,
  clearYouTubeOAuth,
  fetchSettings,
  startPlexLink,
  startSpotifyOAuth,
  startYouTubeOAuth,
  updateSettings,
} from '../lib/settings-api.js';
import {
  applyPlexUserImport,
  createUser,
  fetchUsers,
  previewPlexUserImport,
  relinkPlexUserConflict,
  resetUserPassword,
  provisionUserManagedLibraryRoot,
  updateUser,
} from '../lib/users-api.js';
import {
  buildSettingsUpdatePayload,
  createEmptyDownloadMapping,
  createEmptyUserMusicRoot,
  normalizeDownloadMappings,
  normalizeUserMusicRoots,
} from '../lib/settings-form.js';

const isLoading = ref(true);
const isSaving = ref(false);
const isStartingSpotifyOAuth = ref(false);
const isClearingSpotifyOAuth = ref(false);
const isStartingYouTubeOAuth = ref(false);
const isClearingYouTubeOAuth = ref(false);
const isStartingPlexLink = ref(false);
const isClearingPlexLink = ref(false);
const errorMessage = ref('');
const pathValidation = ref(null);
const secretStatus = ref(null);
const successMessage = ref('');
const isUsersLoading = ref(true);
const isCreatingUser = ref(false);
const isPreviewingPlexUsers = ref(false);
const isImportingPlexUsers = ref(false);
const activePlexRelinkProfileId = ref('');
const userManagementErrorMessage = ref('');
const userManagementSuccessMessage = ref('');
const roleOptions = ref(['admin', 'operator', 'requester']);
const users = ref([]);
const plexUserImportPreview = ref(null);
const form = reactive({
  artwork: {
    captureEmbedded: true,
    captureFolderArtwork: true,
    derivativeCacheSizeMb: 1024,
    derivativeFormat: 'webp',
    derivativeRetentionDays: 30,
    derivativeSizesText: '256, 512',
    fetchEnabled: true,
    maxOriginalDimensionPixels: 4000,
    maxOriginalFileSizeBytes: 20971520,
    providerOrderText: 'coverArtArchive',
    refetchMissingAutomatically: false,
    refreshAfterImport: true,
    refreshAfterLibraryScan: false,
    refreshAfterMetadataRefresh: true,
    unassignedRetentionDays: 90,
  },
  security: {
    csrfProtectionMode: 'disabled',
    enforceHttps: false,
    secureCookies: false,
    strictTransportSecurity: false,
  },
  system: {
    baseUrl: '',
    logLevel: 'info',
  },
  paths: {
    downloadMappings: [],
    downloads: '',
    music: '',
    staging: '',
    transcodeTemp: '',
    userMusicRoots: [],
  },
  slskd: {
    apiKey: '',
    baseUrl: 'http://slskd:5030',
    clearApiKey: false,
    requestTimeoutMs: 10000,
  },
  providers: {
    appleMusicEnabled: false,
    appleMusicKeyId: '',
    appleMusicPrivateKey: '',
    appleMusicStorefront: 'us',
    appleMusicTeamId: '',
    clearAppleMusicPrivateKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    playlistExpansionPolicy: 'bounded',
    requestTimeoutMs: 15000,
    spotifyClientId: '',
    spotifyClientSecret: '',
    spotifyEnabled: false,
    youtubeApiKey: '',
    youtubeClientId: '',
    youtubeClientSecret: '',
    youtubeEnabled: false,
  },
});
const newUserForm = reactive({
  managedLibraryRelativeRoot: '',
  password: '',
  role: 'requester',
  username: '',
});

function formatCommaSeparatedList(value) {
  return Array.isArray(value) ? value.join(', ') : '';
}

function applySettings(payload) {
  Object.assign(form.artwork, {
    ...payload.settings.artwork,
    derivativeSizesText: formatCommaSeparatedList(payload.settings.artwork?.derivativeSizes),
    providerOrderText: formatCommaSeparatedList(payload.settings.artwork?.providerOrder),
  });
  Object.assign(form.security, payload.settings.security);
  Object.assign(form.system, payload.settings.system);
  Object.assign(form.paths, {
    ...payload.settings.paths,
    downloadMappings: form.paths.downloadMappings,
    userMusicRoots: form.paths.userMusicRoots,
  });
  Object.assign(form.slskd, {
    ...form.slskd,
    ...payload.settings.slskd,
    apiKey: '',
    clearApiKey: false,
  });
  Object.assign(form.providers, {
    ...form.providers,
    ...payload.settings.providers,
    appleMusicPrivateKey: '',
    clearAppleMusicPrivateKey: false,
    clearSpotifyClientSecret: false,
    clearYoutubeApiKey: false,
    clearYoutubeClientSecret: false,
    spotifyClientSecret: '',
    youtubeApiKey: '',
    youtubeClientSecret: '',
  });
  pathValidation.value = payload.pathValidation ?? null;
  secretStatus.value = payload.secretStatus ?? null;
  form.paths.downloadMappings.splice(
    0,
    form.paths.downloadMappings.length,
    ...normalizeDownloadMappings(payload.settings.paths?.downloadMappings),
  );
  form.paths.userMusicRoots.splice(
    0,
    form.paths.userMusicRoots.length,
    ...normalizeUserMusicRoots(payload.settings.paths?.userMusicRoots),
  );
}

function applyUsers(payload) {
  roleOptions.value = Array.isArray(payload.roleOptions) && payload.roleOptions.length > 0
    ? payload.roleOptions
    : ['admin', 'operator', 'requester'];
  users.value = Array.isArray(payload.users)
    ? payload.users.map((user) => ({
      ...user,
      pendingIsDisabled: Boolean(user.isDisabled),
      pendingManagedLibraryRelativeRoot: user.managedLibraryRelativeRoot ?? '',
      pendingPasswordReset: '',
      pendingRole: user.role,
      provisioning: false,
      resettingPassword: false,
      saving: false,
    }))
    : [];

  if (!roleOptions.value.includes(newUserForm.role)) {
    newUserForm.role = roleOptions.value.at(-1) ?? 'requester';
  }
}

function statusLabel(status) {
  switch (status) {
    case 'healthy':
      return 'Healthy';
    case 'unavailable':
      return 'Unavailable';
    default:
      return 'Needs attention';
  }
}

function statusClass(status) {
  switch (status) {
    case 'healthy':
      return 'review-status-selected';
    case 'unavailable':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function addDownloadMapping() {
  form.paths.downloadMappings.push(createEmptyDownloadMapping());
}

function removeDownloadMapping(index) {
  form.paths.downloadMappings.splice(index, 1);
}

function addUserMusicRoot() {
  form.paths.userMusicRoots.push(createEmptyUserMusicRoot());
}

function removeUserMusicRoot(index) {
  form.paths.userMusicRoots.splice(index, 1);
}

function slskdApiKeyStatusLabel() {
  const status = secretStatus.value?.slskd;
  if (!status?.apiKeyConfigured) {
    return 'No API key configured';
  }

  return status.apiKeySource === 'stored'
    ? 'Stored securely in Harmoniarr'
    : 'Using environment-provided API key';
}

function providerSecretStatusLabel(provider, secretKey, sourceKey) {
  const status = secretStatus.value?.providers?.[provider];
  if (!status?.[secretKey]) {
    return 'No secret configured';
  }

  return status[sourceKey] === 'stored'
    ? 'Stored securely in Harmoniarr'
    : 'Using environment-provided secret';
}

function spotifyOAuthStatusLabel() {
  const status = secretStatus.value?.providers?.spotifyOAuth;
  if (!status?.linked) {
    return 'Not linked';
  }

  return status.tokenExpiresAt ? `Linked until ${new Date(status.tokenExpiresAt).toLocaleString()}` : 'Linked';
}

function youtubeOAuthStatusLabel() {
  const status = secretStatus.value?.providers?.youtubeOAuth;
  if (!status?.linked) {
    return 'Not linked';
  }

  return status.tokenExpiresAt ? `Linked until ${new Date(status.tokenExpiresAt).toLocaleString()}` : 'Linked';
}

function plexLinkStatusLabel() {
  const status = secretStatus.value?.providers?.plex;
  if (!status?.linked) {
    return 'Not linked';
  }

  if (status.linkedUserTitle && status.linkedUserEmail) {
    return `Linked as ${status.linkedUserTitle} (${status.linkedUserEmail})`;
  }

  return status.linkedUserTitle ? `Linked as ${status.linkedUserTitle}` : 'Linked';
}

function resetNewUserForm() {
  newUserForm.managedLibraryRelativeRoot = '';
  newUserForm.password = '';
  newUserForm.role = roleOptions.value.includes('requester') ? 'requester' : (roleOptions.value[0] ?? 'requester');
  newUserForm.username = '';
}

async function loadSettings() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    applySettings(await fetchSettings());
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings load failed';
  } finally {
    isLoading.value = false;
  }
}

async function loadUsers() {
  isUsersLoading.value = true;
  userManagementErrorMessage.value = '';
  try {
    applyUsers(await fetchUsers());
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'User load failed';
  } finally {
    isUsersLoading.value = false;
  }
}

async function saveSettings() {
  isSaving.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await updateSettings(buildSettingsUpdatePayload(form));
    applySettings(payload);
    successMessage.value = 'Settings saved.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Settings save failed';
  } finally {
    isSaving.value = false;
  }
}

async function connectSpotifyOAuth() {
  isStartingSpotifyOAuth.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await startSpotifyOAuth();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization start failed';
    isStartingSpotifyOAuth.value = false;
  }
}

async function disconnectSpotifyOAuth() {
  isClearingSpotifyOAuth.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await clearSpotifyOAuth();
    if (secretStatus.value?.providers) {
      secretStatus.value.providers.spotifyOAuth = payload.status;
    }
    successMessage.value = 'Spotify authorization cleared.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Spotify authorization clear failed';
  } finally {
    isClearingSpotifyOAuth.value = false;
  }
}

async function connectYouTubeOAuth() {
  isStartingYouTubeOAuth.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await startYouTubeOAuth();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization start failed';
    isStartingYouTubeOAuth.value = false;
  }
}

async function disconnectYouTubeOAuth() {
  isClearingYouTubeOAuth.value = true;
  errorMessage.value = '';
  successMessage.value = '';
  try {
    const payload = await clearYouTubeOAuth();
    if (secretStatus.value?.providers) {
      secretStatus.value.providers.youtubeOAuth = payload.status;
    }
    successMessage.value = 'YouTube authorization cleared.';
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'YouTube authorization clear failed';
  } finally {
    isClearingYouTubeOAuth.value = false;
  }
}

async function connectPlexLink() {
  isStartingPlexLink.value = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';
  try {
    const payload = await startPlexLink();
    window.location.href = payload.authorizationUrl;
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Plex link start failed';
    isStartingPlexLink.value = false;
  }
}

async function disconnectPlexLink() {
  isClearingPlexLink.value = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';
  try {
    const payload = await clearPlexLink();
    if (secretStatus.value?.providers) {
      secretStatus.value.providers.plex = payload.status;
    }
    plexUserImportPreview.value = null;
    userManagementSuccessMessage.value = 'Plex owner link cleared.';
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Plex link clear failed';
  } finally {
    isClearingPlexLink.value = false;
  }
}

async function saveNewUser() {
  isCreatingUser.value = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';
  try {
    const payload = await createUser({
      managedLibraryRelativeRoot: newUserForm.managedLibraryRelativeRoot,
      password: newUserForm.password,
      role: newUserForm.role,
      username: newUserForm.username,
    });
    await loadUsers();
    resetNewUserForm();
    userManagementSuccessMessage.value = `User ${payload.user.username} created.`;
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'User creation failed';
  } finally {
    isCreatingUser.value = false;
  }
}

async function saveManagedUser(user) {
  user.saving = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';
  try {
    const payload = await updateUser(user.id, {
      isDisabled: user.pendingIsDisabled,
      managedLibraryRelativeRoot: user.pendingManagedLibraryRelativeRoot,
      role: user.pendingRole,
    });
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users.value[index] = {
        ...payload.user,
        pendingIsDisabled: Boolean(payload.user.isDisabled),
        pendingManagedLibraryRelativeRoot: payload.user.managedLibraryRelativeRoot ?? '',
        pendingRole: payload.user.role,
        provisioning: false,
        saving: false,
      };
    }
    userManagementSuccessMessage.value = `User ${payload.user.username} updated.`;
  } catch (error) {
    user.saving = false;
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'User update failed';
  }
}

function hasPendingManagedLibraryRootChanges(user) {
  return (user.pendingManagedLibraryRelativeRoot ?? '') !== (user.managedLibraryRelativeRoot ?? '');
}

async function provisionManagedUserLibraryRoot(user) {
  user.provisioning = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';

  try {
    const payload = await provisionUserManagedLibraryRoot(user.id);
    const index = users.value.findIndex((entry) => entry.id === user.id);
    if (index >= 0) {
      users.value[index] = {
        ...payload.user,
        pendingIsDisabled: Boolean(payload.user.isDisabled),
        pendingManagedLibraryRelativeRoot: payload.user.managedLibraryRelativeRoot ?? '',
        pendingRole: payload.user.role,
        provisioning: false,
        saving: false,
      };
    }

    userManagementSuccessMessage.value = payload.provisioning?.created
      ? `Managed library folder provisioned for ${payload.user.username}.`
      : `Managed library folder already existed for ${payload.user.username}.`;
  } catch (error) {
    user.provisioning = false;
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Managed library folder provisioning failed';
  }
}

async function resetManagedUserPassword(user) {
  user.resettingPassword = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';

  try {
    const payload = await resetUserPassword(user.id, user.pendingPasswordReset);
    Object.assign(user, {
      ...payload.user,
      pendingIsDisabled: payload.user.isDisabled,
      pendingManagedLibraryRelativeRoot: payload.user.managedLibraryRelativeRoot ?? '',
      pendingPasswordReset: '',
      pendingRole: payload.user.role,
      provisioning: false,
      resettingPassword: false,
      saving: false,
    });

    userManagementSuccessMessage.value = `Temporary password set for ${payload.user.username}. The user must change it on next login.`;
  } catch (error) {
    user.resettingPassword = false;
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'User password reset failed';
  }
}

async function loadPlexUserImportPreview() {
  isPreviewingPlexUsers.value = true;
  userManagementErrorMessage.value = '';
  try {
    plexUserImportPreview.value = await previewPlexUserImport();
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Plex user preview failed';
  } finally {
    isPreviewingPlexUsers.value = false;
  }
}

async function importPlexUsersNow() {
  isImportingPlexUsers.value = true;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';
  try {
    const payload = await applyPlexUserImport();
    plexUserImportPreview.value = payload;
    await loadUsers();
    const created = payload.summary?.created ?? 0;
    const updated = payload.summary?.updated ?? 0;
    userManagementSuccessMessage.value = `Plex user import applied. Created ${created}, refreshed ${updated}.`;
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Plex user import failed';
  } finally {
    isImportingPlexUsers.value = false;
  }
}

async function relinkPlexConflict(profile) {
  if (!profile?.existingUser?.id || !profile?.id) {
    return;
  }

  activePlexRelinkProfileId.value = profile.id;
  userManagementErrorMessage.value = '';
  userManagementSuccessMessage.value = '';

  try {
    const payload = await relinkPlexUserConflict({
      plexUserId: profile.id,
      userId: profile.existingUser.id,
    });

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
    userManagementSuccessMessage.value = `Linked Plex profile ${payload.profile.title} to ${payload.user.username}.`;
  } catch (error) {
    userManagementErrorMessage.value = error instanceof Error ? error.message : 'Plex conflict relink failed';
  } finally {
    activePlexRelinkProfileId.value = '';
  }
}

onMounted(() => {
  void Promise.all([loadSettings(), loadUsers()]);
});
</script>

<template>
  <section class="page-stack">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">System configuration</p>
      <h2>Settings contract</h2>
      <p>The first protected settings surface now persists allowlisted path and runtime keys.</p>
    </article>

    <article class="panel-light" v-if="isLoading">
      <h3>Loading settings</h3>
      <p>Fetching the current allowlisted settings.</p>
    </article>

    <article class="panel-light error-panel" v-else-if="errorMessage && !successMessage">
      <h3>Settings unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <article class="panel-light" v-else>
      <form class="settings-grid" @submit.prevent="saveSettings">
        <section>
          <p class="eyebrow">Deployment security</p>
          <label>
            CSRF protection
            <select v-model="form.security.csrfProtectionMode">
              <option value="disabled">disabled</option>
              <option value="required">required</option>
            </select>
          </label>
          <label>
            <input v-model="form.security.secureCookies" type="checkbox" />
            Mark auth cookies as Secure
          </label>
          <label>
            <input v-model="form.security.enforceHttps" type="checkbox" />
            Redirect HTTP traffic to HTTPS for safe requests and require HTTPS for writes
          </label>
          <label>
            <input v-model="form.security.strictTransportSecurity" type="checkbox" />
            Send Strict-Transport-Security headers
          </label>
          <p class="metadata-card-copy">Leave these disabled for local-only HTTP installs. Enable them explicitly when Harmoniarr runs behind TLS or a reverse proxy that forwards HTTPS traffic.</p>

          <section class="settings-validation-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">System</p>
                <p class="metadata-card-copy">Base URL, logging, and deployment posture stay in the same allowlisted settings contract.</p>
              </div>
            </div>
          <p class="eyebrow">System</p>
          <label>
            Base URL
            <input v-model="form.system.baseUrl" placeholder="https://harmoniarr.example" />
          </label>
          <label>
            Log level
            <select v-model="form.system.logLevel">
              <option value="debug">debug</option>
              <option value="info">info</option>
              <option value="warn">warn</option>
              <option value="error">error</option>
            </select>
          </label>
          </section>

          <section class="settings-validation-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">slskd connectivity</p>
                <p class="metadata-card-copy">Persist the non-secret connection settings here and update or clear the API key without ever round-tripping the plaintext value back to the browser.</p>
              </div>
              <span class="review-status-pill" :class="secretStatus?.slskd?.apiKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                {{ slskdApiKeyStatusLabel() }}
              </span>
            </div>
            <label>
              slskd base URL
              <input v-model="form.slskd.baseUrl" placeholder="http://slskd:5030" />
            </label>
            <label>
              Request timeout (ms)
              <input v-model.number="form.slskd.requestTimeoutMs" type="number" min="1000" max="120000" step="1000" />
            </label>
            <label>
              API key
              <input v-model="form.slskd.apiKey" type="password" autocomplete="new-password" :disabled="form.slskd.clearApiKey" placeholder="Leave blank to keep the current key" />
            </label>
            <label>
              <input v-model="form.slskd.clearApiKey" type="checkbox" />
              Clear the stored API key on save
            </label>
          </section>

          <section class="settings-validation-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">Provider intake</p>
                <p class="metadata-card-copy">External playlist requests use these credentials and policy controls to fetch provider metadata before Harmoniarr creates reviewable discovery work.</p>
              </div>
            </div>
            <label>
              Playlist expansion policy
              <select v-model="form.providers.playlistExpansionPolicy">
                <option value="bounded">Bounded to playlist albums</option>
                <option value="artist_discovery">Include artist album discovery</option>
              </select>
            </label>
            <label>
              Provider request timeout (ms)
              <input v-model.number="form.providers.requestTimeoutMs" type="number" min="1000" max="60000" step="1000" />
            </label>

            <div class="settings-mapping-list">
              <article class="settings-mapping-card">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">Spotify</p>
                    <h3>Client credentials</h3>
                  </div>
                  <span class="review-status-pill" :class="secretStatus?.providers?.spotify?.clientSecretConfigured ? 'review-status-selected' : 'review-status-held'">
                    {{ providerSecretStatusLabel('spotify', 'clientSecretConfigured', 'clientSecretSource') }}
                  </span>
                </div>
                <label>
                  <input v-model="form.providers.spotifyEnabled" type="checkbox" />
                  Enable Spotify provider intake
                </label>
                <label>
                  Client ID
                  <input v-model="form.providers.spotifyClientId" autocomplete="off" />
                </label>
                <label>
                  Client secret
                  <input v-model="form.providers.spotifyClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearSpotifyClientSecret" placeholder="Leave blank to keep the current secret" />
                </label>
                <label>
                  <input v-model="form.providers.clearSpotifyClientSecret" type="checkbox" />
                  Clear the stored Spotify client secret on save
                </label>
                <div class="section-header">
                  <div>
                    <p class="eyebrow">User authorization</p>
                    <p class="metadata-card-copy">{{ spotifyOAuthStatusLabel() }}</p>
                  </div>
                  <span class="review-status-pill" :class="secretStatus?.providers?.spotifyOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                    {{ secretStatus?.providers?.spotifyOAuth?.linked ? 'Linked' : 'Not linked' }}
                  </span>
                </div>
                <button type="button" class="review-reset-button" @click="connectSpotifyOAuth" :disabled="isStartingSpotifyOAuth">
                  {{ isStartingSpotifyOAuth ? 'Starting...' : 'Connect Spotify' }}
                </button>
                <button type="button" class="review-reset-button" @click="disconnectSpotifyOAuth" :disabled="isClearingSpotifyOAuth || !secretStatus?.providers?.spotifyOAuth?.linked">
                  {{ isClearingSpotifyOAuth ? 'Clearing...' : 'Clear Spotify authorization' }}
                </button>
              </article>

              <article class="settings-mapping-card">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">YouTube</p>
                    <h3>Data API credentials</h3>
                  </div>
                  <span class="review-status-pill" :class="secretStatus?.providers?.youtube?.apiKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                    {{ providerSecretStatusLabel('youtube', 'apiKeyConfigured', 'apiKeySource') }}
                  </span>
                </div>
                <label>
                  <input v-model="form.providers.youtubeEnabled" type="checkbox" />
                  Enable YouTube provider intake
                </label>
                <label>
                  API key
                  <input v-model="form.providers.youtubeApiKey" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeApiKey" placeholder="Leave blank to keep the current key" />
                </label>
                <label>
                  <input v-model="form.providers.clearYoutubeApiKey" type="checkbox" />
                  Clear the stored YouTube API key on save
                </label>
                <div class="section-header">
                  <div>
                    <p class="eyebrow">User authorization</p>
                    <p class="metadata-card-copy">{{ youtubeOAuthStatusLabel() }}</p>
                  </div>
                  <span class="review-status-pill" :class="secretStatus?.providers?.youtubeOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                    {{ secretStatus?.providers?.youtubeOAuth?.linked ? 'Linked' : 'Not linked' }}
                  </span>
                </div>
                <label>
                  OAuth client ID
                  <input v-model="form.providers.youtubeClientId" autocomplete="off" />
                </label>
                <label>
                  OAuth client secret
                  <input v-model="form.providers.youtubeClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeClientSecret" placeholder="Leave blank to keep the current secret" />
                </label>
                <label>
                  <input v-model="form.providers.clearYoutubeClientSecret" type="checkbox" />
                  Clear the stored YouTube OAuth client secret on save
                </label>
                <button type="button" class="review-reset-button" @click="connectYouTubeOAuth" :disabled="isStartingYouTubeOAuth">
                  {{ isStartingYouTubeOAuth ? 'Starting...' : 'Connect YouTube' }}
                </button>
                <button type="button" class="review-reset-button" @click="disconnectYouTubeOAuth" :disabled="isClearingYouTubeOAuth || !secretStatus?.providers?.youtubeOAuth?.linked">
                  {{ isClearingYouTubeOAuth ? 'Clearing...' : 'Clear YouTube authorization' }}
                </button>
              </article>

              <article class="settings-mapping-card">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">Apple Music</p>
                    <h3>Developer token signing</h3>
                  </div>
                  <span class="review-status-pill" :class="secretStatus?.providers?.appleMusic?.privateKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                    {{ providerSecretStatusLabel('appleMusic', 'privateKeyConfigured', 'privateKeySource') }}
                  </span>
                </div>
                <label>
                  <input v-model="form.providers.appleMusicEnabled" type="checkbox" />
                  Enable Apple Music provider intake
                </label>
                <label>
                  Team ID
                  <input v-model="form.providers.appleMusicTeamId" autocomplete="off" />
                </label>
                <label>
                  Key ID
                  <input v-model="form.providers.appleMusicKeyId" autocomplete="off" />
                </label>
                <label>
                  Storefront
                  <input v-model="form.providers.appleMusicStorefront" maxlength="5" placeholder="us" />
                </label>
                <label>
                  Private key
                  <textarea v-model="form.providers.appleMusicPrivateKey" autocomplete="new-password" :disabled="form.providers.clearAppleMusicPrivateKey" placeholder="Leave blank to keep the current key"></textarea>
                </label>
                <label>
                  <input v-model="form.providers.clearAppleMusicPrivateKey" type="checkbox" />
                  Clear the stored Apple Music private key on save
                </label>
              </article>
            </div>
          </section>
        </section>

        <section>
          <section class="settings-validation-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">Artwork behavior</p>
                <p class="metadata-card-copy">Configure fetch, extraction, derivative, cleanup, and automatic refresh defaults before artwork workers ship.</p>
              </div>
            </div>
            <label>
              <input v-model="form.artwork.fetchEnabled" type="checkbox" />
              Enable external artwork fetching
            </label>
            <label>
              Preferred provider order
              <input v-model="form.artwork.providerOrderText" placeholder="coverArtArchive, discogs, theAudioDb" />
            </label>
            <label>
              <input v-model="form.artwork.captureEmbedded" type="checkbox" />
              Let embedded artwork become durable app-owned artwork
            </label>
            <label>
              <input v-model="form.artwork.captureFolderArtwork" type="checkbox" />
              Let candidate-folder artwork become durable app-owned artwork
            </label>
            <label>
              Derivative format
              <select v-model="form.artwork.derivativeFormat">
                <option value="webp">webp</option>
                <option value="jpeg">jpeg</option>
                <option value="png">png</option>
              </select>
            </label>
            <label>
              Derivative sizes
              <input v-model="form.artwork.derivativeSizesText" placeholder="256, 512" />
            </label>
            <label>
              Maximum original image size (bytes)
              <input v-model.number="form.artwork.maxOriginalFileSizeBytes" type="number" min="1048576" max="104857600" step="1048576" />
            </label>
            <label>
              Maximum original dimension (pixels)
              <input v-model.number="form.artwork.maxOriginalDimensionPixels" type="number" min="256" max="8192" step="64" />
            </label>
            <label>
              Derivative cache cap (MB)
              <input v-model.number="form.artwork.derivativeCacheSizeMb" type="number" min="64" max="16384" step="64" />
            </label>
            <label>
              Derivative retention (days)
              <input v-model.number="form.artwork.derivativeRetentionDays" type="number" min="1" max="3650" />
            </label>
            <label>
              Unassigned originals retention (days)
              <input v-model.number="form.artwork.unassignedRetentionDays" type="number" min="1" max="3650" />
            </label>
            <label>
              <input v-model="form.artwork.refreshAfterMetadataRefresh" type="checkbox" />
              Refresh artwork automatically after metadata refresh
            </label>
            <label>
              <input v-model="form.artwork.refreshAfterImport" type="checkbox" />
              Refresh artwork automatically after import acceptance
            </label>
            <label>
              <input v-model="form.artwork.refreshAfterLibraryScan" type="checkbox" />
              Refresh artwork automatically after library scans
            </label>
            <label>
              <input v-model="form.artwork.refetchMissingAutomatically" type="checkbox" />
              Refetch missing artwork automatically
            </label>
          </section>

          <p class="eyebrow">Paths</p>
          <label>
            Downloads
            <input v-model="form.paths.downloads" />
          </label>
          <label>
            Music
            <input v-model="form.paths.music" />
          </label>
          <label>
            Staging
            <input v-model="form.paths.staging" />
          </label>
          <label>
            Transcode temp
            <input v-model="form.paths.transcodeTemp" />
          </label>

          <section class="settings-mapping-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">Download path mappings</p>
                <p class="metadata-card-copy">Map the slskd completed-download namespace into Harmoniarr's local downloads namespace. This preview stays explicit and avoids guessing when multiple mappings could apply.</p>
              </div>
              <button type="button" class="review-reset-button" @click="addDownloadMapping">Add mapping</button>
            </div>

            <article class="panel-light review-empty-state" v-if="!form.paths.downloadMappings.length">
              <h3>No mappings configured</h3>
              <p>Without explicit mappings, preview resolution falls back to the configured downloads root and marks that assumption as a warning.</p>
            </article>

            <div class="settings-mapping-list" v-else>
              <article class="settings-mapping-card" v-for="(mapping, index) in form.paths.downloadMappings" :key="index">
                <label>
                  slskd prefix
                  <input v-model="mapping.slskdPrefix" placeholder="/downloads/completed" />
                </label>
                <label>
                  Harmoniarr prefix
                  <input v-model="mapping.harmoniarrPrefix" placeholder="/data/downloads/completed" />
                </label>
                <button type="button" class="review-reset-button" @click="removeDownloadMapping(index)">Remove mapping</button>
              </article>
            </div>
          </section>

          <section class="settings-mapping-section">
            <div class="section-header">
              <div>
                <p class="eyebrow">Per-user music roots</p>
                <p class="metadata-card-copy">Map app user ids onto durable subdirectories under the shared music root. Import preview stops deriving folder names from session ids once a mapping is configured here.</p>
              </div>
              <button type="button" class="review-reset-button" @click="addUserMusicRoot">Add user root</button>
            </div>

            <article class="panel-light review-empty-state" v-if="!form.paths.userMusicRoots.length">
              <h3>No per-user destinations configured</h3>
              <p>Preview falls back to the shared library root until a user-specific destination is configured.</p>
            </article>

            <div class="settings-mapping-list" v-else>
              <article class="settings-mapping-card" v-for="(userMusicRoot, index) in form.paths.userMusicRoots" :key="`user-music-root-${index}`">
                <label>
                  App user id
                  <input v-model="userMusicRoot.userId" placeholder="user-1" />
                </label>
                <label>
                  Relative subdirectory
                  <input v-model="userMusicRoot.relativeRoot" placeholder="household/alice" />
                </label>
                <button type="button" class="review-reset-button" @click="removeUserMusicRoot(index)">Remove user root</button>
              </article>
            </div>
          </section>

          <section class="settings-validation-section" v-if="pathValidation">
            <div class="section-header">
              <div>
                <p class="eyebrow">Path validation</p>
                <p class="metadata-card-copy">{{ pathValidation.summary.message }}</p>
              </div>
              <span class="review-status-pill" :class="statusClass(pathValidation.summary.status)">
                {{ statusLabel(pathValidation.summary.status) }}
              </span>
            </div>

            <div class="dependency-grid" v-if="pathValidation.roots?.length">
              <article class="dependency-card" :class="`dependency-card-${root.status}`" v-for="root in pathValidation.roots" :key="root.key">
                <div class="dependency-card-header">
                  <div>
                    <p>{{ root.label }}</p>
                    <strong>{{ root.path }}</strong>
                  </div>
                  <span class="dependency-status-dot" />
                </div>
                <p class="dependency-message">{{ root.message }}</p>
                <p class="dependency-observed" v-if="root.resolvedPath && root.resolvedPath !== root.path">Resolved {{ root.resolvedPath }}</p>
              </article>
            </div>

            <div class="settings-mapping-list" v-if="pathValidation.downloadMappings?.length">
              <article class="settings-mapping-card" v-for="mapping in pathValidation.downloadMappings" :key="mapping.index">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">Mapping {{ mapping.index + 1 }}</p>
                    <h3>{{ mapping.slskdPrefix }} -> {{ mapping.harmoniarrPrefix }}</h3>
                  </div>
                  <span class="review-status-pill" :class="statusClass(mapping.status)">{{ statusLabel(mapping.status) }}</span>
                </div>
                <p class="metadata-card-copy">{{ mapping.message }}</p>
                <dl class="review-meta-grid review-meta-grid-wide">
                  <div>
                    <dt>Example source</dt>
                    <dd>{{ mapping.exampleSourcePath }}</dd>
                  </div>
                  <div>
                    <dt>Example translated</dt>
                    <dd>{{ mapping.exampleTranslatedPath }}</dd>
                  </div>
                </dl>
              </article>
            </div>

            <div class="settings-mapping-list" v-if="pathValidation.userMusicRoots?.length">
              <article class="settings-mapping-card" v-for="userMusicRoot in pathValidation.userMusicRoots" :key="`validated-user-root-${userMusicRoot.index}`">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">Per-user root {{ userMusicRoot.index + 1 }}</p>
                    <h3>{{ userMusicRoot.userId }} -> {{ userMusicRoot.relativeRoot }}</h3>
                  </div>
                  <span class="review-status-pill" :class="statusClass(userMusicRoot.status)">{{ statusLabel(userMusicRoot.status) }}</span>
                </div>
                <p class="metadata-card-copy">{{ userMusicRoot.message }}</p>
                <dl class="review-meta-grid review-meta-grid-wide">
                  <div>
                    <dt>Resolved root</dt>
                    <dd>{{ userMusicRoot.path }}</dd>
                  </div>
                  <div v-if="userMusicRoot.resolvedPath && userMusicRoot.resolvedPath !== userMusicRoot.path">
                    <dt>Canonical path</dt>
                    <dd>{{ userMusicRoot.resolvedPath }}</dd>
                  </div>
                </dl>
              </article>
            </div>

            <article class="panel-light review-empty-state" v-if="!pathValidation.downloadMappings?.length && !pathValidation.userMusicRoots?.length">
              <h3>No mapping validation rows</h3>
              <p>{{ pathValidation.notes.remoteSlskdValidation }}</p>
            </article>
          </section>
        </section>

        <p class="error-copy" v-if="errorMessage">{{ errorMessage }}</p>
        <p class="success-copy" v-if="successMessage">{{ successMessage }}</p>
        <button type="submit" :disabled="isSaving">
          {{ isSaving ? 'Saving...' : 'Save settings' }}
        </button>
      </form>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <p class="eyebrow">Users and permissions</p>
          <h3>Admin-managed app users</h3>
          <p class="metadata-card-copy">Create local users now with explicit role presets. This becomes the durable identity and permission boundary that later Plex onboarding and media-request ownership will reuse.</p>
        </div>
      </div>

      <article class="panel-light review-empty-state" v-if="isUsersLoading">
        <h3>Loading users</h3>
        <p>Fetching admin-managed users and available role presets.</p>
      </article>

      <template v-else>
        <section class="settings-validation-section">
          <div class="section-header">
            <div>
              <p class="eyebrow">Plex directory</p>
              <h3>Plex-linked user import</h3>
              <p class="metadata-card-copy">Link the Plex owner account, preview home users, then import non-conflicting Plex-linked users into the shared `app_users` identity boundary.</p>
            </div>
            <span class="review-status-pill" :class="secretStatus?.providers?.plex?.linked ? 'review-status-selected' : 'review-status-held'">
              {{ secretStatus?.providers?.plex?.linked ? 'Linked' : 'Not linked' }}
            </span>
          </div>

          <p class="metadata-card-copy">{{ plexLinkStatusLabel() }}</p>

          <div class="settings-button-row">
            <button type="button" @click="connectPlexLink" :disabled="isStartingPlexLink">
              {{ isStartingPlexLink ? 'Starting...' : 'Connect Plex owner account' }}
            </button>
            <button type="button" class="review-reset-button" @click="disconnectPlexLink" :disabled="isClearingPlexLink || !secretStatus?.providers?.plex?.linked">
              {{ isClearingPlexLink ? 'Clearing...' : 'Clear Plex link' }}
            </button>
            <button type="button" class="review-reset-button" @click="loadPlexUserImportPreview" :disabled="isPreviewingPlexUsers || !secretStatus?.providers?.plex?.linked">
              {{ isPreviewingPlexUsers ? 'Refreshing...' : 'Preview Plex users' }}
            </button>
            <button type="button" class="review-reset-button" @click="importPlexUsersNow" :disabled="isImportingPlexUsers || !secretStatus?.providers?.plex?.linked">
              {{ isImportingPlexUsers ? 'Importing...' : 'Import non-conflicting Plex users' }}
            </button>
          </div>

          <article class="panel-light review-empty-state" v-if="!plexUserImportPreview">
            <h3>No Plex directory preview loaded</h3>
            <p>Previewing will classify linked users, importable users, owner-account skips, and conflicts before any new Harmoniarr users are created.</p>
          </article>

          <template v-else>
            <dl class="review-meta-grid review-meta-grid-wide">
              <div>
                <dt>Importable</dt>
                <dd>{{ plexUserImportPreview.summary?.importable ?? 0 }}</dd>
              </div>
              <div>
                <dt>Linked refresh</dt>
                <dd>{{ plexUserImportPreview.summary?.linked ?? 0 }}</dd>
              </div>
              <div>
                <dt>Conflicts</dt>
                <dd>{{ plexUserImportPreview.summary?.conflicts ?? 0 }}</dd>
              </div>
              <div>
                <dt>Owner skips</dt>
                <dd>{{ plexUserImportPreview.summary?.ownerAccounts ?? 0 }}</dd>
              </div>
            </dl>

            <div class="settings-mapping-list" v-if="plexUserImportPreview.profiles?.length">
              <article class="settings-mapping-card" v-for="profile in plexUserImportPreview.profiles" :key="`plex-preview-${profile.uuid ?? profile.id}`">
                <div class="section-header">
                  <div>
                    <p class="eyebrow">{{ profile.homeRole }}</p>
                    <h3>{{ profile.title }}</h3>
                    <p class="metadata-card-copy">{{ profile.email ?? profile.username ?? profile.id }}</p>
                  </div>
                  <span class="review-status-pill" :class="profile.classification === 'create'
                    ? 'review-status-selected'
                    : (profile.classification === 'linked'
                      ? 'review-status-held'
                      : 'review-status-failed')">
                    {{ profile.classification }}
                  </span>
                </div>
                <p class="metadata-card-copy">Library access: {{ profile.libraryAccessState }}</p>
                <p class="metadata-card-copy" v-if="profile.suggestedUsername">Suggested username: {{ profile.suggestedUsername }}</p>
                <p class="metadata-card-copy" v-if="profile.existingUser">Existing user: {{ profile.existingUser.username }}<span v-if="profile.conflictReason"> ({{ profile.conflictReason }})</span></p>
                <div class="settings-button-row" v-if="profile.classification === 'conflict' && profile.existingUser?.id">
                  <button
                    type="button"
                    class="review-reset-button"
                    @click="relinkPlexConflict(profile)"
                    :disabled="activePlexRelinkProfileId === profile.id"
                  >
                    {{ activePlexRelinkProfileId === profile.id ? 'Linking...' : `Link to ${profile.existingUser.username}` }}
                  </button>
                </div>
              </article>
            </div>
          </template>
        </section>

        <form class="settings-grid" @submit.prevent="saveNewUser">
          <section>
            <p class="eyebrow">Create user</p>
            <label>
              Username
              <input v-model="newUserForm.username" placeholder="listener" />
            </label>
            <label>
              Temporary password
              <input v-model="newUserForm.password" type="password" autocomplete="new-password" placeholder="At least 10 characters" />
            </label>
            <label>
              Managed library subdirectory
              <input v-model="newUserForm.managedLibraryRelativeRoot" placeholder="household/listener" />
            </label>
            <label>
              Role preset
              <select v-model="newUserForm.role">
                <option v-for="roleOption in roleOptions" :key="roleOption" :value="roleOption">{{ roleOption }}</option>
              </select>
            </label>
            <p class="metadata-card-copy">New users are created with a temporary password and must change it on first login. The managed library subdirectory is resolved under the shared music root and created on first import apply if needed.</p>
            <button type="submit" :disabled="isCreatingUser">
              {{ isCreatingUser ? 'Creating...' : 'Create user' }}
            </button>
          </section>

          <section>
            <p class="eyebrow">Role guidance</p>
            <div class="settings-mapping-list">
              <article class="settings-mapping-card">
                <h3>admin</h3>
                <p class="metadata-card-copy">Full system, user, import, and library control.</p>
              </article>
              <article class="settings-mapping-card">
                <h3>operator</h3>
                <p class="metadata-card-copy">Can review and execute imports plus manage discovery and scans, without full admin settings control.</p>
              </article>
              <article class="settings-mapping-card">
                <h3>requester</h3>
                <p class="metadata-card-copy">Self-service request and playlist submission now live in the dedicated Request Music view.</p>
              </article>
            </div>
          </section>
        </form>

        <p class="error-copy" v-if="userManagementErrorMessage">{{ userManagementErrorMessage }}</p>
        <p class="success-copy" v-if="userManagementSuccessMessage">{{ userManagementSuccessMessage }}</p>

        <article class="panel-light review-empty-state" v-if="!users.length">
          <h3>No app users created yet</h3>
          <p>Create users here now, then attach Plex onboarding and folder-provisioning flows in the next slices.</p>
        </article>

        <div class="settings-mapping-list" v-else>
          <article class="settings-mapping-card" v-for="user in users" :key="user.id">
            <div class="section-header">
              <div>
                <p class="eyebrow">{{ user.role }}</p>
                <h3>{{ user.username }}</h3>
                <p class="metadata-card-copy">Auth provider: {{ user.authProvider ?? 'local' }}</p>
              </div>
              <span class="review-status-pill" :class="user.isDisabled ? 'review-status-held' : 'review-status-selected'">
                {{ user.isDisabled ? 'Disabled' : 'Active' }}
              </span>
            </div>
            <label>
              Role preset
              <select v-model="user.pendingRole">
                <option v-for="roleOption in roleOptions" :key="`${user.id}-${roleOption}`" :value="roleOption">{{ roleOption }}</option>
              </select>
            </label>
            <label>
              Managed library subdirectory
              <input v-model="user.pendingManagedLibraryRelativeRoot" placeholder="household/listener" />
            </label>
            <label>
              <input v-model="user.pendingIsDisabled" type="checkbox" />
              Disable user access
            </label>
            <label>
              Temporary password
              <input v-model="user.pendingPasswordReset" type="password" autocomplete="new-password" placeholder="Set a temporary password" />
            </label>
            <p class="metadata-card-copy">Resolved permissions: {{ user.permissions.join(', ') }}</p>
            <p class="metadata-card-copy" v-if="user.managedLibraryRelativeRoot">Managed library subdirectory: {{ user.managedLibraryRelativeRoot }}</p>
            <p class="metadata-card-copy" v-else>No managed library subdirectory configured yet.</p>
            <button type="button" @click="saveManagedUser(user)" :disabled="user.saving">
              {{ user.saving ? 'Saving...' : 'Save user' }}
            </button>
            <button
              type="button"
              class="review-reset-button"
              @click="provisionManagedUserLibraryRoot(user)"
              :disabled="user.provisioning || !user.managedLibraryRelativeRoot || hasPendingManagedLibraryRootChanges(user)"
            >
              {{ user.provisioning ? 'Provisioning...' : 'Provision folder' }}
            </button>
            <button
              type="button"
              class="review-reset-button"
              @click="resetManagedUserPassword(user)"
              :disabled="user.resettingPassword || !user.pendingPasswordReset"
            >
              {{ user.resettingPassword ? 'Setting password...' : 'Set temporary password' }}
            </button>
            <p class="metadata-card-copy" v-if="hasPendingManagedLibraryRootChanges(user)">Save the managed library subdirectory change before provisioning the folder.</p>
            <p class="metadata-card-copy" v-if="user.authProvider === 'plex'">Use a temporary password here to provide local fallback access for a Plex-linked user without removing the Plex binding.</p>
          </article>
        </div>
      </template>
    </article>
  </section>
</template>
