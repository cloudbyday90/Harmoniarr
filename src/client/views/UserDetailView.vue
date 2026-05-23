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
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserDetail } from '../composables/useUserDetail.js';
import {
  formatAuditEventType,
  formatAuditEventTypeTone,
  formatRelativeTime,
  formatSessionStatus,
  summarizeRequestCounts,
} from '../lib/user-detail-presentation.js';
import { formatAuthProvider, formatUserRole, formatUserRoleTone } from '../lib/settings-users-presentation.js';

const route = useRoute();
const router = useRouter();

const {
  user,
  requestSummary,
  sessions,
  activityEvents,
  isLoading,
  isLoadingActivity,
  errorMessage,
  hasMoreActivity,
  load,
  loadActivity,
} = useUserDetail();

const requestStats = computed(() => summarizeRequestCounts(requestSummary.value));

onMounted(() => {
  const userId = route.params.userId;
  if (userId) {
    void load({ userId });
    void loadActivity({ userId });
  }
});

function goBack() {
  router.push({ name: 'settings-users' });
}

function handleLoadMoreActivity() {
  void loadActivity({ userId: route.params.userId });
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}
</script>

<template>
  <section class="hx-page udl">
    <header class="hx-page-header">
      <div>
        <button type="button" class="hx-btn" data-variant="ghost" @click="goBack">&#8592; Back to users</button>
        <h1 class="hx-page-title udl-title">{{ user?.username ?? 'User detail' }}</h1>
        <p class="hx-page-subtitle" v-if="user">{{ user.email ?? 'No email' }}</p>
      </div>
      <div class="hx-page-actions">
        <span v-if="user" class="hx-pill" :data-tone="formatUserRoleTone(user.role)">{{ formatUserRole(user.role) }}</span>
      </div>
    </header>

    <p v-if="isLoading" class="hx-text-muted" aria-live="polite" aria-busy="true">Loading user detail.</p>
    <p v-else-if="errorMessage" class="hx-text-muted" style="color: var(--hx-danger)">{{ errorMessage }}</p>

    <template v-else-if="user">
      <div class="hx-stat-grid">
        <article class="hx-stat-card">
          <span class="hx-stat-label">Auth</span>
          <span class="hx-stat-value">{{ formatAuthProvider(user.authProvider) }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Created</span>
          <span class="hx-stat-value">{{ formatTimestamp(user.createdAt) }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Last login</span>
          <span class="hx-stat-value">{{ user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : 'Never' }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Status</span>
          <span class="hx-stat-value">
            <span class="hx-pill" :data-tone="user.isDisabled ? 'danger' : 'success'">{{ user.isDisabled ? 'Disabled' : 'Active' }}</span>
          </span>
        </article>
      </div>

      <div v-if="user.plexProfile" class="hx-card udl-section">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Plex profile</h2>
          </div>
        </header>
        <div class="hx-card-body">
          <dl class="udl-deflist">
            <dt>Username</dt>
            <dd>{{ user.plexProfile.plexUsername ?? user.plexProfile.plexTitle ?? 'Unknown' }}</dd>
            <dt>Email</dt>
            <dd>{{ user.plexProfile.plexEmail ?? 'Not available' }}</dd>
            <dt>Library access</dt>
            <dd>{{ user.plexProfile.libraryAccessState ?? 'Unknown' }}</dd>
            <dt>Last synced</dt>
            <dd>{{ user.plexProfile.syncedAt ? formatTimestamp(user.plexProfile.syncedAt) : 'Never' }}</dd>
          </dl>
        </div>
      </div>

      <div v-if="requestStats.length > 0" class="hx-card udl-section">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Media requests</h2>
          </div>
        </header>
        <div class="hx-card-body">
          <div class="hx-stat-grid">
            <article v-for="stat in requestStats" :key="stat.label" class="hx-stat-card">
              <span class="hx-stat-label">{{ stat.label }}</span>
              <span class="hx-stat-value" :style="stat.tone ? `color: var(--hx-${stat.tone})` : undefined">{{ stat.value }}</span>
            </article>
          </div>
        </div>
      </div>

      <div v-if="sessions.length > 0" class="hx-card udl-section">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Sessions</h2>
            <p class="hx-card-subtitle">{{ sessions.length }} session{{ sessions.length === 1 ? '' : 's' }}</p>
          </div>
        </header>
        <div class="hx-card-body is-flush">
          <div class="hx-table-scroll">
            <table class="hx-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>IP</th>
                  <th>Last used</th>
                  <th>Expires</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="session in sessions" :key="session.id">
                  <td><span class="hx-pill" :data-tone="formatSessionStatus(session).tone">{{ formatSessionStatus(session).label }}</span></td>
                  <td>{{ formatTimestamp(session.issuedAt) }}</td>
                  <td>{{ session.issuedIp ?? 'Unknown' }}</td>
                  <td>{{ session.lastUsedAt ? formatRelativeTime(session.lastUsedAt) : 'Never' }}</td>
                  <td>{{ formatTimestamp(session.expiresAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="hx-card udl-section">
        <header class="hx-card-header">
          <div>
            <h2 class="hx-card-title">Audit trail</h2>
            <p class="hx-card-subtitle">Recent actions by this user</p>
          </div>
        </header>
        <div class="hx-card-body">
          <div v-if="activityEvents.length === 0 && !isLoadingActivity" class="hx-empty">
            <h3 class="hx-empty-title">No audit events</h3>
            <p class="hx-empty-copy">Actions performed by this user will appear here.</p>
          </div>
          <ol v-else class="udl-timeline">
            <li v-for="event in activityEvents" :key="event.id" class="udl-timeline-item">
              <div class="udl-timeline-dot"></div>
              <div class="udl-timeline-content">
                <div class="udl-timeline-header">
                  <span class="hx-pill" :data-tone="formatAuditEventTypeTone(event.eventType)">{{ formatAuditEventType(event.eventType) }}</span>
                  <span class="udl-timestamp">{{ formatRelativeTime(event.occurredAt) }}</span>
                </div>
                <p class="udl-timeline-summary">{{ event.summary }}</p>
              </div>
            </li>
          </ol>
          <button
            v-if="hasMoreActivity"
            type="button"
            class="hx-btn hx-btn--sm udl-load-more"
            data-variant="ghost"
            :disabled="isLoadingActivity"
            @click="handleLoadMoreActivity"
          >{{ isLoadingActivity ? 'Loading\u2026' : 'Load more' }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.udl-title {
  margin-top: var(--hx-space-1);
}

.udl-section {
  margin-top: var(--hx-space-4);
}

.udl-deflist {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--hx-space-1) var(--hx-space-4);
  margin: 0;
}

.udl-deflist dt {
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  white-space: nowrap;
}

.udl-deflist dd {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-strong);
}

.udl-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.udl-timeline-item {
  display: flex;
  gap: var(--hx-space-3);
  padding: var(--hx-space-2) 0;
  position: relative;
}

.udl-timeline-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 22px;
  bottom: -4px;
  width: 1px;
  background: var(--hx-border-subtle);
}

.udl-timeline-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--hx-accent);
  flex-shrink: 0;
  margin-top: 3px;
}

.udl-timeline-content {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.udl-timeline-header {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.udl-timestamp {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-faint);
}

.udl-timeline-summary {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.5;
}

.udl-load-more {
  margin-top: var(--hx-space-3);
  width: 100%;
}
</style>
