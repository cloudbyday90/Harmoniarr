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
import { useRoute } from 'vue-router';
import {
  buildSlskdConnectionSubtitle,
  formatOAuthStatusLabel,
  formatProviderSecretStatusLabel,
  formatSlskdProviderModeLabel,
} from '../lib/settings-connections-presentation.js';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import SettingsFormGroup from '../components/settings/SettingsFormGroup.vue';
import SettingsProviderConnectionStatus from '../components/settings/SettingsProviderConnectionStatus.vue';
import SettingsRecoveryConfirmation from '../components/settings/SettingsRecoveryConfirmation.vue';
import SettingsSaveBar from '../components/settings/SettingsSaveBar.vue';
import SoulseekProviderModeGuidance from '../components/settings/SoulseekProviderModeGuidance.vue';
import { useConnections } from '../composables/useConnections.js';
import { useSettingsSetupProgress } from '../composables/useSettingsSetupProgress.js';
import { useSoulseekConnectionStatus } from '../composables/useSoulseekConnectionStatus.js';
import { useToast } from '../composables/useToast.js';
import { buildSettingsProviderRecoveryConfirmation } from '../lib/settings-provider-recovery-presentation.js';
import { resolveSettingsRecoveryContext } from '../lib/settings-recovery-handoff.js';
import { buildSettingsSoulseekProviderState } from '../lib/settings-provider-state-presentation.js';
import { buildSettingsSaveState } from '../lib/settings-save-state-presentation.js';

const toast = useToast();
const route = useRoute();

const {
  connectionErrorCode,
  connectionStatus,
  isLoading: isTestingProviderConnection,
  loadConnectionStatus,
} = useSoulseekConnectionStatus();

const {
  loadSetupProgress,
  progress: setupProgress,
} = useSettingsSetupProgress();

const {
  connectSpotifyOAuth,
  connectYouTubeOAuth,
  clearConnectionActionFeedback,
  connectionActionFeedback,
  disconnectSpotifyOAuth,
  disconnectYouTubeOAuth,
  form,
  hasSaved,
  isClearingSpotifyOAuth,
  isClearingYouTubeOAuth,
  isLoading,
  isSaving,
  isStartingSpotifyOAuth,
  isStartingYouTubeOAuth,
  isDirty,
  loadErrorMessage,
  loadSettings,
  saveErrorMessage,
  saveSettings,
  secretStatus,
  successMessage,
} = useConnections();

const isManagedDeployment = computed(() => secretStatus.value?.slskd?.managedDeploymentDetected === true);
const isSoulseekDisabled = computed(() => form.slskd.providerMode === 'disabled');
const isExternalSoulseek = computed(() => form.slskd.providerMode === 'external');
const isManagedSoulseek = computed(() => form.slskd.providerMode === 'managed');
const recoveryContext = computed(() => resolveSettingsRecoveryContext(route.query));
const isProviderRecoveryReturn = computed(() => recoveryContext.value !== null);
const providerRepairConfirmation = ref(null);
const requiresConnectionVerification = ref(false);
const soulseekProviderState = computed(() => buildSettingsSoulseekProviderState({
  connectionErrorCode: connectionErrorCode.value,
  connectionStatus: connectionStatus.value,
  managedDeploymentDetected: isManagedDeployment.value,
  providerMode: form.slskd.providerMode,
  providerModeState: secretStatus.value?.slskd?.providerMode === form.slskd.providerMode
    ? secretStatus.value?.slskd?.providerModeState
    : null,
}));
const settingsSaveState = computed(() => buildSettingsSaveState({
  hasSaved: hasSaved.value,
  isDirty: isDirty.value,
  isSaving: isSaving.value,
  requiresVerification: requiresConnectionVerification.value,
  saveErrorMessage: saveErrorMessage.value,
  successMessage: successMessage.value,
}));

async function refreshProviderRepairConfirmation() {
  await Promise.all([
    loadConnectionStatus(),
    loadSetupProgress(),
  ]);
  if (!isProviderRecoveryReturn.value) return;

  providerRepairConfirmation.value = buildSettingsProviderRecoveryConfirmation({
    connectionCheckFailed: Boolean(connectionErrorCode.value),
    connectionStatus: connectionStatus.value,
    recoveryContext: recoveryContext.value,
    setupProgress: setupProgress.value,
  });
}

async function handleSaveSettings() {
  clearConnectionActionFeedback();
  providerRepairConfirmation.value = null;
  const shouldVerifySavedConnection = isExternalSoulseek.value && isDirty.value;
  const outcome = await saveSettings();
  if (!outcome?.ok) return;

  requiresConnectionVerification.value = shouldVerifySavedConnection;
  if (!isProviderRecoveryReturn.value) return;

  await refreshProviderRepairConfirmation();
}

async function testProviderConnection() {
  await loadConnectionStatus();
  requiresConnectionVerification.value = false;

  const providerState = buildSettingsSoulseekProviderState({
    connectionErrorCode: connectionErrorCode.value,
    connectionStatus: connectionStatus.value,
    managedDeploymentDetected: isManagedDeployment.value,
    providerMode: form.slskd.providerMode,
    providerModeState: secretStatus.value?.slskd?.providerMode === form.slskd.providerMode
      ? secretStatus.value?.slskd?.providerModeState
      : null,
  });
  const toastMessage = `${providerState.statusLabel}. ${providerState.message}`;

  if (providerState.tone === 'success') {
    toast.success(toastMessage);
  } else if (providerState.tone === 'danger') {
    toast.error(toastMessage);
  } else if (providerState.tone === 'warning') {
    toast.warning(toastMessage);
  } else {
    toast.info(toastMessage);
  }

  if (isProviderRecoveryReturn.value) {
    await refreshProviderRepairConfirmation();
  }
}

watch(
  () => [
    form.slskd.apiKey,
    form.slskd.baseUrl,
    form.slskd.clearApiKey,
    form.slskd.providerMode,
  ],
  () => {
    providerRepairConfirmation.value = null;
    requiresConnectionVerification.value = false;
  },
);

onMounted(() => {
  void loadSettings();
  void loadConnectionStatus();
  void loadSetupProgress();
});
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card" v-if="isLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading settings…</p>
      </div>
    </article>

    <article class="hx-card" v-else-if="loadErrorMessage">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Settings unavailable</h3>
          <p class="hx-card-subtitle">{{ loadErrorMessage }}</p>
        </div>
      </div>
    </article>

    <form @submit.prevent="handleSaveSettings" v-else>
      <div class="settings-connections__primary">
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Soulseek downloads</h3>
              <p class="hx-card-subtitle">{{ buildSlskdConnectionSubtitle() }}</p>
            </div>
            <span class="review-status-pill" :class="isSoulseekDisabled ? 'review-status-held' : 'review-status-selected'">
              {{ formatSlskdProviderModeLabel({ providerMode: form.slskd.providerMode }) }}
            </span>
          </header>
          <div class="hx-card-body">
            <div class="settings-connections__provider-setup">
              <fieldset class="settings-connections__provider-modes">
                <legend class="hx-field-label">Soulseek provider mode</legend>
                <label class="settings-connections__provider-mode" :class="{ 'is-selected': isManagedSoulseek }">
                  <input v-model="form.slskd.providerMode" type="radio" value="managed" />
                  <span>
                    <strong>Managed</strong>
                    <small>Use Harmoniarr's Docker sidecar and deployment-provided secrets.</small>
                  </span>
                </label>
                <label class="settings-connections__provider-mode" :class="{ 'is-selected': isExternalSoulseek }">
                  <input v-model="form.slskd.providerMode" type="radio" value="external" :disabled="isManagedDeployment" />
                  <span>
                    <strong>External</strong>
                    <small>Connect to an slskd service you run separately, including an Unraid or VPN setup.</small>
                  </span>
                </label>
                <label class="settings-connections__provider-mode" :class="{ 'is-selected': isSoulseekDisabled }">
                  <input v-model="form.slskd.providerMode" type="radio" value="disabled" />
                  <span>
                    <strong>Disabled</strong>
                    <small>Do not search or download through Soulseek. Existing external credentials remain saved.</small>
                  </span>
                </label>
              </fieldset>
              <p v-if="isManagedDeployment" class="cfg-field-hint">This deployment supplies the managed provider address and API key. Select Disabled to pause Soulseek without changing deployment secrets.</p>
            </div>
            <SettingsFormGroup
              v-if="isExternalSoulseek"
              kind="core"
              title="External service details"
              description="Use an address Harmoniarr can reach. Leave the API key blank to retain the saved key."
            >
              <div class="hx-field">
                <label class="hx-field-label" for="settings-slskd-service-address">Service address</label>
                <input id="settings-slskd-service-address" class="hx-input" v-model="form.slskd.baseUrl" placeholder="http://slskd:5030" />
              </div>
              <div class="hx-field">
                <label class="hx-field-label" for="settings-slskd-api-key">API key</label>
                <input id="settings-slskd-api-key" class="hx-input" v-model="form.slskd.apiKey" type="password" autocomplete="new-password" :disabled="form.slskd.clearApiKey" placeholder="Leave blank to keep the current key" />
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.slskd.clearApiKey" />
                <span>Remove the stored API key on save</span>
              </label>
            </SettingsFormGroup>
            <div v-else-if="isManagedSoulseek" class="cfg-group">
              <p class="cfg-group-title">Managed by deployment</p>
              <p class="cfg-field-hint">Deployment secrets supply the connection. Change managed credentials in the deployment, not here.</p>
            </div>
            <div v-else class="cfg-group">
              <p class="cfg-group-title">Downloads are off</p>
              <p class="cfg-field-hint">Harmoniarr will not search, queue downloads, or poll Soulseek until you select Managed or External.</p>
            </div>
            <SoulseekProviderModeGuidance
              :managed-deployment-detected="isManagedDeployment"
              :provider-mode="form.slskd.providerMode"
            />
            <SettingsProviderConnectionStatus
              :provider-state="soulseekProviderState"
              :is-testing="isTestingProviderConnection"
              :show-test-action="!requiresConnectionVerification"
              @test="testProviderConnection"
            />
          </div>
        </article>
      </div>

      <SettingsRecoveryConfirmation
        v-if="isProviderRecoveryReturn"
        :confirmation="providerRepairConfirmation"
      />

      <div class="settings-connections__advanced-stack">
        <SettingsDisclosure
          panel-id="settings-connection-behavior"
          action-style="compact"
          category="advanced"
          title="Connection behavior"
          subtitle="Timeouts and playlist discovery behavior."
          show-label="Show connection behavior"
          hide-label="Hide connection behavior"
        >
          <div class="cfg-group" style="padding-top: 0; border-top: none">
            <div class="hx-field">
              <label class="hx-field-label">Soulseek request timeout (milliseconds)</label>
              <input class="hx-input" v-model.number="form.slskd.requestTimeoutMs" type="number" min="1000" max="120000" step="1000" />
            </div>
            <p class="cfg-field-hint">Leave at the default (10,000 ms) unless you are troubleshooting repeated timeout errors.</p>
          </div>
          <div class="cfg-group">
            <div class="hx-field">
              <label class="hx-field-label">Playlist discovery mode</label>
              <select class="hx-select" v-model="form.providers.playlistExpansionPolicy">
                <option value="bounded">Bounded — only albums in the playlist</option>
                <option value="artist_discovery">Artist discovery — include other albums by those artists</option>
              </select>
            </div>
            <p class="cfg-field-hint"><strong>Bounded</strong> searches only for albums in the playlist. <strong>Artist discovery</strong> adds other albums by those artists and creates more Music Queue work.</p>
          </div>
          <div class="cfg-group">
            <div class="hx-field">
              <label class="hx-field-label">Playlist provider timeout (milliseconds)</label>
              <input class="hx-input" v-model.number="form.providers.requestTimeoutMs" type="number" min="1000" max="60000" step="1000" />
            </div>
            <p class="cfg-field-hint">Leave at the default (15,000 ms) unless playlist providers are timing out consistently.</p>
          </div>
        </SettingsDisclosure>

        <SettingsDisclosure
          panel-id="settings-optional-music-sources"
          action-style="compact"
          category="optional"
          title="Music-source connections"
          subtitle="Add playlist and artwork services only when you plan to use them. Secrets remain write-only."
          show-label="Set up optional services"
          hide-label="Hide optional services"
        >
          <div class="cfg-provider-list">

            <!-- Spotify -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Spotify</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.spotify?.clientSecretConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.spotify, 'clientSecretConfigured', 'clientSecretSource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.spotifyEnabled" />
                <span>Accept Spotify playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Client ID</label>
                  <input class="hx-input" v-model="form.providers.spotifyClientId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Client secret</label>
                  <input class="hx-input" v-model="form.providers.spotifyClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearSpotifyClientSecret" placeholder="Leave blank to keep" />
                </div>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.clearSpotifyClientSecret" />
                <span>Remove the stored Spotify client secret on save</span>
              </label>
              <div class="cfg-provider-header" style="margin-top: var(--hx-space-2)">
                <span class="hx-text-muted">User authorization — {{ formatOAuthStatusLabel(secretStatus?.providers?.spotifyOAuth) }}</span>
                <span class="review-status-pill" :class="secretStatus?.providers?.spotifyOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                  {{ secretStatus?.providers?.spotifyOAuth?.linked ? 'Linked' : 'Not linked' }}
                </span>
              </div>
              <div class="hx-card-actions">
                <button type="button" class="hx-btn" @click="connectSpotifyOAuth" :disabled="isStartingSpotifyOAuth">
                  {{ isStartingSpotifyOAuth ? 'Starting…' : 'Connect Spotify' }}
                </button>
                <button type="button" class="hx-btn" @click="disconnectSpotifyOAuth" :disabled="isClearingSpotifyOAuth || !secretStatus?.providers?.spotifyOAuth?.linked">
                  {{ isClearingSpotifyOAuth ? 'Clearing…' : 'Clear authorization' }}
                </button>
              </div>
            </div>

            <!-- YouTube -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">YouTube</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.youtube?.apiKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.youtube, 'apiKeyConfigured', 'apiKeySource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.youtubeEnabled" />
                <span>Accept YouTube playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">API key</label>
                  <input class="hx-input" v-model="form.providers.youtubeApiKey" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeApiKey" placeholder="Leave blank to keep" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">OAuth client ID</label>
                  <input class="hx-input" v-model="form.providers.youtubeClientId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">OAuth client secret</label>
                  <input class="hx-input" v-model="form.providers.youtubeClientSecret" type="password" autocomplete="new-password" :disabled="form.providers.clearYoutubeClientSecret" placeholder="Leave blank to keep" />
                </div>
              </div>
              <div class="hx-card-actions">
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearYoutubeApiKey" />
                  <span>Remove API key</span>
                </label>
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearYoutubeClientSecret" />
                  <span>Remove OAuth secret</span>
                </label>
              </div>
              <div class="cfg-provider-header" style="margin-top: var(--hx-space-2)">
                <span class="hx-text-muted">User authorization — {{ formatOAuthStatusLabel(secretStatus?.providers?.youtubeOAuth) }}</span>
                <span class="review-status-pill" :class="secretStatus?.providers?.youtubeOAuth?.linked ? 'review-status-selected' : 'review-status-held'">
                  {{ secretStatus?.providers?.youtubeOAuth?.linked ? 'Linked' : 'Not linked' }}
                </span>
              </div>
              <div class="hx-card-actions">
                <button type="button" class="hx-btn" @click="connectYouTubeOAuth" :disabled="isStartingYouTubeOAuth">
                  {{ isStartingYouTubeOAuth ? 'Starting…' : 'Connect YouTube' }}
                </button>
                <button type="button" class="hx-btn" @click="disconnectYouTubeOAuth" :disabled="isClearingYouTubeOAuth || !secretStatus?.providers?.youtubeOAuth?.linked">
                  {{ isClearingYouTubeOAuth ? 'Clearing…' : 'Clear authorization' }}
                </button>
              </div>
            </div>

            <!-- Apple Music -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Apple Music</h4>
                <span class="review-status-pill" :class="secretStatus?.providers?.appleMusic?.privateKeyConfigured ? 'review-status-selected' : 'review-status-held'">
                  {{ formatProviderSecretStatusLabel(secretStatus?.providers?.appleMusic, 'privateKeyConfigured', 'privateKeySource') }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.appleMusicEnabled" />
                <span>Accept Apple Music playlist links</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Team ID</label>
                  <input class="hx-input" v-model="form.providers.appleMusicTeamId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Key ID</label>
                  <input class="hx-input" v-model="form.providers.appleMusicKeyId" autocomplete="off" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Storefront</label>
                  <input class="hx-input" v-model="form.providers.appleMusicStorefront" maxlength="5" placeholder="us" />
                </div>
              </div>
              <div class="hx-field">
                <label class="hx-field-label">Private key</label>
                <textarea class="hx-textarea" v-model="form.providers.appleMusicPrivateKey" autocomplete="new-password" :disabled="form.providers.clearAppleMusicPrivateKey" placeholder="Leave blank to keep the current key" rows="4"></textarea>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.clearAppleMusicPrivateKey" />
                <span>Remove the stored Apple Music private key on save</span>
              </label>
            </div>

            <!-- Fanart.tv -->
            <div class="cfg-provider-card">
              <div class="cfg-provider-header">
                <h4 class="cfg-provider-name">Fanart.tv</h4>
                <span class="review-status-pill" :class="(secretStatus?.providers?.fanartTv?.apiKeyConfigured || secretStatus?.providers?.fanartTv?.clientKeyConfigured) ? 'review-status-selected' : 'review-status-held'">
                  {{ (secretStatus?.providers?.fanartTv?.apiKeyConfigured || secretStatus?.providers?.fanartTv?.clientKeyConfigured) ? 'Configured' : 'Not configured' }}
                </span>
              </div>
              <label class="cfg-check">
                <input type="checkbox" v-model="form.providers.fanartTvEnabled" />
                <span>Enable artist artwork from Fanart.tv</span>
              </label>
              <div class="hx-form-row">
                <div class="hx-field">
                  <label class="hx-field-label">Project API key</label>
                  <input class="hx-input" v-model="form.providers.fanartTvApiKey" type="password" autocomplete="new-password" :disabled="form.providers.clearFanartTvApiKey" placeholder="Leave blank to keep" />
                </div>
                <div class="hx-field">
                  <label class="hx-field-label">Personal API key</label>
                  <input class="hx-input" v-model="form.providers.fanartTvClientKey" type="password" autocomplete="new-password" :disabled="form.providers.clearFanartTvClientKey" placeholder="Leave blank to keep" />
                </div>
              </div>
              <p class="cfg-field-hint">Project key provides application-level access (7-day delay). Personal key takes priority (2-day delay). At least one key is required. Get keys at <a href="https://fanart.tv/get-an-api-key/" target="_blank" rel="noopener">fanart.tv</a>.</p>
              <div class="hx-card-actions">
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearFanartTvApiKey" />
                  <span>Remove project key</span>
                </label>
                <label class="cfg-check">
                  <input type="checkbox" v-model="form.providers.clearFanartTvClientKey" />
                  <span>Remove personal key</span>
                </label>
              </div>
            </div>

          </div>
        </SettingsDisclosure>
      </div>

      <p
        v-if="connectionActionFeedback"
        class="hx-alert"
        :data-tone="connectionActionFeedback.tone"
        :role="connectionActionFeedback.tone === 'danger' ? 'alert' : 'status'"
      >
        {{ connectionActionFeedback.message }}
      </p>
      <SettingsSaveBar :save-state="settingsSaveState" @verify="testProviderConnection" />
    </form>
  </div>
</template>

<style scoped>
.settings-connections__advanced-stack {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
}

.settings-connections__primary {
  width: 100%;
}

.settings-connections__provider-setup {
  margin-bottom: var(--hx-space-4);
}

.settings-connections__provider-modes {
  border: 0;
  display: grid;
  gap: var(--hx-space-2);
  margin: 0;
  padding: 0;
}

.settings-connections__provider-mode {
  align-items: flex-start;
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  cursor: pointer;
  display: grid;
  gap: var(--hx-space-2);
  grid-template-columns: auto minmax(0, 1fr);
  padding: var(--hx-space-3);
}

.settings-connections__provider-mode:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.6;
}

.settings-connections__provider-mode.is-selected {
  background: var(--hx-accent-soft);
  border-color: var(--hx-accent);
}

.settings-connections__provider-mode strong,
.settings-connections__provider-mode small {
  display: block;
}

.settings-connections__provider-mode small {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin-top: var(--hx-space-1);
}

</style>
