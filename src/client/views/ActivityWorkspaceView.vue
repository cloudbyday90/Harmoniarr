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
import { useRoute } from 'vue-router';
import ActivityDiagnosticsDisclosure from '../components/activity/ActivityDiagnosticsDisclosure.vue';

const route = useRoute();

const isTimelineRoute = computed(() => route.name === 'activity-feed');
</script>

<template>
  <section class="hx-page activity-workspace">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Activity</h1>
        <p class="hx-page-subtitle">What Harmoniarr has done, and anything that needs your attention.</p>
      </div>
    </header>

    <ActivityDiagnosticsDisclosure v-if="!isTimelineRoute" :open="true" />

    <div class="activity-workspace-content">
      <RouterView />
    </div>

    <ActivityDiagnosticsDisclosure v-if="isTimelineRoute" />
  </section>
</template>

<style scoped>
.activity-workspace {
  display: grid;
  gap: var(--hx-space-4);
}

.activity-workspace-content {
  min-width: 0;
}
</style>
