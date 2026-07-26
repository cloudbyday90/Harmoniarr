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
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTabbarOverflow } from '../composables/useTabbarOverflow.js';

const primaryTabs = [
  { name: 'settings', label: 'Setup' },
  { name: 'settings-connections', label: 'Connections' },
  { name: 'settings-media-storage', label: 'Media & storage' },
  { name: 'settings-notifications', label: 'Notifications' },
  { name: 'settings-library', label: 'Library' },
];

const secondaryTabs = [
  { name: 'settings-general', label: 'System & security' },
  { name: 'settings-users', label: 'Users & access' },
  { name: 'settings-account', label: 'Account' },
  { name: 'settings-recovery', label: 'Backup & restore' },
  { name: 'settings-library-browser', label: 'Metadata browser' },
];

const route = useRoute();
const tabbarRef = ref(null);
const isMoreSettingsOpen = ref(false);
const { hasOverflowStart, hasOverflowEnd, attach, cleanup } = useTabbarOverflow();

watch(
  () => route.name,
  (routeName) => {
    if (secondaryTabs.some((tab) => tab.name === routeName)) {
      isMoreSettingsOpen.value = true;
    }
  },
  { immediate: true },
);

onMounted(() => attach(tabbarRef.value));
onUnmounted(cleanup);
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Settings</h1>
        <p class="hx-page-subtitle">Set up downloads and your library first. Specialized controls remain available when you need them.</p>
      </div>
    </header>

    <div
      class="hx-tabbar-wrap"
      :class="{ 'has-overflow-start': hasOverflowStart, 'has-overflow-end': hasOverflowEnd }"
    >
      <nav class="hx-tabbar" ref="tabbarRef" aria-label="Settings sections">
        <RouterLink
          v-for="tab in primaryTabs"
          :key="tab.name"
          :to="{ name: tab.name }"
          class="hx-tab"
        >
          {{ tab.label }}
        </RouterLink>
        <button
          type="button"
          class="hx-tab settings-workspace__more-button"
          aria-controls="settings-more-navigation"
          :aria-expanded="isMoreSettingsOpen"
          @click="isMoreSettingsOpen = !isMoreSettingsOpen"
        >
          {{ isMoreSettingsOpen ? 'Hide more settings' : 'More settings' }}
        </button>
      </nav>
    </div>

    <nav
      v-show="isMoreSettingsOpen"
      id="settings-more-navigation"
      class="settings-workspace__secondary-nav"
      aria-label="More settings sections"
    >
      <RouterLink
        v-for="tab in secondaryTabs"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="hx-btn"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <RouterView />
  </section>
</template>

<style scoped>
.settings-workspace__more-button {
  appearance: none;
  background: transparent;
  border: 0;
  cursor: pointer;
  font: inherit;
}

.settings-workspace__secondary-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
  margin: 0 0 var(--hx-space-4);
}

.settings-workspace__secondary-nav .router-link-active {
  background: var(--hx-accent-soft);
  border-color: var(--hx-accent);
  color: var(--hx-accent-strong);
}
</style>
