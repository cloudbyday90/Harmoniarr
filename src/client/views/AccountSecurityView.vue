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
import { computed, inject, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildAuditActivityLinkTarget } from '../lib/audit-activity-links.js';
import {
  formatSessionTimestamp,
  formatUserAgent,
  getActivityEventStatusLabel,
  getActivityEventTone,
  isSecurityRelevantEvent,
  isServiceSession,
} from '../lib/account-security-presentation.js';
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
const securityActivity = computed(() =>
  recentActivity.value
    .map((event) => ({ ...event, linkTarget: buildAuditActivityLinkTarget(event) }))
    .filter(isSecurityRelevantEvent),
);
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
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">My account</h1>
        <p class="hx-page-subtitle">Password, sessions, and account preferences.</p>
      </div>
    </header>

    <!-- Must-change-password warning -->
    <div v-if="sessionStore.state.user?.mustChangePassword" class="as-notice">
      <span class="hx-pill" data-tone="danger">
        Password change required — this account cannot perform admin actions until the password is updated.
      </span>
    </div>

    <!-- Action feedback (password change + session revocation share this state) -->
    <div v-if="actionErrorMessage || successMessage" class="as-feedback">
      <span v-if="actionErrorMessage" class="hx-pill" data-tone="danger">{{ actionErrorMessage }}</span>
      <span v-else-if="successMessage" class="hx-pill" data-tone="success">{{ successMessage }}</span>
    </div>

    <!-- 1. Change password ------------------------------------------------ -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Change password</h2>
          <p class="hx-card-subtitle">Verify your current password before setting a new one.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <form @submit.prevent="submitPasswordChange" class="as-form">
          <div class="hx-field">
            <label class="hx-field-label" for="as-current-password">Current password</label>
            <input
              id="as-current-password"
              class="hx-input"
              type="password"
              v-model="form.currentPassword"
              autocomplete="current-password"
            />
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="as-new-password">New password</label>
            <input
              id="as-new-password"
              class="hx-input"
              type="password"
              v-model="form.newPassword"
              autocomplete="new-password"
            />
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="as-confirm-password">Confirm new password</label>
            <input
              id="as-confirm-password"
              class="hx-input"
              type="password"
              v-model="form.confirmPassword"
              autocomplete="new-password"
            />
          </div>
          <div class="as-form-footer">
            <span
              class="hx-pill"
              data-tone="danger"
              v-if="form.confirmPassword && isPasswordMismatch"
            >Passwords do not match</span>
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isChangingPassword || isPasswordMismatch || !form.currentPassword || !form.newPassword"
            >
              {{ isChangingPassword ? 'Updating\u2026' : 'Update password' }}
            </button>
          </div>
        </form>
      </div>
    </article>

    <!-- 2. Active sessions ----------------------------------------------- -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Active sessions</h2>
          <p class="hx-card-subtitle">Browsers and services currently signed in to this account.</p>
        </div>
        <div class="hx-card-actions">
          <button
            type="button"
            class="hx-btn"
            data-variant="ghost"
            @click="loadSessions"
            :disabled="isLoadingSessions"
          >
            {{ isLoadingSessions ? 'Refreshing\u2026' : 'Refresh' }}
          </button>
        </div>
      </header>

      <div class="hx-card-body" v-if="sessionErrorMessage">
        <span class="hx-pill" data-tone="danger">{{ sessionErrorMessage }}</span>
      </div>

      <div class="hx-card-body" v-if="isLoadingSessions">
        <p class="hx-text-muted">Loading sessions\u2026</p>
      </div>

      <div v-else-if="!sessions.length" class="hx-card-body">
        <div class="hx-empty">
          <p class="hx-empty-title">No sessions</p>
          <p class="hx-empty-copy">No active sessions were found for this account.</p>
        </div>
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <ul class="as-session-list">
          <li class="as-session-row" v-for="session in sessions" :key="session.id">
            <div class="as-session-info">
              <div class="as-session-client-row">
                <strong
                  class="as-session-client"
                  :title="session.issuedUserAgent || undefined"
                >{{ formatUserAgent(session.issuedUserAgent) }}</strong>
                <span
                  class="hx-pill"
                  :data-tone="isServiceSession(session) ? 'warning' : 'info'"
                >{{ isServiceSession(session) ? 'Service' : 'Browser' }}</span>
              </div>
              <p class="hx-text-muted as-session-meta">
                Issued {{ formatSessionTimestamp(session.issuedAt) }}
                from {{ session.issuedIp || 'unknown address' }}
              </p>
              <p class="hx-text-muted as-session-meta">
                Last used: {{ session.lastUsedAt ? formatSessionTimestamp(session.lastUsedAt) : 'Never' }}
                &middot;
                Expires {{ formatSessionTimestamp(session.expiresAt) }}
              </p>
            </div>
            <div class="as-session-action">
              <span class="hx-pill" data-tone="success" v-if="session.isCurrent">Current</span>
              <button
                v-else
                type="button"
                class="hx-btn"
                data-variant="ghost"
                :disabled="revokingSessionId === session.id"
                @click="revokeSession(session.id)"
              >
                {{ revokingSessionId === session.id ? 'Revoking\u2026' : 'Revoke' }}
              </button>
            </div>
          </li>
        </ul>
      </div>
    </article>

    <!-- 3. Recent account activity --------------------------------------- -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Recent account activity</h2>
          <p class="hx-card-subtitle">Login attempts, password changes, and session events.</p>
        </div>
        <div class="hx-card-actions">
          <button
            type="button"
            class="hx-btn"
            data-variant="ghost"
            @click="loadRecentActivity"
            :disabled="isLoadingActivity"
          >
            {{ isLoadingActivity ? 'Refreshing\u2026' : 'Refresh' }}
          </button>
        </div>
      </header>

      <div class="hx-card-body" v-if="activityErrorMessage">
        <span class="hx-pill" data-tone="danger">{{ activityErrorMessage }}</span>
      </div>

      <div class="hx-card-body" v-if="isLoadingActivity">
        <p class="hx-text-muted">Loading activity\u2026</p>
      </div>

      <div v-else-if="!securityActivity.length" class="hx-card-body">
        <div class="hx-empty">
          <p class="hx-empty-title">No activity</p>
          <p class="hx-empty-copy">No recent security events were recorded for this account.</p>
        </div>
      </div>

      <div v-else class="hx-card-body hx-card-body--flush">
        <ul class="as-activity-list">
          <li class="as-activity-row" v-for="event in securityActivity" :key="event.id">
            <div class="as-activity-info">
              <strong class="as-activity-summary">{{ event.summary }}</strong>
              <p class="hx-text-muted as-activity-time">{{ formatSessionTimestamp(event.occurredAt) }}</p>
            </div>
            <div class="as-activity-meta">
              <span
                class="hx-pill"
                :data-tone="getActivityEventTone(event.eventType)"
              >{{ getActivityEventStatusLabel(event.eventType) }}</span>
              <RouterLink
                v-if="event.linkTarget"
                class="hx-btn"
                data-variant="ghost"
                :to="event.linkTarget.to"
              >{{ event.linkTarget.label }}</RouterLink>
            </div>
          </li>
        </ul>
      </div>
    </article>

    <!-- Preferences ------------------------------------------------------- -->
    <p class="hx-text-muted as-prefs-divider">Preferences</p>

    <!-- 4. Appearance -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Appearance</h2>
          <p class="hx-card-subtitle">Choose how Harmoniarr looks. "System" follows your OS preference.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <div class="as-theme-toggle" role="group" aria-label="Theme preference">
          <button
            type="button"
            class="hx-btn"
            :data-variant="themePref === 'system' ? 'primary' : 'ghost'"
            @click="setTheme('system')"
            :aria-pressed="themePref === 'system'"
          >System</button>
          <button
            type="button"
            class="hx-btn"
            :data-variant="themePref === 'light' ? 'primary' : 'ghost'"
            @click="setTheme('light')"
            :aria-pressed="themePref === 'light'"
          >Light</button>
          <button
            type="button"
            class="hx-btn"
            :data-variant="themePref === 'dark' ? 'primary' : 'ghost'"
            @click="setTheme('dark')"
            :aria-pressed="themePref === 'dark'"
          >Dark</button>
        </div>
      </div>
    </article>

    <!-- 5. Import preferences -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Import preferences</h2>
          <p class="hx-card-subtitle">Default audio format and quality used when submitting new requests.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <form @submit.prevent="submitPreferences" class="as-form">
          <div class="hx-field">
            <label class="hx-field-label" for="as-preferred-format">Preferred format</label>
            <select
              id="as-preferred-format"
              class="hx-select"
              v-model="preferencesDraft.preferredFormat"
              :disabled="isPreferencesLoading"
            >
              <option value="any">Any format</option>
              <option value="flac">FLAC (lossless)</option>
              <option value="mp3_320">MP3 320 kbps</option>
              <option value="mp3_v0">MP3 V0 (variable)</option>
            </select>
          </div>
          <div class="hx-field">
            <label class="hx-field-label" for="as-minimum-quality">Minimum quality</label>
            <select
              id="as-minimum-quality"
              class="hx-select"
              v-model="preferencesDraft.minimumQuality"
              :disabled="isPreferencesLoading"
            >
              <option value="any">Any quality</option>
              <option value="lossless">Lossless only</option>
              <option value="high">High quality (320+ / lossless)</option>
            </select>
          </div>
          <div class="as-form-footer">
            <span class="hx-pill" data-tone="danger" v-if="preferencesErrorMessage">{{ preferencesErrorMessage }}</span>
            <button
              type="submit"
              class="hx-btn"
              data-variant="primary"
              :disabled="isPreferencesLoading"
            >
              {{ isPreferencesLoading ? 'Saving\u2026' : 'Save preferences' }}
            </button>
          </div>
        </form>
      </div>
    </article>

    <!-- 6. Push notifications -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Push notifications</h2>
          <p class="hx-card-subtitle">Get notified when your music requests are ready, even when the app is not open.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <div class="hx-empty" v-if="!isPushSupported">
          <p class="hx-empty-title">Not supported</p>
          <p class="hx-empty-copy">Push notifications are not available in this browser.</p>
        </div>
        <template v-else>
          <div v-if="pushPermissionState === 'denied'">
            <p class="hx-text-muted">
              Notification permission was blocked. Open your browser's site settings and allow
              notifications for this page, then reload.
            </p>
          </div>
          <div v-else class="as-push-body">
            <p class="hx-text-muted">
              {{ isPushSubscribed
                ? 'Notifications are enabled on this device.'
                : 'Notifications are not enabled on this device.' }}
            </p>
            <span class="hx-pill" data-tone="danger" v-if="pushErrorMessage">{{ pushErrorMessage }}</span>
            <div class="as-push-actions">
              <button
                v-if="!isPushSubscribed"
                type="button"
                class="hx-btn"
                data-variant="primary"
                :disabled="isPushLoading"
                @click="subscribePush"
              >
                {{ isPushLoading ? 'Enabling\u2026' : 'Enable notifications' }}
              </button>
              <button
                v-else
                type="button"
                class="hx-btn"
                :disabled="isPushLoading"
                @click="unsubscribePush"
              >
                {{ isPushLoading ? 'Disabling\u2026' : 'Disable notifications' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </article>
  </section>
</template>

<style scoped>
.as-notice,
.as-feedback {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
}

.as-form {
  display: grid;
  gap: var(--hx-space-4);
}

.as-form-footer {
  display: flex;
  align-items: center;
  gap: var(--hx-space-3);
  flex-wrap: wrap;
}

.as-session-list,
.as-activity-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.as-session-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-4) var(--hx-space-5);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.as-session-row:last-child {
  border-bottom: none;
}

.as-session-info {
  display: grid;
  gap: var(--hx-space-1);
}

.as-session-client-row {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.as-session-client {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-strong);
}

.as-session-meta {
  font-size: var(--hx-text-xs);
  margin: 0;
}

.as-session-action {
  flex-shrink: 0;
}

.as-activity-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-4);
  padding: var(--hx-space-3) var(--hx-space-5);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.as-activity-row:last-child {
  border-bottom: none;
}

.as-activity-info {
  display: grid;
  gap: var(--hx-space-1);
}

.as-activity-summary {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-strong);
}

.as-activity-time {
  font-size: var(--hx-text-xs);
  margin: 0;
}

.as-activity-meta {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-shrink: 0;
}

.as-prefs-divider {
  font-size: var(--hx-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: var(--hx-space-2) 0 var(--hx-space-1);
  margin: 0;
  border-top: 1px solid var(--hx-border-subtle);
  padding-top: var(--hx-space-4);
}

.as-theme-toggle {
  display: flex;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.as-push-body {
  display: grid;
  gap: var(--hx-space-3);
}

.as-push-actions {
  display: flex;
  gap: var(--hx-space-2);
}
</style>
