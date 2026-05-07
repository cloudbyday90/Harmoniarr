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
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import harmoniarrIcon from '../assets/harmoniarr-icon.svg';
import { sessionStore } from '../state/session.js';
import { useShellHeartbeat } from '../composables/useShellHeartbeat.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';
import { fetchSystemOperatorNotifications } from '../lib/system-api.js';
import { fetchMyRequestSummary } from '../lib/media-request-api.js';
import { useTheme } from '../composables/useTheme.js';
import ToastStack from './ToastStack.vue';

const router = useRouter();
const route = useRoute();

// ── Mobile sidebar drawer ─────────────────────────────────────────────────────

const sidebarOpen = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}

function closeSidebar() {
  sidebarOpen.value = false;
}

// Close the drawer automatically when the user navigates to a new route.
watch(() => route.path, () => { sidebarOpen.value = false; });

// Theme — applied immediately (composable calls applyToDocument in constructor)
// and kept reactive. Provided as injection so child views can read/set preference.
const { preference: themePref, resolvedTheme, setPreference: setTheme } = useTheme();
provide('theme', { preference: themePref, resolvedTheme, setTheme });
watch(resolvedTheme, (t) => {
  document.documentElement.setAttribute('data-theme', t);
});

const isRequester = computed(() => sessionStore.state.user?.role === 'requester');
const userInitial = computed(() => {
  const name = sessionStore.state.user?.username ?? '?';
  return name.slice(0, 1).toUpperCase();
});

const { status: healthStatus, label: healthLabel, detail: healthDetail, activeJobs } = useShellHeartbeat();

const {
  data: notificationsPayload,
  isLoading: notificationsLoading,
  load: refreshNotifications,
} = useAsyncResource({
  fetcher: () => fetchSystemOperatorNotifications({ limit: 25 }),
  project: (payload) => ({
    notifications: Array.isArray(payload?.notifications) ? payload.notifications : [],
    counts: payload?.counts ?? { actionable: 0, total: 0 },
  }),
  initialData: { notifications: [], counts: { actionable: 0, total: 0 } },
  immediate: !isRequester.value,
  pollIntervalMs: isRequester.value ? null : 60000,
  fallbackErrorMessage: 'Failed to load notifications',
});

const actionableCount = computed(() => notificationsPayload.value?.counts?.actionable ?? 0);
const totalNotificationCount = computed(() => notificationsPayload.value?.counts?.total ?? 0);
const notifications = computed(() => notificationsPayload.value?.notifications ?? []);

// ── Requester: notification count for "My Requests" nav badge ────────────────────

const {
  data: requesterNotificationsPayload,
} = useAsyncResource({
  fetcher: fetchMyRequestSummary,
  project: (payload) => ({
    total: payload?.notificationFeed?.counts?.total ?? 0,
  }),
  initialData: { total: 0 },
  immediate: isRequester.value,
  pollIntervalMs: isRequester.value ? 60000 : null,
  fallbackErrorMessage: 'Failed to load request notifications',
});

const requesterNotificationCount = computed(() => requesterNotificationsPayload.value?.total ?? 0);

const notificationsOpen = ref(false);
const notificationsAnchor = ref(null);
function toggleNotifications() {
  notificationsOpen.value = !notificationsOpen.value;
  if (notificationsOpen.value) refreshNotifications();
}
function closeNotificationsOnDocument(event) {
  if (!notificationsOpen.value) return;
  const anchor = notificationsAnchor.value;
  if (anchor && event.target instanceof Node && anchor.contains(event.target)) return;
  notificationsOpen.value = false;
}

function notificationTone(category) {
  if (category === 'failure') return 'danger';
  if (category === 'manual_intervention') return 'warning';
  if (category === 'recovery') return 'info';
  return 'info';
}

async function openNotificationTarget(notification) {
  notificationsOpen.value = false;
  const runId = notification?.run?.id ?? notification?.runId ?? null;
  if (runId) {
    await router.push({ name: 'activity-queue', query: { run: runId } });
    return;
  }
  await router.push({ name: 'activity-history' });
}

const userMenuOpen = ref(false);
const userMenuAnchor = ref(null);

function toggleUserMenu() {
  userMenuOpen.value = !userMenuOpen.value;
}

function closeUserMenuOnDocument(event) {
  if (!userMenuOpen.value) return;
  const anchor = userMenuAnchor.value;
  if (anchor && event.target instanceof Node && anchor.contains(event.target)) {
    return;
  }
  userMenuOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeUserMenuOnDocument);
  document.addEventListener('click', closeNotificationsOnDocument);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeUserMenuOnDocument);
  document.removeEventListener('click', closeNotificationsOnDocument);
});

async function logout() {
  userMenuOpen.value = false;
  await sessionStore.logout();
  await router.push({ name: 'login' });
}

async function openAccount() {
  userMenuOpen.value = false;
  await router.push({ name: 'account-security' });
}

const operatorNav = [
  { name: 'dashboard', label: 'Home', icon: 'dashboard' },
  { name: 'discover', label: 'Discover', icon: 'discover' },
  { name: 'library', label: 'Library', icon: 'library' },
  { name: 'missing', label: 'Missing', icon: 'missing' },
  { name: 'activity', label: 'Activity', icon: 'activity' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

const requesterNav = [
  { name: 'dashboard', label: 'Home', icon: 'dashboard' },
  { name: 'discover', label: 'Discover', icon: 'discover' },
  { name: 'library', label: 'Library', icon: 'library' },
  { name: 'search', label: 'Search', icon: 'search' },
  { name: 'my-requests', label: 'My Requests', icon: 'requests' },
];

const visibleNav = computed(() => {
  const base = isRequester.value ? requesterNav : operatorNav;
  if (!isRequester.value) return base;
  const count = requesterNotificationCount.value;
  if (count <= 0) return base;
  return base.map((item) => (item.name === 'my-requests' ? { ...item, badge: count } : item));
});
</script>

<template>
  <div class="hx-app">
    <header class="hx-topbar" role="banner">
      <div class="hx-topbar-brand">
        <img :src="harmoniarrIcon" alt="" aria-hidden="true" />
        <span class="hx-topbar-brand-name">Harmoniarr</span>
      </div>

      <div class="hx-topbar-search" role="search">
        <input
          class="hx-topbar-search-input"
          type="search"
          placeholder="Search artists, albums, songs, users…"
          aria-label="Global search"
          disabled
        />
      </div>

      <div class="hx-topbar-actions">
        <!-- Hamburger: hidden on desktop via CSS, visible at ≤640px -->
        <button
          type="button"
          class="hx-topbar-hamburger"
          :aria-label="sidebarOpen ? 'Close menu' : 'Open menu'"
          :aria-expanded="sidebarOpen"
          @click="toggleSidebar"
        >
          <svg v-if="!sidebarOpen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M3 6h18M3 12h18M3 18h18"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <span
          class="hx-topbar-pill"
          :data-status="healthStatus"
          :title="healthDetail"
          aria-live="polite"
        >
          <span class="hx-topbar-pill-dot" aria-hidden="true"></span>
          {{ healthLabel }}
        </span>

        <RouterLink
          v-if="activeJobs !== null"
          :to="{ name: 'activity-queue' }"
          class="hx-topbar-pill"
          :data-status="activeJobs > 0 ? 'busy' : 'idle'"
          :title="`${activeJobs} active job${activeJobs === 1 ? '' : 's'} — open queue`"
        >
          <span class="hx-topbar-pill-dot" aria-hidden="true"></span>
          {{ activeJobs }} {{ activeJobs === 1 ? 'job' : 'jobs' }}
        </RouterLink>
        <div v-if="!isRequester" class="hx-topbar-notifications-wrap" ref="notificationsAnchor">
          <button
            type="button"
            class="hx-topbar-iconbtn"
            :aria-expanded="notificationsOpen"
            aria-haspopup="menu"
            :aria-label="`Notifications (${actionableCount} actionable)`"
            @click.stop="toggleNotifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/>
              <path d="M10 21a2 2 0 0 0 4 0"/>
            </svg>
            <span
              v-if="actionableCount > 0"
              class="hx-topbar-iconbtn-badge"
              :data-tone="actionableCount > 0 ? 'danger' : 'info'"
            >{{ actionableCount }}</span>
          </button>

          <div v-if="notificationsOpen" class="hx-topbar-notifications-panel" role="menu">
            <div class="hx-topbar-notifications-header">
              <strong>Notifications</strong>
              <span class="hx-pill" :data-tone="actionableCount > 0 ? 'warning' : undefined">
                {{ actionableCount }} actionable / {{ totalNotificationCount }} total
              </span>
            </div>
            <div v-if="notificationsLoading && !notifications.length" class="hx-topbar-notifications-empty">
              Loading\u2026
            </div>
            <div v-else-if="!notifications.length" class="hx-topbar-notifications-empty">
              No active notifications.
            </div>
            <ul v-else class="hx-topbar-notifications-list" role="none">
              <li v-for="notification in notifications" :key="notification.id ?? notification.eventId ?? notification.title">
                <button
                  type="button"
                  class="hx-topbar-notifications-item"
                  role="menuitem"
                  @click="openNotificationTarget(notification)"
                >
                  <span class="hx-pill" :data-tone="notificationTone(notification.category)">{{ notification.category }}</span>
                  <span class="hx-topbar-notifications-item-title">{{ notification.title ?? notification.message ?? '\u2014' }}</span>
                  <span v-if="notification.occurredAt" class="hx-topbar-notifications-item-time">{{ notification.occurredAt }}</span>
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div class="hx-topbar-user-wrap" ref="userMenuAnchor">
          <button
            type="button"
            class="hx-topbar-user"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            @click.stop="toggleUserMenu"
          >
            <span class="hx-topbar-user-avatar" aria-hidden="true">{{ userInitial }}</span>
            <span class="session-username">{{ sessionStore.state.user?.username }}</span>
          </button>

          <div v-if="userMenuOpen" class="hx-topbar-user-menu" role="menu">
            <div class="hx-topbar-user-menu-header">
              <div class="hx-topbar-user-menu-name">{{ sessionStore.state.user?.username }}</div>
              <div class="hx-topbar-user-menu-role">{{ sessionStore.state.user?.role }}</div>
            </div>
            <button
              type="button"
              class="hx-topbar-user-menu-item"
              role="menuitem"
              @click="openAccount"
            >
              Account
            </button>
            <button
              type="button"
              class="hx-topbar-user-menu-item is-danger"
              role="menuitem"
              @click="logout"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    </header>

    <aside class="hx-sidebar" :class="{ 'is-open': sidebarOpen }" aria-label="Primary">
      <nav class="hx-sidebar-nav">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.name"
          :to="{ name: item.name }"
          class="hx-sidebar-link"
        >
          <span class="hx-sidebar-link-icon" aria-hidden="true">
            <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
            <svg v-else-if="item.icon === 'discover'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/></svg>
            <svg v-else-if="item.icon === 'missing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r="0.8" fill="currentColor"/></svg>
            <svg v-else-if="item.icon === 'library'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="5" rx="1.5"/><rect x="5" y="10" width="14" height="5" rx="1.5"/><rect x="3" y="16" width="18" height="5" rx="1.5"/></svg>
            <svg v-else-if="item.icon === 'activity'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>
            <svg v-else-if="item.icon === 'search'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
            <svg v-else-if="item.icon === 'requests'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3z"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          </span>
          <span class="hx-sidebar-link-label">{{ item.label }}</span>
          <span v-if="item.badge" class="hx-sidebar-link-badge" aria-label="`${item.badge} notification${item.badge === 1 ? '' : 's'}`">{{ item.badge }}</span>
        </RouterLink>
      </nav>

      <div class="hx-sidebar-footer">
        <span>{{ sessionStore.state.user?.username }}</span>
        <span style="text-transform: capitalize;">{{ sessionStore.state.user?.role }}</span>
      </div>
    </aside>

    <main class="hx-main" id="main-content">
      <RouterView />
    </main>

    <!-- Mobile: backdrop behind the sidebar drawer (v-show + CSS media query) -->
    <button
      v-show="sidebarOpen"
      class="hx-sidebar-backdrop"
      aria-hidden="true"
      tabindex="-1"
      @click="closeSidebar"
    />

    <!-- Mobile: bottom tab bar (hidden on desktop via CSS) -->
    <nav class="hx-bottom-nav" aria-label="Mobile navigation">
      <ul class="hx-bottom-nav-list" role="list">
        <li v-for="item in visibleNav" :key="item.name">
          <RouterLink :to="{ name: item.name }" class="hx-bottom-nav-item" :aria-label="item.badge ? `${item.label} (${item.badge} notifications)` : item.label">
            <span class="hx-bottom-nav-item-icon" aria-hidden="true">
              <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
              <svg v-else-if="item.icon === 'discover'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/></svg>
              <svg v-else-if="item.icon === 'missing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r="0.8" fill="currentColor"/></svg>
              <svg v-else-if="item.icon === 'library'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="5" rx="1.5"/><rect x="5" y="10" width="14" height="5" rx="1.5"/><rect x="3" y="16" width="18" height="5" rx="1.5"/></svg>
              <svg v-else-if="item.icon === 'activity'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>
              <svg v-else-if="item.icon === 'search'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
              <svg v-else-if="item.icon === 'requests'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3z"/></svg>
              <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
            </span>
            <span class="hx-bottom-nav-item-label">{{ item.label }}</span>
            <span v-if="item.badge" class="hx-bottom-nav-badge" aria-hidden="true">{{ item.badge }}</span>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <ToastStack />
  </div>
</template>

<style scoped>
.hx-topbar-user-wrap {
  position: relative;
}
.hx-topbar-notifications-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.hx-topbar-iconbtn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: inherit;
  cursor: pointer;
}
.hx-topbar-iconbtn:hover,
.hx-topbar-iconbtn:focus-visible {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
}
.hx-topbar-iconbtn svg {
  width: 18px;
  height: 18px;
}
.hx-topbar-iconbtn-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--hx-color-danger, #c2410c);
  color: white;
  font-size: 10px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.hx-topbar-notifications-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 360px;
  max-height: 480px;
  overflow: auto;
  background: var(--hx-color-surface, #161821);
  border: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  z-index: 50;
}
.hx-topbar-notifications-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.08));
}
.hx-topbar-notifications-empty {
  padding: 24px 14px;
  text-align: center;
  color: var(--hx-color-muted, rgba(255, 255, 255, 0.55));
  font-size: 13px;
}
.hx-topbar-notifications-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.hx-topbar-notifications-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.04));
  text-align: left;
  color: inherit;
  cursor: pointer;
  font-size: 13px;
}
.hx-topbar-notifications-item:hover,
.hx-topbar-notifications-item:focus-visible {
  background: rgba(255, 255, 255, 0.04);
}
.hx-topbar-notifications-item-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hx-topbar-notifications-item-time {
  font-size: 11px;
  color: var(--hx-color-muted, rgba(255, 255, 255, 0.45));
  white-space: nowrap;
}
.hx-sidebar-link-badge {
  margin-left: auto;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--hx-color-accent, #7c6df0);
  color: white;
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
</style>
