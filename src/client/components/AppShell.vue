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
      <div>
        <p class="eyebrow">Harmoniarr</p>
        <h1 class="shell-title">{{ isRequester ? 'Request Desk' : 'Control Plane' }}</h1>
        <p class="shell-copy">{{ isRequester ? 'Request music, submit provider URLs, and track what is already in the library.' : 'Bootstrap, auth, settings, and startup diagnostics.' }}</p>
      </div>

      <nav class="nav-list">
        <RouterLink v-if="!isRequester" :to="{ name: 'dashboard' }" class="nav-link">Dashboard</RouterLink>
        <RouterLink :to="{ name: 'request-music' }" class="nav-link">Request Music</RouterLink>
        <RouterLink v-if="!isRequester" :to="{ name: 'jobs' }" class="nav-link">Jobs</RouterLink>
        <RouterLink :to="{ name: 'account-security' }" class="nav-link">Account Security</RouterLink>
        <RouterLink v-if="!isRequester" :to="{ name: 'metadata' }" class="nav-link">Metadata</RouterLink>
        <RouterLink v-if="!isRequester" :to="{ name: 'recovery-workspace' }" class="nav-link">Recovery</RouterLink>
        <RouterLink v-if="!isRequester" :to="{ name: 'review-queue' }" class="nav-link">Review Queue</RouterLink>
        <RouterLink v-if="!isRequester" :to="{ name: 'settings' }" class="nav-link">Settings</RouterLink>
      </nav>

      <div class="session-card">
        <p class="eyebrow">Signed in as</p>
        <strong>{{ sessionStore.state.user?.username }}</strong>
        <span>{{ sessionStore.state.user?.role }}</span>
        <p class="warning-copy" v-if="sessionStore.state.user?.mustChangePassword">Password change required before fresh-admin actions can continue.</p>
        <button type="button" class="secondary-button" @click="logout">Logout</button>
      </div>
    </aside>

    <main class="content-column">
      <RouterView />
    </main>
  </div>
</template>
