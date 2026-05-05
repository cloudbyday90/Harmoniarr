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
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { sessionStore } from '../state/session.js';

const router = useRouter();
const isRequester = computed(() => sessionStore.state.user?.role === 'requester');

async function logout() {
  await sessionStore.logout();
  await router.push({ name: 'login' });
}
</script>

<template>
  <div class="shell-layout">
    <aside class="sidebar panel-dark">
      <div class="sidebar-brand">
        <img src="../assets/harmoniarr-icon.svg" width="32" height="32" alt="" aria-hidden="true" class="sidebar-logo" />
        <span class="sidebar-wordmark">Harmoniarr</span>
      </div>

      <nav class="nav-list" aria-label="Main navigation">
        <template v-if="!isRequester">
          <RouterLink :to="{ name: 'dashboard' }" class="nav-link">Dashboard</RouterLink>
          <RouterLink :to="{ name: 'metadata' }" class="nav-link">Library</RouterLink>

          <div class="nav-group">
            <span class="nav-group-label">Activity</span>
            <RouterLink :to="{ name: 'review-queue' }" class="nav-link nav-sub-link">Candidates</RouterLink>
            <RouterLink :to="{ name: 'jobs' }" class="nav-link nav-sub-link">Operations</RouterLink>
            <RouterLink :to="{ name: 'request-music' }" class="nav-link nav-sub-link">Requests</RouterLink>
          </div>

          <div class="nav-group">
            <span class="nav-group-label">Settings</span>
            <RouterLink :to="{ name: 'settings' }" class="nav-link nav-sub-link">Configuration</RouterLink>
            <RouterLink :to="{ name: 'account-security' }" class="nav-link nav-sub-link">Account</RouterLink>
            <RouterLink :to="{ name: 'recovery-workspace' }" class="nav-link nav-sub-link">Backup &amp; Restore</RouterLink>
          </div>
        </template>

        <template v-else>
          <RouterLink :to="{ name: 'request-music' }" class="nav-link">My Requests</RouterLink>
          <RouterLink :to="{ name: 'account-security' }" class="nav-link">Account</RouterLink>
        </template>
      </nav>

      <div class="session-card">
        <p class="eyebrow">Signed in as</p>
        <strong class="session-username">{{ sessionStore.state.user?.username }}</strong>
        <span class="session-role">{{ sessionStore.state.user?.role }}</span>
        <p class="warning-copy" v-if="sessionStore.state.user?.mustChangePassword">Password change required.</p>
        <button type="button" class="secondary-button" @click="logout">Log out</button>
      </div>
    </aside>

    <main class="content-column">
      <RouterView />
    </main>
  </div>
</template>
