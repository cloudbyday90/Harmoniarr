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
import { useRouter } from 'vue-router';
import { sessionStore } from '../state/session.js';

const router = useRouter();

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
        <h1 class="shell-title">Control Plane</h1>
        <p class="shell-copy">Bootstrap, auth, settings, and startup diagnostics.</p>
      </div>

      <nav class="nav-list">
        <RouterLink :to="{ name: 'dashboard' }" class="nav-link">Dashboard</RouterLink>
        <RouterLink :to="{ name: 'metadata' }" class="nav-link">Metadata</RouterLink>
        <RouterLink :to="{ name: 'review-queue' }" class="nav-link">Review Queue</RouterLink>
        <RouterLink :to="{ name: 'settings' }" class="nav-link">Settings</RouterLink>
      </nav>

      <div class="session-card">
        <p class="eyebrow">Signed in as</p>
        <strong>{{ sessionStore.state.user?.username }}</strong>
        <span>{{ sessionStore.state.user?.role }}</span>
        <button type="button" class="secondary-button" @click="logout">Logout</button>
      </div>
    </aside>

    <main class="content-column">
      <RouterView />
    </main>
  </div>
</template>
