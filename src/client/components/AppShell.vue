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
import { fetchSystemOperatorNotifications, acknowledgeAllOperatorNotifications } from '../lib/system-api.js';
import { fetchMyRequestSummary } from '../lib/media-request-api.js';
import { useTheme } from '../composables/useTheme.js';
import { buildVisibleNav, notificationTone } from '../lib/app-shell-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import { formatDependencyProviderLabel, formatDependencyStatusLabel, getDependencyStatusClass } from '../lib/settings-connections-presentation.js';
import { resolveMenuFocus } from '../lib/menu-keyboard-navigation.js';
import ToastStack from './ToastStack.vue';
import ConfirmDialogHost from './ConfirmDialogHost.vue';
import PwaUpdateBanner from './PwaUpdateBanner.vue';
import GlobalSearchPalette from './GlobalSearchPalette.vue';

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
const userRole = computed(() => sessionStore.state.user?.role ?? 'operator');
const userInitial = computed(() => {
  const name = sessionStore.state.user?.username ?? '?';
  return name.slice(0, 1).toUpperCase();
});

const { status: healthStatus, label: healthLabel, detail: healthDetail, activeJobs, dependencies, refresh: heartbeatRefresh, attachVisibilityListener: attachHeartbeatVisibility, destroy: destroyHeartbeat } = useShellHeartbeat({ revalidateOnFocus: true });

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

const _actionableCount = computed(() => notificationsPayload.value?.counts?.actionable ?? 0);
const totalNotificationCount = computed(() => notificationsPayload.value?.counts?.total ?? 0);
const unacknowledgedCount = computed(() => notificationsPayload.value?.counts?.unacknowledged ?? 0);
const notifications = computed(() => notificationsPayload.value?.notifications ?? []);

const isAcknowledgingAll = ref(false);

async function handleAcknowledgeAll() {
  if (isAcknowledgingAll.value) return;
  isAcknowledgingAll.value = true;
  try {
    await acknowledgeAllOperatorNotifications();
    await refreshNotifications();
  } finally {
    isAcknowledgingAll.value = false;
  }
}

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

function closeNotificationsPanel() {
  notificationsOpen.value = false;
  const button = notificationsAnchor.value?.querySelector('button');
  if (button) button.focus();
}

function getNotificationMenuItems() {
  return notificationsAnchor.value
    ? Array.from(notificationsAnchor.value.querySelectorAll('button[role="menuitem"]'))
    : [];
}

function handleNotificationPanelKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeNotificationsPanel();
    return;
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = getNotificationMenuItems();
  const target = resolveMenuFocus(items, document.activeElement, event.key);
  if (!target) return;

  event.preventDefault();
  target.focus();
}

function handleBellKeydown(event) {
  if (!notificationsOpen.value) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    notificationsOpen.value = false;
    return;
  }

  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const items = getNotificationMenuItems();
  if (items.length === 0) return;

  event.preventDefault();
  if (event.key === 'ArrowDown') {
    items[0].focus();
  } else {
    items[items.length - 1].focus();
  }
}

async function openNotificationTarget(notification) {
  notificationsOpen.value = false;
  const runId = notification?.run?.id ?? notification?.runId ?? null;
  if (runId) {
    await router.push({ name: 'activity-operations', query: { runId } });
    return;
  }
  await router.push({ name: 'activity-feed' });
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

const healthPanelOpen = ref(false);
const healthPanelAnchor = ref(null);

function toggleHealthPanel() {
  healthPanelOpen.value = !healthPanelOpen.value;
}

function closeHealthPanelOnDocument(event) {
  if (!healthPanelOpen.value) return;
  const anchor = healthPanelAnchor.value;
  if (anchor && event.target instanceof Node && anchor.contains(event.target)) {
    return;
  }
  healthPanelOpen.value = false;
}

onMounted(() => {
  document.addEventListener('click', closeUserMenuOnDocument);
  document.addEventListener('click', closeNotificationsOnDocument);
  document.addEventListener('click', closeHealthPanelOnDocument);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeUserMenuOnDocument);
  document.removeEventListener('click', closeNotificationsOnDocument);
  document.removeEventListener('click', closeHealthPanelOnDocument);
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

const visibleNav = computed(() => buildVisibleNav(userRole.value, requesterNotificationCount.value));

const searchOpen = ref(false);

function openSearch() {
  searchOpen.value = true;
}

function closeSearch() {
  searchOpen.value = false;
}

function handleGlobalKeydown(event) {
  if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
    event.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
  if (event.key === 'Escape' && searchOpen.value) {
    event.preventDefault();
    searchOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleGlobalKeydown);
  attachHeartbeatVisibility();
  void heartbeatRefresh();
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
  destroyHeartbeat();
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
          placeholder="Search artists, albums, songs…"
          aria-label="Global search"
          @focus="openSearch"
          @click="openSearch"
          readonly
        />
        <kbd class="hx-topbar-search-shortcut" aria-hidden="true">Ctrl+K</kbd>
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
        <div class="hx-topbar-health-wrap" ref="healthPanelAnchor">
          <button
            type="button"
            class="hx-topbar-pill"
            :data-status="healthStatus"
            :aria-label="healthDetail"
            :aria-expanded="healthPanelOpen"
            aria-haspopup="menu"
            @click.stop="toggleHealthPanel"
          >
            <span class="hx-topbar-pill-dot" aria-hidden="true"></span>
            {{ healthLabel }}
          </button>

          <div v-if="healthPanelOpen" class="hx-topbar-health-panel" role="menu">
            <div class="hx-topbar-health-header">
              <strong>Provider health</strong>
              <span class="hx-pill" :data-tone="healthStatus === 'healthy' ? 'success' : healthStatus === 'degraded' ? 'warning' : 'danger'">
                {{ healthLabel }}
              </span>
            </div>
            <div v-if="!dependencies.length" class="hx-topbar-health-empty">
              No dependency data available.
            </div>
            <ul v-else class="hx-topbar-health-list" role="none">
              <li v-for="dep in dependencies" :key="dep.provider" class="hx-topbar-health-row" role="none">
                <span class="hx-topbar-health-provider">{{ formatDependencyProviderLabel(dep.provider) }}</span>
                <span class="review-status-pill" :class="getDependencyStatusClass(dep.status)">
                  {{ formatDependencyStatusLabel(dep.status) }}
                </span>
                <span v-if="dep.message" class="hx-topbar-health-message">{{ dep.message }}</span>
              </li>
            </ul>
            <div class="hx-topbar-health-footer">
              <RouterLink :to="{ name: 'settings-connections' }" class="hx-topbar-health-link" @click="healthPanelOpen = false">
                View in Settings
              </RouterLink>
            </div>
          </div>
        </div>

        <RouterLink
          v-if="activeJobs !== null"
          :to="{ name: 'activity-operations' }"
          class="hx-topbar-pill"
          :data-status="activeJobs > 0 ? 'busy' : 'idle'"
          :title="`${activeJobs} active job${activeJobs === 1 ? '' : 's'} — view background jobs`"
        >
          <span class="hx-topbar-pill-dot" aria-hidden="true"></span>
          {{ activeJobs }} {{ activeJobs === 1 ? 'job' : 'jobs' }}
        </RouterLink>
        <div v-if="!isRequester" class="hx-topbar-notifications-wrap" ref="notificationsAnchor">
          <button
            type="button"
            class="hx-topbar-iconbtn"
            :class="{ 'is-alert': unacknowledgedCount > 0 }"
            :aria-expanded="notificationsOpen"
            aria-haspopup="menu"
            :aria-label="`Notifications (${unacknowledgedCount} unread)`"
            @click.stop="toggleNotifications"
            @keydown="handleBellKeydown"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/>
              <path d="M10 21a2 2 0 0 0 4 0"/>
            </svg>
            <span class="hx-topbar-iconbtn-label" aria-hidden="true">Alerts</span>
            <span
              v-if="unacknowledgedCount > 0"
              class="hx-topbar-iconbtn-badge"
              :data-tone="unacknowledgedCount > 0 ? 'danger' : 'info'"
            >{{ unacknowledgedCount }}</span>
          </button>

          <div v-if="notificationsOpen" class="hx-topbar-notifications-panel" @keydown="handleNotificationPanelKeydown">
            <div class="hx-topbar-notifications-header">
              <strong>Notifications</strong>
              <span class="hx-pill" :data-tone="unacknowledgedCount > 0 ? 'warning' : undefined">
                {{ unacknowledgedCount }} unread / {{ totalNotificationCount }} total
              </span>
              <button
                v-if="unacknowledgedCount > 0"
                type="button"
                class="hx-btn hx-btn--sm"
                data-variant="ghost"
                :disabled="isAcknowledgingAll"
                @click="handleAcknowledgeAll"
              >{{ isAcknowledgingAll ? 'Marking\u2026' : 'Mark all read' }}</button>
            </div>
            <div v-if="notificationsLoading && !notifications.length" class="hx-topbar-notifications-empty">
              Loading\u2026
            </div>
            <div v-else-if="!notifications.length" class="hx-topbar-notifications-empty">
              No active notifications.
            </div>
            <ul v-else class="hx-topbar-notifications-list" role="menu">
              <li v-for="notification in notifications" :key="notification.id ?? notification.eventId ?? notification.title" role="none">
                <button
                  type="button"
                  class="hx-topbar-notifications-item"
                  :class="{ 'is-acknowledged': notification.isAcknowledged }"
                  role="menuitem"
                  @click="openNotificationTarget(notification)"
                >
                  <span class="hx-pill" :data-tone="notificationTone(notification.category)">{{ notification.category }}</span>
                  <span class="hx-topbar-notifications-item-title">{{ notification.title ?? notification.message ?? '\u2014' }}</span>
                  <span v-if="notification.occurredAt" class="hx-topbar-notifications-item-time">{{ formatOperationTimestampShort(notification.occurredAt) }}</span>
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
            <span>{{ sessionStore.state.user?.username }}</span>
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
          :title="item.label"
          :active-class="item.exact ? '' : 'router-link-active'"
          :exact-active-class="item.exact ? 'router-link-active' : 'router-link-exact-active'"
        >
          <span class="hx-sidebar-link-icon" aria-hidden="true">
            <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
            <svg v-else-if="item.icon === 'discover'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/></svg>
            <svg v-else-if="item.icon === 'missing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
            <svg v-else-if="item.icon === 'download'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
            <svg v-else-if="item.icon === 'library'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="5" rx="1.5"/><rect x="5" y="10" width="14" height="5" rx="1.5"/><rect x="3" y="16" width="18" height="5" rx="1.5"/></svg>
            <svg v-else-if="item.icon === 'music'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>
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
          <RouterLink
            :to="{ name: item.name }"
            class="hx-bottom-nav-item"
            :aria-label="item.badge ? `${item.label} (${item.badge} notifications)` : item.label"
            :active-class="item.exact ? '' : 'router-link-active'"
            :exact-active-class="item.exact ? 'router-link-active' : 'router-link-exact-active'"
          >
            <span class="hx-bottom-nav-item-icon" aria-hidden="true">
              <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
              <svg v-else-if="item.icon === 'discover'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M11 8v6M8 11h6"/></svg>
              <svg v-else-if="item.icon === 'missing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>
              <svg v-else-if="item.icon === 'download'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v10"/><path d="m8 9 4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
              <svg v-else-if="item.icon === 'library'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="4" width="10" height="5" rx="1.5"/><rect x="5" y="10" width="14" height="5" rx="1.5"/><rect x="3" y="16" width="18" height="5" rx="1.5"/></svg>
              <svg v-else-if="item.icon === 'music'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>
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
    <ConfirmDialogHost />
    <PwaUpdateBanner />
    <GlobalSearchPalette :open="searchOpen" @close="closeSearch" />
  </div>
</template>

<style scoped>
.hx-topbar-health-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.hx-topbar-health-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: var(--hx-color-surface, #161821);
  border: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  z-index: 50;
  overflow: hidden;
}
.hx-topbar-health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.08));
}
.hx-topbar-health-empty {
  padding: 24px 14px;
  text-align: center;
  color: var(--hx-color-muted, rgba(255, 255, 255, 0.55));
  font-size: 13px;
}
.hx-topbar-health-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.hx-topbar-health-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.04));
  font-size: 13px;
}
.hx-topbar-health-provider {
  font-weight: 600;
  min-width: 120px;
}
.hx-topbar-health-message {
  color: var(--hx-color-muted, rgba(255, 255, 255, 0.55));
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hx-topbar-health-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--hx-color-border, rgba(255, 255, 255, 0.08));
}
.hx-topbar-health-link {
  color: var(--hx-accent, #5eadff);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
}
.hx-topbar-health-link:hover {
  text-decoration: underline;
}
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
  gap: 7px;
  min-width: 42px;
  height: 34px;
  padding: 0 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: inherit;
  cursor: pointer;
}
.hx-topbar-iconbtn:hover,
.hx-topbar-iconbtn:focus-visible {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.24);
}
.hx-topbar-iconbtn.is-alert {
  background: rgba(194, 65, 12, 0.22);
  border-color: rgba(251, 146, 60, 0.58);
  color: #fff7ed;
  box-shadow: 0 0 0 1px rgba(194, 65, 12, 0.25) inset;
}
.hx-topbar-iconbtn svg {
  width: 17px;
  height: 17px;
}
.hx-topbar-iconbtn-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1;
}
.hx-topbar-iconbtn-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--hx-color-danger, #c2410c);
  color: white;
  border: 2px solid var(--hx-color-surface, #161821);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
@media (max-width: 920px) {
  .hx-topbar-iconbtn {
    width: 34px;
    min-width: 34px;
    padding: 0;
    gap: 0;
  }
  .hx-topbar-iconbtn-label {
    display: none;
  }
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
.hx-topbar-notifications-item.is-acknowledged {
  opacity: 0.5;
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
