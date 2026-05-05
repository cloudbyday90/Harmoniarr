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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import harmoniarrIcon from '../assets/harmoniarr-icon.svg';
import { sessionStore } from '../state/session.js';
import { useShellHeartbeat } from '../composables/useShellHeartbeat.js';

const router = useRouter();
const isRequester = computed(() => sessionStore.state.user?.role === 'requester');
const userInitial = computed(() => {
  const name = sessionStore.state.user?.username ?? '?';
  return name.slice(0, 1).toUpperCase();
});

const { status: healthStatus, label: healthLabel, detail: healthDetail, activeJobs } = useShellHeartbeat();

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
});

onBeforeUnmount(() => {
  document.removeEventListener('click', closeUserMenuOnDocument);
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
  { name: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { name: 'missing', label: 'Missing', icon: 'missing' },
  { name: 'activity', label: 'Activity', icon: 'activity' },
  { name: 'search', label: 'Search', icon: 'search' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
];

const requesterNav = [
  { name: 'request-music', label: 'My Requests', icon: 'requests' },
  { name: 'account-security', label: 'Account', icon: 'user' },
];

const visibleNav = computed(() => (isRequester.value ? requesterNav : operatorNav));
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

    <aside class="hx-sidebar" aria-label="Primary">
      <nav class="hx-sidebar-nav">
        <RouterLink
          v-for="item in visibleNav"
          :key="item.name"
          :to="{ name: item.name }"
          class="hx-sidebar-link"
        >
          <span class="hx-sidebar-link-icon" aria-hidden="true">
            <svg v-if="item.icon === 'dashboard'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>
            <svg v-else-if="item.icon === 'missing'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><circle cx="12" cy="16.5" r="0.8" fill="currentColor"/></svg>
            <svg v-else-if="item.icon === 'activity'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6"/></svg>
            <svg v-else-if="item.icon === 'search'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
            <svg v-else-if="item.icon === 'settings'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
            <svg v-else-if="item.icon === 'requests'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3z"/></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
          </span>
          <span class="hx-sidebar-link-label">{{ item.label }}</span>
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
  </div>
</template>

<style scoped>
.hx-topbar-user-wrap {
  position: relative;
}
</style>
