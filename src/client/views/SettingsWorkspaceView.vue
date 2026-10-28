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
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useTabbarOverflow } from '../composables/useTabbarOverflow.js';
import { buildSettingsNavigation } from '../lib/settings-navigation.js';
import { createUserCommandFocusTracker } from '../lib/user-command-focus.js';
import { sessionStore } from '../state/session.js';
import SettingsProviderCallbackFeedback from '../components/settings/SettingsProviderCallbackFeedback.vue';

const navigation = computed(() => buildSettingsNavigation(sessionStore.state.user?.role));
const primaryTabs = computed(() => navigation.value.primary);
const secondaryTabs = computed(() => navigation.value.secondary);
const description = computed(() => sessionStore.state.user?.role === 'admin'
  ? 'Set up downloads and your library first. Specialized controls remain available when you need them.'
  : 'Manage your sign-in, account safety and personal notification preferences.');

const route = useRoute();
const tabbarRef = ref(null);
const moreButtonRef = ref(null);
const isMoreSettingsOpen = ref(false);
const { hasOverflowStart, hasOverflowEnd, attach, cleanup } = useTabbarOverflow();

watch(navigation, async () => {
  const document = tabbarRef.value?.ownerDocument;
  const initiator = document?.activeElement;
  if (initiator?.tagName !== 'A' || !tabbarRef.value?.contains(initiator)) return;

  const focus = createUserCommandFocusTracker({ document });
  try {
    await nextTick();
    if (!initiator.isConnected && focus.ownsFocus()) moreButtonRef.value?.focus();
  } finally {
    focus.dispose();
  }
});

watch(
  () => route.name,
  (routeName) => {
    if (secondaryTabs.value.some((tab) => tab.name === routeName)) {
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
        <p class="hx-page-subtitle">{{ description }}</p>
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
          ref="moreButtonRef"
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

    <SettingsProviderCallbackFeedback :can-check="sessionStore.state.user?.role === 'admin'" />
    <RouterView />
  </section>
</template>

<style scoped>
.hx-tab:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: -2px;
}

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
