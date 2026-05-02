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
const props = defineProps({
  heartbeats: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['refresh']);

function formatStatus(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'error':
      return 'Error';
    case 'idle':
      return 'Idle';
    case 'paused':
      return 'Paused';
    case 'running':
      return 'Running';
    default:
      return 'Waiting';
  }
}

function statusClass(status) {
  switch (status) {
    case 'error':
      return 'review-status-failed';
    case 'running':
      return 'review-status-selected';
    case 'idle':
      return 'review-status-selected';
    default:
      return 'review-status-held';
  }
}
</script>

<template>
  <article class="panel-light">
    <div class="section-header">
      <div>
        <p class="eyebrow">Background services</p>
        <h3>Heartbeat status</h3>
      </div>
      <button type="button" @click="$emit('refresh')">Refresh</button>
    </div>
    <div class="dependency-grid" v-if="props.heartbeats.length">
      <article class="dependency-card" v-for="heartbeat in props.heartbeats" :key="heartbeat.key">
        <div class="dependency-card-header">
          <div>
            <p>{{ heartbeat.label }}</p>
            <strong>{{ formatStatus(heartbeat.status) }}</strong>
          </div>
          <span class="review-status-pill" :class="statusClass(heartbeat.status)">
            {{ formatStatus(heartbeat.status) }}
          </span>
        </div>
        <p class="dependency-message">{{ heartbeat.message }}</p>
        <dl>
          <div><dt>Cadence</dt><dd>{{ heartbeat.intervalLabel ?? 'Unavailable' }}</dd></div>
          <div><dt>Last tick</dt><dd>{{ heartbeat.lastTickAt ?? 'Not yet recorded' }}</dd></div>
          <div><dt>Last triggered</dt><dd>{{ heartbeat.lastTriggeredAt ?? 'Not yet triggered' }}</dd></div>
          <div v-if="heartbeat.lastPauseProvider"><dt>Blocked by</dt><dd>{{ heartbeat.lastPauseProvider }}</dd></div>
          <div v-if="heartbeat.nextRetryAt"><dt>Next retry</dt><dd>{{ heartbeat.nextRetryAt }}</dd></div>
        </dl>
      </article>
    </div>
    <p v-else>No automatic heartbeat services are available.</p>
  </article>
</template>