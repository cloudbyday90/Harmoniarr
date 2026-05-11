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
defineProps({
  checkedAt: {
    type: String,
    default: null,
  },
  counts: {
    type: Object,
    default: () => ({
      byCategory: {
        delegated_request: 0,
        failure: 0,
        fulfillment: 0,
        review: 0,
      },
      total: 0,
    }),
  },
  notifications: {
    type: Array,
    default: () => [],
  },
});

function severityTone(severity) {
  switch (severity) {
    case 'error':
      return 'danger';
    case 'success':
      return 'success';
    default:
      return 'info';
  }
}

function severityLabel(severity) {
  switch (severity) {
    case 'error':
      return 'Needs attention';
    case 'success':
      return 'Completed';
    default:
      return 'Update';
  }
}
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Delegated fulfillment updates</h3>
        <p class="hx-card-subtitle">
          {{ checkedAt ? `Evaluated ${checkedAt}.` : 'No request notification snapshot is available yet.' }}
        </p>
      </div>
    </header>

    <div class="hx-card-body" v-if="counts.total > 0">
      <section class="hx-stat-grid rnp-stat-grid">
        <article class="hx-stat-card">
          <span class="hx-stat-label">Total</span>
          <span class="hx-stat-value">{{ counts.total }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Requested for you</span>
          <span class="hx-stat-value">{{ counts.byCategory?.delegated_request ?? 0 }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Fulfillment updates</span>
          <span class="hx-stat-value">{{ counts.byCategory?.fulfillment ?? 0 }}</span>
        </article>
        <article class="hx-stat-card">
          <span class="hx-stat-label">Failures</span>
          <span class="hx-stat-value">{{ counts.byCategory?.failure ?? 0 }}</span>
        </article>
      </section>
    </div>

    <div class="hx-card-body hx-card-body--flush" v-if="notifications.length">
      <div class="rnp-feed">
        <article class="rnp-entry" v-for="notification in notifications" :key="notification.id">
          <div class="rnp-entry-header">
            <div>
              <p class="rnp-category">{{ notification.category.replace('_', ' ') }}</p>
              <strong class="rnp-title">{{ notification.title }}</strong>
            </div>
            <span class="hx-pill" :data-tone="severityTone(notification.severity)">
              {{ severityLabel(notification.severity) }}
            </span>
          </div>
          <p class="hx-text-muted rnp-message">{{ notification.message }}</p>
          <p class="hx-text-muted rnp-time">{{ notification.occurredAt ?? 'Timestamp unavailable' }}</p>
        </article>
      </div>
    </div>

    <div class="hx-card-body" v-else>
      <p class="hx-text-muted">No delegated request notifications are currently visible in this scope.</p>
    </div>
  </article>
</template>

<style scoped>
.rnp-stat-grid {
  padding-bottom: 0;
}

.rnp-feed {
  display: grid;
  gap: 0;
}

.rnp-entry {
  padding: var(--hx-space-3) var(--hx-space-4);
  border-bottom: 1px solid var(--hx-border-subtle);
  display: grid;
  gap: var(--hx-space-1);
}

.rnp-entry:last-child {
  border-bottom: none;
}

.rnp-entry-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
}

.rnp-category {
  font-size: var(--hx-text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--hx-text-muted);
  margin: 0 0 var(--hx-space-1);
}

.rnp-title {
  font-size: var(--hx-text-base);
  font-weight: 600;
}

.rnp-message {
  font-size: var(--hx-text-sm);
}

.rnp-time {
  font-size: var(--hx-text-xs);
}
</style>
