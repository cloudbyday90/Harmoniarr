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
  formatDependencyProviderLabel,
  formatDependencyStatusLabel,
  formatOAuthStatusLabel,
  formatProviderSecretStatusLabel,
  formatSlskdProviderModeLabel,
  getDependencyStatusClass,
} from '../lib/settings-connections-presentation.js';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
import SoulseekProviderModeGuidance from '../components/settings/SoulseekProviderModeGuidance.vue';
import MusicQueueProviderRepairRecoveryConfirmation from '../components/music-queue/MusicQueueProviderRepairRecoveryConfirmation.vue';
import { useConnections } from '../composables/useConnections.js';
import { useDependencyHealth } from '../composables/useDependencyHealth.js';
import { useToast } from '../composables/useToast.js';
import { buildMusicQueueProviderRepairRecoveryConfirmation, isMusicQueueProviderRepairReturnContext } from '../lib/music-queue-provider-repair-recovery-presentation.js';
import { buildSettingsSetupProgress } from '../lib/settings-setup-progress.js';

const toast = useToast();
const route = useRoute();

const {
  dependencies: providerHealth,
  isLoading: isTestingProviderHealth,
  loadDependencyHealth,
  loadError: providerHealthError,
} = useDependencyHealth();

const {
  connectSpotifyOAuth,
  connectYouTubeOAuth,
  disconnectSpotifyOAuth,
  disconnectYouTubeOAuth,
  errorMessage,
  form,
  isClearingSpotifyOAuth,
  isClearingYouTubeOAuth,
  isLoading,
  isSaving,
  isStartingSpotifyOAuth,
  isStartingYouTubeOAuth,
  loadSettings,
  saveSettings,
  secretStatus,
  successMessage,
} = useConnections();

const isManagedDeployment = computed(() => secretStatus.value?.slskd?.managedDeploymentDetected === true);
const isSoulseekDisabled = computed(() => form.slskd.providerMode === 'disabled');
const isExternalSoulseek = computed(() => form.slskd.providerMode === 'external');
const isManagedSoulseek = computed(() => form.slskd.providerMode === 'managed');
const isMusicQueueProviderRepairReturn = computed(() =>
  isMusicQueueProviderRepairReturnContext(route.query.repair),
);
const providerRepairConfirmation = ref(null);
const safeSetupProgress = computed(() => buildSettingsSetupProgress({
  secretStatus: {
    slskd: {
      providerMode: form.slskd.providerMode,
      providerModeState: secretStatus.value?.slskd?.providerModeState,
    },
  },
}));

async function refreshProviderRepairConfirmation() {
  await loadDependencyHealth();
  if (!isMusicQueueProviderRepairReturn.value) return;

  providerRepairConfirmation.value = buildMusicQueueProviderRepairRecoveryConfirmation({
    dependencies: providerHealth.value,
    healthLoadFailed: Boolean(providerHealthError.value),
    setupProgress: safeSetupProgress.value,
  });
}

async function handleSaveSettings() {
  providerRepairConfirmation.value = null;
  await saveSettings();
  if (!isMusicQueueProviderRepairReturn.value || errorMessage.value || !successMessage.value) return;

  await refreshProviderRepairConfirmation();
}

async function testProviderConnection() {
  if (isSoulseekDisabled.value) {
    toast.info('Soulseek downloads are turned off. Choose Managed or External to test a connection.');
    return;
  }

  await refreshProviderRepairConfirmation();

  if (providerHealthError.value) {
    toast.error(`Connection test failed: ${providerHealthError.value}`);
    return;
  }

  const slskdStatus = providerHealth.value.find((dep) => dep.provider === 'slskd');
  if (!slskdStatus) {
    toast.info('Provider health refreshed.');
    return;
  }

  if (slskdStatus.status === 'healthy') {
    toast.success(slskdStatus.message ?? 'Soulseek connection is healthy.');
    return;
  }

  const message = slskdStatus.message
    ?? `Soulseek connection is ${formatDependencyStatusLabel(slskdStatus.status).toLowerCase()}.`;
  if (slskdStatus.status === 'disabled') {
    toast.warning(message);
    return;
  }

  toast.error(message);
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
  },
);

onMounted(() => {
  void loadSettings();
  void loadDependencyHealth();
});
</script>

<template>
  <div class="cfg-page">
    <article class="hx-card" v-if="isLoading">
      <div class="hx-card-body">
        <p class="hx-text-muted">Loading settings…</p>
      </div>
    </article>

    <article class="hx-card" v-else-if="errorMessage && !successMessage">
      <div class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Settings unavailable</h3>
          <p class="hx-card-subtitle">{{ errorMessage }}</p>
        </div>
      </div>
    </article>

    <form @submit.prevent="handleSaveSettings" v-else>
      <div class="cfg-2col">

        <!-- Soulseek connection -->
        <article class="hx-card">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Soulseek connection</h3>
              <p class="hx-card-subtitle">{{ buildSlskdConnectionSubtitle() }}</p>
            </div>
            <span class="review-status-pill" :class="isSoulseekDisabled ? 'review-status-held' : 'review-status-selected'">
              {{ formatSlskdProviderModeLabel(secretStatus?.slskd ?? { providerMode: form.slskd.providerMode }) }}
            </span>
          </header>
          <div class="hx-card-body">
            <div class="cfg-group" style="padding-top: 0; border-top: none">
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
            <div v-if="isExternalSoulseek" class="cfg-group">
              <div class="hx-field">
                <label class="hx-field-label">Service address</label>
                <input class="hx-input" v-model="form.slskd.baseUrl" placeholder="http://slskd:5030" />
              </div>
              <p class="cfg-field-hint">The address of the separately managed download service. Use an address reachable from Harmoniarr.</p>
            </div>
            <div v-if="isExternalSoulseek" class="cfg-group">
              <p class="cfg-group-title">API key</p>
              <div class="hx-field">
                <label class="hx-field-label">API key</label>
                <input class="hx-input" v-model="form.slskd.apiKey" type="password" autocomplete="new-password" :disabled="form.slskd.clearApiKey" placeholder="Leave blank to keep the current key" />
              </div>
              <p class="cfg-field-hint">The API key from your slskd config. Stored securely — this field never shows the saved value. Leave blank to keep the current key.</p>
              <label class="cfg-check" style="margin-top: var(--hx-space-2)">
                <input type="checkbox" v-model="form.slskd.clearApiKey" />
                <span>Remove the stored API key on save</span>
              </label>
            </div>
            <div v-else-if="isManagedSoulseek" class="cfg-group">
              <p class="cfg-group-title">Managed by deployment</p>
              <p class="cfg-field-hint">Harmoniarr reads the API key from the managed Docker secret file. Change managed credentials in the deployment, not in Settings.</p>
            </div>
            <div v-else class="cfg-group">
              <p class="cfg-group-title">Downloads are off</p>
              <p class="cfg-field-hint">Harmoniarr will not contact Soulseek, queue downloads, or poll the download service until you select Managed or External.</p>
            </div>
            <SoulseekProviderModeGuidance
              :managed-deployment-detected="isManagedDeployment"
              :provider-mode="form.slskd.providerMode"
            />
          </div>
        </article>

        <!-- Provider operational health -->
        <article class="hx-card" v-if="providerHealth.length || providerHealthError">
          <header class="hx-card-header">
            <div>
              <h3 class="hx-card-title">Provider health</h3>
              <p class="hx-card-subtitle">Operational status of connected services, updated from the server heartbeat.</p>
            </div>
            <button type="button" class="hx-btn" @click="testProviderConnection" :disabled="isTestingProviderHealth || isSoulseekDisabled">
              {{ isSoulseekDisabled ? 'Soulseek is off' : isTestingProviderHealth ? 'Testing Soulseek…' : 'Test Soulseek' }}
            </button>
          </header>
          <div class="hx-card-body">
            <p class="cfg-save-msg is-error" v-if="providerHealthError">{{ providerHealthError }}</p>
            <div class="cfg-health-list">
              <div class="cfg-health-row" v-for="dep in providerHealth" :key="dep.provider">
                <span class="cfg-health-provider">{{ formatDependencyProviderLabel(dep.provider) }}</span>
                <span class="review-status-pill" :class="getDependencyStatusClass(dep.status)">
                  {{ formatDependencyStatusLabel(dep.status) }}
                </span>
                <span class="hx-text-muted" v-if="dep.message">{{ dep.message }}</span>
                <span class="hx-text-muted" v-if="dep.details?.observedAt">Last checked {{ new Date(dep.details.observedAt).toLocaleString() }}</span>
              </div>
            </div>
          </div>
        </article>

      </div>

      <MusicQueueProviderRepairRecoveryConfirmation
        v-if="isMusicQueueProviderRepairReturn"
        :confirmation="providerRepairConfirmation"
      />

      <div class="settings-connections__advanced-stack">
        <SettingsDisclosure
          panel-id="settings-connection-behavior"
          title="Connection timing and playlist behavior"
          subtitle="Change these only when a provider requires different behavior."
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
          title="Optional music-source connections"
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

      <div class="cfg-save-bar">
        <span class="cfg-save-msg is-error" v-if="errorMessage">{{ errorMessage }}</span>
        <span class="cfg-save-msg is-success" v-else-if="successMessage">{{ successMessage }}</span>
        <button type="submit" class="hx-btn" data-variant="primary" :disabled="isSaving">
          {{ isSaving ? 'Saving…' : 'Save settings' }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.settings-connections__advanced-stack {
  display: grid;
  gap: var(--hx-space-4);
  margin-top: var(--hx-space-4);
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

.cfg-health-list {
  display: grid;
  gap: var(--hx-space-3);
}

.cfg-health-row {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  padding: var(--hx-space-2) 0;
  border-bottom: 1px solid var(--hx-border-subtle);
}

.cfg-health-row:last-child {
  border-bottom: none;
}

.cfg-health-provider {
  font-weight: 600;
  min-width: 140px;
}

@media (max-width: 640px) {
  .cfg-health-row {
    align-items: flex-start;
    flex-direction: column;
    gap: var(--hx-space-1);
  }
}
</style>
