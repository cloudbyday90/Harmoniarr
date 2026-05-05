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
import { computed, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { buildAuditActivityLinkTarget } from '../lib/audit-activity-links.js';
import { useAccountSecurity } from '../composables/useAccountSecurity.js';
import { sessionStore } from '../state/session.js';

const route = useRoute();
const router = useRouter();
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

const isPasswordMismatch = computed(() => form.newPassword !== form.confirmPassword);
const linkedRecentActivity = computed(() => recentActivity.value.map((event) => ({
  ...event,
  linkTarget: buildAuditActivityLinkTarget(event),
})));
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