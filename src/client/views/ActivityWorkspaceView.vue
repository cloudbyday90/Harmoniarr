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
import { ref, onMounted, onUnmounted } from 'vue';
import { useTabbarOverflow } from '../composables/useTabbarOverflow.js';

const tabs = [
  { name: 'activity-operations', label: 'Operations', implemented: true },
  { name: 'activity-candidates', label: 'Candidates', implemented: true },
  { name: 'activity-requests', label: 'Requests', implemented: true },
  { name: 'activity-queue', label: 'Queue', implemented: false },
  { name: 'activity-wanted', label: 'Wanted', implemented: false },
  { name: 'activity-downloads', label: 'Downloads', implemented: false },
  { name: 'activity-imports', label: 'Imports', implemented: false },
  { name: 'activity-releases', label: 'Releases', implemented: false },
  { name: 'activity-users', label: 'Users', implemented: false },
  { name: 'activity-history', label: 'History', implemented: false },
  { name: 'activity-blocklist', label: 'Blocklist', implemented: false },
  { name: 'activity-failed', label: 'Failed', implemented: false },
];

const tabbarRef = ref(null);
const { hasOverflowStart, hasOverflowEnd, attach, cleanup } = useTabbarOverflow();
onMounted(() => attach(tabbarRef.value));
onUnmounted(cleanup);
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Activity</h1>
        <p class="hx-page-subtitle">Operational workbench: queues, history, downloads, imports, source users.</p>
      </div>
    </header>

    <div
      class="hx-tabbar-wrap"
      :class="{ 'has-overflow-start': hasOverflowStart, 'has-overflow-end': hasOverflowEnd }"
    >
      <nav class="hx-tabbar" ref="tabbarRef" aria-label="Activity sections">
        <RouterLink
          v-for="tab in tabs"
          :key="tab.name"
          :to="{ name: tab.name }"
          class="hx-tab"
        >
          {{ tab.label }}
          <span v-if="!tab.implemented" class="hx-tab-count" title="Coming soon">soon</span>
        </RouterLink>
      </nav>
    </div>

    <RouterView />
  </section>
</template>
