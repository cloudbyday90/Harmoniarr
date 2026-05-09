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
import { computed, inject, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildAuditActivityLinkTarget } from '../lib/audit-activity-links.js';
import { useAccountSecurity } from '../composables/useAccountSecurity.js';
import { useAccountPreferences } from '../composables/useAccountPreferences.js';
import { usePushNotifications } from '../composables/usePushNotifications.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();

const themeContext = inject('theme', null);
const themePref = computed(() => themeContext?.preference?.value ?? 'system');
function setTheme(value) {
  themeContext?.setTheme(value);
}

const form = reactive({
  confirmPassword: '',
  currentPassword: '',
  newPassword: '',
});

const {
  actionErrorMessage,
  activityErrorMessage,
  changePassword,
  isChangingPassword,
  isLoadingActivity,
  isLoadingSessions,
  loadRecentActivity,
  loadSessions,
  recentActivity,
  revokeSession,
  revokingSessionId,
  sessionErrorMessage,
  sessions,
  successMessage,
} = useAccountSecurity();

const {
  errorMessage: preferencesErrorMessage,
  isLoading: isPreferencesLoading,
  loadPreferences,
  preferences,
  savePreferences,
} = useAccountPreferences();

// Local draft for the preferences form — avoids touching shared state mid-edit.
const preferencesDraft = reactive({ preferredFormat: 'any', minimumQuality: 'any' });

function syncDraftFromPreferences() {
  preferencesDraft.preferredFormat = preferences.value.preferredFormat;
  preferencesDraft.minimumQuality = preferences.value.minimumQuality;
}

async function submitPreferences() {
  await savePreferences({
    preferredFormat: preferencesDraft.preferredFormat,
    minimumQuality: preferencesDraft.minimumQuality,
  });
  // Keep draft in sync if the server normalised any value.
  syncDraftFromPreferences();
}

const {
  checkSubscriptionStatus: checkPushStatus,
  errorMessage: pushErrorMessage,
  isLoading: isPushLoading,
  isSubscribed: isPushSubscribed,
  isSupported: isPushSupported,
  permissionState: pushPermissionState,
  subscribe: subscribePush,
  unsubscribe: unsubscribePush,
} = usePushNotifications();

const isPasswordMismatch = computed(() => form.newPassword !== form.confirmPassword);
const linkedRecentActivity = computed(() => recentActivity.value.map((event) => ({
  ...event,
  linkTarget: buildAuditActivityLinkTarget(event),
})));
  void loadPreferences().then(syncDraftFromPreferences);
const redirectTarget = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '');

async function submitPasswordChange() {
  if (isPasswordMismatch.value) {
    return;
  }

  await changePassword({
    currentPassword: form.currentPassword,
    newPassword: form.newPassword,
  });

  form.currentPassword = '';
  form.newPassword = '';
  form.confirmPassword = '';

  if (redirectTarget.value && !sessionStore.state.user?.mustChangePassword) {
    await router.push(redirectTarget.value);
  }
}

onMounted(() => {
  void checkPushStatus();
  void loadSessions();
  void loadRecentActivity();
});

function formatUserAgent(ua) {
  if (!ua) return 'Unknown client';
  // Non-browser identifiers (short service names like "node" or custom agents) — show as-is
  if (!ua.startsWith('Mozilla/')) return ua;
  // VS Code / Electron shell
  if (/Electron\//.test(ua)) {
    const appLabel = /Code\//.test(ua) ? 'VS Code' : 'Electron app';
    const ver = ua.match(/Electron\/([\d.]+)/);
    return ver ? `${appLabel} \u00b7 Electron ${ver[1]}` : appLabel;
  }
  // Edge (check before Chrome since Edge also includes Chrome token)
  if (/Edg\//.test(ua)) {
    const ver = ua.match(/Edg\/([\d.]+)/);
    return ver ? `Microsoft Edge ${ver[1]}` : 'Microsoft Edge';
  }
  // Chrome / Chromium
  const chromeVer = ua.match(/Chrome\/([\d.]+)/);
  if (chromeVer) return `Chrome ${chromeVer[1]}`;
  // Firefox
  const ffVer = ua.match(/Firefox\/([\d.]+)/);
  if (ffVer) return `Firefox ${ffVer[1]}`;
  // Safari
  const safariVer = ua.match(/Version\/([\d.]+).*Safari\//);
  if (safariVer) return `Safari ${safariVer[1]}`;
  // Unknown browser UA — truncate to avoid wall of text
  return ua.length > 60 ? `${ua.slice(0, 57)}\u2026` : ua;
}
</script>

<template>
  <section class="page-stack account-security-layout">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Account security</p>
      <h2>Password and session controls</h2>
      <p>
        Verify the current password before rotating credentials, and review the active browser sessions tied to this account.
      </p>
      <p class="warning-copy" v-if="sessionStore.state.user?.mustChangePassword">
        This account is blocked from fresh-admin actions until the password is changed.
      </p>
    </article>

    <article class="panel-light">
      <h3>Appearance</h3>
      <p class="metadata-card-copy">
        Choose how Harmoniarr looks. "System" follows your operating system's dark/light preference.
      </p>
      <div class="theme-toggle" role="group" aria-label="Theme preference">
        <button
          type="button"
          :class="['theme-toggle-btn', { 'is-active': themePref === 'system' }]"
          @click="setTheme('system')"
          :aria-pressed="themePref === 'system'"
        >
          System
        </button>
        <button
          type="button"
          :class="['theme-toggle-btn', { 'is-active': themePref === 'light' }]"
          @click="setTheme('light')"
          :aria-pressed="themePref === 'light'"
        >
          Light
        </button>
        <button
          type="button"
          :class="['theme-toggle-btn', { 'is-active': themePref === 'dark' }]"
          @click="setTheme('dark')"
          :aria-pressed="themePref === 'dark'"
        >
          Dark
        </button>
      </div>
    </article>

    <article class="panel-light">
      <h3>Import preferences</h3>
      <p class="metadata-card-copy">
        Set your preferred audio format and minimum quality for media requests. These are used as defaults when submitting new requests.
      </p>
      <form class="stack-form" @submit.prevent="submitPreferences">
        <label>
          Preferred format
          <select v-model="preferencesDraft.preferredFormat" :disabled="isPreferencesLoading">
            <option value="any">Any format</option>
            <option value="flac">FLAC (lossless)</option>
            <option value="mp3_320">MP3 320 kbps</option>
            <option value="mp3_v0">MP3 V0 (variable)</option>
          </select>
        </label>
        <label>
          Minimum quality
          <select v-model="preferencesDraft.minimumQuality" :disabled="isPreferencesLoading">
            <option value="any">Any quality</option>
            <option value="lossless">Lossless only</option>
            <option value="high">High quality (320+ / lossless)</option>
          </select>
        </label>
        <p class="error-copy" v-if="preferencesErrorMessage">{{ preferencesErrorMessage }}</p>
        <button type="submit" :disabled="isPreferencesLoading">
          {{ isPreferencesLoading ? 'Saving\u2026' : 'Save preferences' }}
        </button>
      </form>
    </article>

    <article class="panel-light">
      <h3>Push notifications</h3>
      <p class="metadata-card-copy">
        Get notified when your music requests are ready, even when Harmoniarr isn't open.
      </p>
      <p class="muted-copy" v-if="!isPushSupported">
        Push notifications are not supported in this browser.
      </p>
      <template v-else>
        <p class="error-copy" v-if="pushPermissionState === 'denied'">
          Notification permission was blocked. Enable notifications in your browser settings to receive alerts.
        </p>
        <template v-else>
          <p class="metadata-card-copy" v-if="isPushSubscribed">
            Notifications are enabled on this device.
          </p>
          <p class="metadata-card-copy" v-else>
            Notifications are not enabled on this device.
          </p>
          <p class="error-copy" v-if="pushErrorMessage">{{ pushErrorMessage }}</p>
          <button
            v-if="!isPushSubscribed"
            type="button"
            :disabled="isPushLoading"
            @click="subscribePush"
          >
            {{ isPushLoading ? 'Enabling\u2026' : 'Enable notifications' }}
          </button>
          <button
            v-else
            type="button"
            class="secondary-button"
            :disabled="isPushLoading"
            @click="unsubscribePush"
          >
            {{ isPushLoading ? 'Disabling\u2026' : 'Disable notifications' }}
          </button>
        </template>
      </template>
    </article>

    <article class="panel-light">
      <h3>Change password</h3>
      <form class="stack-form" @submit.prevent="submitPasswordChange">
        <label>
          Current password
          <input v-model="form.currentPassword" type="password" autocomplete="current-password" />
        </label>
        <label>
          New password
          <input v-model="form.newPassword" type="password" autocomplete="new-password" />
        </label>
        <label>
          Confirm new password
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" />
        </label>

        <p class="error-copy" v-if="isPasswordMismatch">The new password confirmation must match.</p>
        <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>
        <p class="success-copy" v-if="successMessage">{{ successMessage }}</p>

        <button type="submit" :disabled="isChangingPassword || isPasswordMismatch">
          {{ isChangingPassword ? 'Updating...' : 'Update password' }}
        </button>
      </form>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <p class="eyebrow">Active sessions</p>
          <h3>Signed-in browsers</h3>
        </div>
        <button type="button" class="secondary-button" @click="loadSessions" :disabled="isLoadingSessions">
          {{ isLoadingSessions ? 'Refreshing...' : 'Refresh sessions' }}
        </button>
      </div>

      <p class="error-copy" v-if="sessionErrorMessage">{{ sessionErrorMessage }}</p>

      <p v-if="isLoadingSessions">Loading active sessions.</p>

      <p class="metadata-card-copy" v-else-if="!sessions.length">
        No active sessions were returned for this account.
      </p>

      <div class="session-list" v-else>
        <article class="session-row" v-for="session in sessions" :key="session.id">
          <div>
            <p class="eyebrow">{{ session.isCurrent ? 'Current session' : 'Active session' }}</p>
            <strong :title="session.issuedUserAgent || undefined">{{ formatUserAgent(session.issuedUserAgent) }}</strong>
            <p class="metadata-card-copy">Issued from {{ session.issuedIp || 'unknown address' }}</p>
            <p class="muted-copy">Issued {{ session.issuedAt }} | Last used {{ session.lastUsedAt || 'never' }}</p>
            <p class="muted-copy">Expires {{ session.expiresAt }}</p>
          </div>
          <div class="session-actions">
            <span class="status-chip" data-status="healthy" v-if="session.isCurrent">Current</span>
            <button
              v-else
              type="button"
              class="secondary-button"
              :disabled="revokingSessionId === session.id"
              @click="revokeSession(session.id)"
            >
              {{ revokingSessionId === session.id ? 'Revoking...' : 'Revoke session' }}
            </button>
          </div>
        </article>
      </div>
    </article>

    <article class="panel-light">
      <div class="section-header">
        <div>
          <p class="eyebrow">Recent activity</p>
          <h3>Recent account actions</h3>
        </div>
        <button type="button" class="secondary-button" @click="loadRecentActivity" :disabled="isLoadingActivity">
          {{ isLoadingActivity ? 'Refreshing...' : 'Refresh activity' }}
        </button>
      </div>

      <p class="error-copy" v-if="activityErrorMessage">{{ activityErrorMessage }}</p>

      <p v-if="isLoadingActivity">Loading recent activity.</p>

      <p class="metadata-card-copy" v-else-if="!recentActivity.length">
        No recent activity was recorded for this account.
      </p>

      <div class="session-list" v-else>
        <article class="session-row" v-for="event in linkedRecentActivity" :key="event.id">
          <div>
            <p class="eyebrow">{{ event.occurredAt }}</p>
            <strong>{{ event.summary }}</strong>
            <p class="muted-copy">{{ event.eventType }}</p>
          </div>
          <div class="session-actions" v-if="event.linkTarget">
            <RouterLink class="secondary-button" :to="event.linkTarget.to">
              {{ event.linkTarget.label }}
            </RouterLink>
          </div>
        </article>
      </div>
    </article>
  </section>
</template>