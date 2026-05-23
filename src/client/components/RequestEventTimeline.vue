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
import {
  formatReassignmentEventDescription,
  getReassignmentEventLabel,
  getReassignmentEventTone,
} from '../lib/request-music-form.js';

const props = defineProps({
  events: { type: Array, default: () => [] },
  eligibleUsers: { type: Array, default: () => [] },
});

const usersById = computed(() => {
  const map = {};
  for (const u of props.eligibleUsers) {
    map[u.id] = u;
  }
  return map;
});

function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString();
  } catch {
    return isoString;
  }
}
</script>

<template>
  <div v-if="events.length > 0" class="ret-wrap">
    <h4 class="ret-heading">Event history</h4>
    <ol class="ret-timeline">
      <li v-for="event in events" :key="event.id" class="ret-item">
        <div class="ret-dot"></div>
        <div class="ret-content">
          <div class="ret-header">
            <span class="hx-pill" :data-tone="getReassignmentEventTone(event.eventType)">
              {{ getReassignmentEventLabel(event.eventType) }}
            </span>
            <span class="ret-timestamp">{{ formatTimestamp(event.occurredAt) }}</span>
          </div>
          <p class="ret-desc">{{ formatReassignmentEventDescription(event, usersById) }}</p>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.ret-wrap {
  border: 1px solid var(--hx-border-subtle);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-bg-surface-sunken);
  padding: var(--hx-space-3);
}

.ret-heading {
  margin: 0 0 var(--hx-space-3);
  font-size: var(--hx-text-sm);
  font-weight: 600;
  color: var(--hx-text-strong);
}

.ret-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.ret-item {
  display: flex;
  gap: var(--hx-space-3);
  padding: var(--hx-space-2) 0;
  position: relative;
}

.ret-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 22px;
  bottom: -4px;
  width: 1px;
  background: var(--hx-border-subtle);
}

.ret-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--hx-accent);
  flex-shrink: 0;
  margin-top: 3px;
}

.ret-content {
  display: grid;
  gap: var(--hx-space-1);
  min-width: 0;
}

.ret-header {
  display: flex;
  align-items: center;
  gap: var(--hx-space-2);
  flex-wrap: wrap;
}

.ret-timestamp {
  font-size: var(--hx-text-xs);
  color: var(--hx-text-faint);
}

.ret-desc {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text-muted);
  line-height: 1.5;
}
</style>
