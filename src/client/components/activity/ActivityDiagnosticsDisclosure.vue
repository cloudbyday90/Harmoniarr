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
import { ACTIVITY_DIAGNOSTIC_GROUPS } from '../../lib/activity-diagnostic-navigation.js';

defineProps({
  open: {
    default: false,
    type: Boolean,
  },
});
</script>

<template>
  <details class="activity-diagnostics" :open="open">
    <summary>Advanced diagnostics</summary>
    <div class="activity-diagnostics-body">
      <div class="activity-diagnostics-intro">
        <h2>Diagnostic tasks</h2>
        <p>Use these tools to investigate an exception. Start with Resolve an issue for failed or stalled work.</p>
      </div>

      <nav class="activity-diagnostics-groups" aria-label="Advanced Activity diagnostics">
        <section
          v-for="group in ACTIVITY_DIAGNOSTIC_GROUPS"
          :key="group.id"
          class="activity-diagnostic-group"
          :aria-labelledby="`activity-diagnostic-${group.id}`"
        >
          <header>
            <h3 :id="`activity-diagnostic-${group.id}`">{{ group.title }}</h3>
            <p>{{ group.description }}</p>
          </header>
          <ul>
            <li v-for="link in group.links" :key="link.name">
              <RouterLink :to="{ name: link.name }">{{ link.label }}</RouterLink>
            </li>
          </ul>
        </section>
      </nav>
    </div>
  </details>
</template>

<style scoped>
.activity-diagnostics {
  background: var(--hx-bg-surface);
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
}

.activity-diagnostics summary {
  color: var(--hx-text-strong);
  cursor: pointer;
  font-size: var(--hx-text-sm);
  font-weight: 600;
  padding: var(--hx-space-3) var(--hx-space-4);
}

.activity-diagnostics-body {
  display: grid;
  gap: var(--hx-space-4);
  padding: 0 var(--hx-space-4) var(--hx-space-4);
}

.activity-diagnostics-intro h2,
.activity-diagnostic-group h3 {
  color: var(--hx-text-strong);
  margin: 0;
}

.activity-diagnostics-intro h2 {
  font-size: var(--hx-text-md);
}

.activity-diagnostics-intro p,
.activity-diagnostic-group p {
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
  margin: var(--hx-space-1) 0 0;
}

.activity-diagnostics-groups {
  display: grid;
  gap: var(--hx-space-4);
}

.activity-diagnostic-group {
  border-top: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-2);
  padding-top: var(--hx-space-4);
}

.activity-diagnostic-group h3 {
  font-size: var(--hx-text-sm);
}

.activity-diagnostic-group ul {
  display: grid;
  gap: var(--hx-space-1) var(--hx-space-3);
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.activity-diagnostic-group a {
  align-items: center;
  border-radius: var(--hx-radius-xs);
  color: var(--hx-accent);
  display: flex;
  font-size: var(--hx-text-sm);
  min-height: 44px;
  padding: var(--hx-space-2) var(--hx-space-3);
  text-decoration: none;
}

.activity-diagnostic-group a:hover {
  background: var(--hx-bg-surface-muted);
  text-decoration: underline;
}

.activity-diagnostic-group a:focus-visible {
  outline: 2px solid var(--hx-accent);
  outline-offset: 2px;
}

@media (max-width: 640px) {
  .activity-diagnostic-group ul {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
