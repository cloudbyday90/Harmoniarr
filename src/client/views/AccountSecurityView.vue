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
import { computed, inject, onBeforeUnmount, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildAuditActivityLinkTarget } from '../lib/audit-activity-links.js';
import {
  buildActiveSessionsSubtitle,
  buildMustChangePasswordWarning,
  buildPushPermissionDeniedBody,
  buildPushSubscribedBody,
  buildPushUnsubscribedBody,
  buildRequestPreferencesTitle,
  formatPushNotificationError,
  formatSessionTimestamp,
  formatUserAgent,
  getActivityEventStatusLabel,
  getActivityEventTone,
  isSecurityRelevantEvent,
  isServiceSession,
} from '../lib/account-security-presentation.js';
import { buildAccountSecurityPosture } from '../lib/settings-account-security-presentation.js';
import SettingsDisclosure from '../components/settings/SettingsDisclosure.vue';
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
  isRevalidating,
  loadRecentActivity,
  loadSessions,
  recentActivity,
  revokeSession,
  revokingSessionId,
  sessionErrorMessage,
  sessions,
  successMessage,
  attachVisibilityListener,
  destroy,
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
const accountSecurityPosture = computed(() => buildAccountSecurityPosture({
  isLoadingSessions: isLoadingSessions.value,
  mustChangePassword: sessionStore.state.user?.mustChangePassword,
  sessionErrorMessage: sessionErrorMessage.value,
  sessions: sessions.value,
}));
const securityActivity = computed(() =>
  recentActivity.value
    .map((event) => ({ ...event, linkTarget: buildAuditActivityLinkTarget(event) }))
    .filter(isSecurityRelevantEvent),
);
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
  void loadPreferences().then(syncDraftFromPreferences);
  attachVisibilityListener();
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">My account</h1>
        <p class="hx-page-subtitle">Review your sign-in, then manage account preferences when needed.</p>
      </div>
    </header>

    <!-- Action feedback (password change + session revocation share this state) -->
    <div v-if="actionErrorMessage || successMessage" class="as-feedback">
      <span v-if="actionErrorMessage" class="hx-pill" data-tone="danger">{{ actionErrorMessage }}</span>
      <span v-else-if="successMessage" class="hx-pill" data-tone="success">{{ successMessage }}</span>
    </div>

    <article class="hx-card as-posture-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Account safety</h2>
          <p class="hx-card-subtitle">Signed in as {{ sessionStore.state.user?.username ?? 'this account' }}.</p>
        </div>
        <span class="hx-pill" :data-tone="accountSecurityPosture.tone">{{ accountSecurityPosture.status }}</span>
      </header>
      <div class="hx-card-body">
        <p class="hx-text-muted as-posture-copy">{{ accountSecurityPosture.copy }}</p>
      </div>
    </article>

    <section class="as-section" aria-labelledby="account-security-tasks-heading">
      <div class="as-section-header">
        <h2 id="account-security-tasks-heading" class="as-section-title">Security tasks</h2>
        <p class="hx-text-muted as-section-copy">Use these only when you need to change access or review a sign-in.</p>
      </div>

    <!-- 1. Change password ------------------------------------------------ -->
    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h3 class="hx-card-title">Password</h3>
          <p class="hx-card-subtitle">Changing your password signs out other active devices.</p>
        </div>
      </header>
      <div class="hx-card-body">
        <p v-if="sessionStore.state.user?.mustChangePassword" class="as-password-required" role="status">
          <span class="hx-pill" data-tone="danger">{{ buildMustChangePasswordWarning() }}</span>
        </p>
        <SettingsDisclosure
          panel-id="settings-account-change-password"
          title="Change password"
          subtitle="Verify your current password before setting a new one."
          show-label="Change password"
          hide-label="Hide password form"
          :heading-level="4"
          :start-open="sessionStore.state.user?.mustChangePassword === true"
          variant="inline"
        >
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
        </SettingsDisclosure>
      </div>
    </article>
    <!-- 2. Active sessions ----------------------------------------------- -->
    <SettingsDisclosure
      panel-id="settings-account-signed-in-devices"
      title="Signed-in devices"
      :subtitle="buildActiveSessionsSubtitle()"
      show-label="Review devices"
      hide-label="Hide devices"
      :heading-level="3"
    >
      <div class="as-disclosure-actions">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          @click="loadSessions"
          :disabled="isLoadingSessions || isRevalidating"
        >
          {{ isLoadingSessions ? 'Refreshing\u2026' : 'Refresh devices' }}
        </button>
      </div>

      <div v-if="sessionErrorMessage">
        <span class="hx-pill" data-tone="danger">{{ sessionErrorMessage }}</span>
      </div>

      <div v-if="isLoadingSessions">
        <p class="hx-text-muted">Loading sessions\u2026</p>
      </div>

      <div v-else-if="!sessions.length">
        <div class="hx-empty">
          <p class="hx-empty-title">No sessions</p>
          <p class="hx-empty-copy">No active sessions were found for this account.</p>
        </div>
      </div>

      <div v-else class="as-disclosure-list">
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
    </SettingsDisclosure>

    <!-- 3. Recent account activity --------------------------------------- -->
    <SettingsDisclosure
      panel-id="settings-account-recent-security-activity"
      title="Recent security activity"
      subtitle="Login attempts, password changes, and session events."
      show-label="Review activity"
      hide-label="Hide activity"
      :heading-level="3"
    >
      <div class="as-disclosure-actions">
        <button
          type="button"
          class="hx-btn"
          data-variant="ghost"
          @click="loadRecentActivity"
          :disabled="isLoadingActivity || isRevalidating"
        >
          {{ isLoadingActivity ? 'Refreshing\u2026' : 'Refresh activity' }}
        </button>
      </div>

      <div v-if="activityErrorMessage">
        <span class="hx-pill" data-tone="danger">{{ activityErrorMessage }}</span>
      </div>

      <div v-if="isLoadingActivity">
        <p class="hx-text-muted">Loading activity\u2026</p>
      </div>

      <div v-else-if="!securityActivity.length">
        <div class="hx-empty">
          <p class="hx-empty-title">No activity</p>
          <p class="hx-empty-copy">No recent security events were recorded for this account.</p>
        </div>
      </div>

      <div v-else class="as-disclosure-list">
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
    </SettingsDisclosure>
    </section>

    <!-- Preferences ------------------------------------------------------- -->
    <section class="as-section" aria-labelledby="account-preferences-heading">
      <div class="as-section-header">
        <h2 id="account-preferences-heading" class="as-section-title">Preferences</h2>
        <p class="hx-text-muted as-section-copy">Personalize Harmoniarr without changing how the system is managed.</p>
      </div>
    <!-- 4. Appearance -->
    <SettingsDisclosure
      panel-id="settings-account-appearance"
      title="Appearance"
      subtitle="Choose how Harmoniarr looks. System follows your device preference."
      show-label="Change appearance"
      hide-label="Hide appearance options"
      :heading-level="3"
    >
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
    </SettingsDisclosure>

    <!-- 5. Import preferences -->
    <SettingsDisclosure
      panel-id="settings-account-request-preferences"
      :title="buildRequestPreferencesTitle()"
      subtitle="Default audio format and quality used when submitting new requests."
      show-label="Change request preferences"
      hide-label="Hide request preferences"
      :heading-level="3"
    >
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
    </SettingsDisclosure>

    <!-- 6. Push notifications -->
    <SettingsDisclosure
      panel-id="settings-account-push-notifications"
      title="Notifications"
      subtitle="Get notified when your music requests are ready, even when the app is not open."
      show-label="Manage notifications"
      hide-label="Hide notification options"
      :heading-level="3"
    >
        <div class="hx-empty" v-if="!isPushSupported">
          <p class="hx-empty-title">Not supported</p>
          <p class="hx-empty-copy">Push notifications are not available in this browser.</p>
        </div>
        <template v-else>
          <div v-if="pushPermissionState === 'denied'">
            <p class="hx-text-muted">{{ buildPushPermissionDeniedBody() }}</p>
          </div>
          <div v-else class="as-push-body">
            <p class="hx-text-muted">
              {{ isPushSubscribed ? buildPushSubscribedBody() : buildPushUnsubscribedBody() }}
            </p>
            <span class="hx-pill" data-tone="danger" v-if="pushErrorMessage">{{ formatPushNotificationError(pushErrorMessage) }}</span>
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
    </SettingsDisclosure>
    </section>
  </section>
</template>

<style scoped>
.as-feedback {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
}

.as-posture-card {
  gap: 0;
}

.as-posture-copy,
.as-section-copy {
  margin: 0;
}

.as-section {
  display: grid;
  gap: var(--hx-space-3);
}

.as-section-header {
  display: grid;
  gap: var(--hx-space-1);
}

.as-section-title {
  color: var(--hx-text-strong);
  font-size: var(--hx-text-md);
  margin: 0;
}

.as-password-required {
  margin: 0 0 var(--hx-space-3);
}

.as-disclosure-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: var(--hx-space-3);
}

.as-disclosure-list {
  border-top: 1px solid var(--hx-border-subtle);
  margin: var(--hx-space-4) calc(var(--hx-space-4) * -1) calc(var(--hx-space-4) * -1);
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
