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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useTabbarOverflow } from '../composables/useTabbarOverflow.js';
import { buildAcquisitionWorkspaceSections } from '../lib/acquisition-workspace-presentation.js';
import { sessionStore } from '../state/session.js';

const tabbarRef = ref(null);
const route = useRoute();
const canViewDownloader = computed(() => sessionStore.state.user?.role === 'admin');
const sections = computed(() => buildAcquisitionWorkspaceSections(canViewDownloader.value));
const { hasOverflowStart, hasOverflowEnd, attach, cleanup } = useTabbarOverflow();

function isCurrentSection(section) {
  if (section.name === 'acquisition-music-queue') {
    return route.name === 'acquisition-music-queue'
      || route.name === 'acquisition-music-queue-release';
  }

  return route.name === section.name;
}

onMounted(() => attach(tabbarRef.value));
onUnmounted(cleanup);
</script>

<template>
  <div class="acquisition-workspace">
    <div
      class="hx-tabbar-wrap"
      :class="{ 'has-overflow-start': hasOverflowStart, 'has-overflow-end': hasOverflowEnd }"
    >
      <nav ref="tabbarRef" class="hx-tabbar" aria-label="Acquisition sections">
        <RouterLink
          v-for="section in sections"
          :key="section.name"
          :to="{ name: section.name }"
          class="hx-tab"
          :class="{ 'is-active': isCurrentSection(section) }"
        >
          {{ section.label }}
        </RouterLink>
      </nav>
    </div>

    <RouterView />
  </div>
</template>

<style scoped>
.acquisition-workspace {
  display: grid;
  gap: var(--hx-space-5);
}
</style>
