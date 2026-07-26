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

const route = useRoute();

const diagnosticLinks = Object.freeze([
  { name: 'activity-operations', label: 'Background jobs' },
  { name: 'activity-diagnostics-matches', label: 'Match diagnostics' },
  { name: 'activity-wanted', label: 'Wanted releases' },
  { name: 'activity-diagnostics-library-adds', label: 'Library-add diagnostics' },
  { name: 'activity-requests', label: 'Request records' },
  { name: 'activity-users', label: 'Source users' },
  { name: 'activity-blocklist', label: 'Source blocklist' },
  { name: 'activity-ignored', label: 'Ignored source users' },
  { name: 'activity-diagnostics-failed-library-adds', label: 'Failed library adds' },
  { name: 'activity-monitored-artists', label: 'Monitored artists' },
  { name: 'activity-history', label: 'System history' },
]);

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

    <details class="activity-diagnostics" :open="!isTimelineRoute">
      <summary>Advanced diagnostics</summary>
      <div class="activity-diagnostics-body">
        <p>Background jobs, match details, and system records for troubleshooting.</p>
        <nav class="activity-diagnostics-links" aria-label="Advanced Activity diagnostics">
          <RouterLink
            v-for="link in diagnosticLinks"
            :key="link.name"
            :to="{ name: link.name }"
            class="hx-btn"
            data-variant="ghost"
          >
            {{ link.label }}
          </RouterLink>
        </nav>
      </div>
    </details>

    <RouterView />
  </section>
</template>

<style scoped>
.activity-workspace {
  display: grid;
  gap: var(--hx-space-4);
}

.activity-diagnostics {
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface);
}

.activity-diagnostics summary {
  padding: var(--hx-space-3) var(--hx-space-4);
  color: var(--hx-text-strong);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 600;
}

.activity-diagnostics-body {
  display: grid;
  gap: var(--hx-space-3);
  padding: 0 var(--hx-space-4) var(--hx-space-4);
}

.activity-diagnostics-body p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.activity-diagnostics-links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hx-space-2);
}

@media (max-width: 640px) {
  .activity-diagnostics-links > * {
    flex: 1 1 calc(50% - var(--hx-space-2));
  }
}
</style>
