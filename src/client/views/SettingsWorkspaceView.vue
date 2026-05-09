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
const tabs = [
  { name: 'settings', label: 'General' },
  { name: 'settings-connections', label: 'Connections' },
  { name: 'settings-library', label: 'Library' },
  { name: 'settings-media-storage', label: 'Media & storage' },
  { name: 'settings-users', label: 'Users & access' },
  { name: 'settings-notifications', label: 'Notifications' },
  { name: 'settings-account', label: 'Account' },
  { name: 'settings-recovery', label: 'Backup & restore' },
  { name: 'settings-library-browser', label: 'Metadata browser' },
];
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Settings</h1>
        <p class="hx-page-subtitle">Configure system behavior, connections, libraries, and access.</p>
      </div>
    </header>

    <nav class="hx-tabbar" aria-label="Settings sections">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="hx-tab"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>
