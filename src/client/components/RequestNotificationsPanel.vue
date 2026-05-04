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

function severityClass(severity) {
  switch (severity) {
    case 'error':
      return 'review-status-failed';
    case 'success':
      return 'review-status-selected';
    default:
      return 'review-status-held';
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
  <article class="panel-light">
    <div class="section-header">
      <div>
        <p class="eyebrow">Request notifications</p>
        <h3>Delegated fulfillment updates</h3>
        <p class="metadata-card-copy">
          {{ checkedAt ? `Evaluated ${checkedAt}.` : 'No request notification snapshot is available yet.' }}
        </p>
      </div>
    </div>

    <div class="pill-row" v-if="counts.total > 0">
      <div class="pill">
        <span>Total</span>
        <strong>{{ counts.total }}</strong>
      </div>
      <div class="pill">
        <span>Requested for you</span>
        <strong>{{ counts.byCategory?.delegated_request ?? 0 }}</strong>
      </div>
      <div class="pill">
        <span>Fulfillment updates</span>
        <strong>{{ counts.byCategory?.fulfillment ?? 0 }}</strong>
      </div>
      <div class="pill">
        <span>Failures</span>
        <strong>{{ counts.byCategory?.failure ?? 0 }}</strong>
      </div>
    </div>

    <div class="activity-feed-list" v-if="notifications.length">
      <article class="activity-feed-entry" v-for="notification in notifications" :key="notification.id">
        <div class="activity-feed-entry-header">
          <div>
            <p class="eyebrow">{{ notification.category.replace('_', ' ') }}</p>
            <strong>{{ notification.title }}</strong>
          </div>
          <span class="review-status-pill" :class="severityClass(notification.severity)">
            {{ severityLabel(notification.severity) }}
          </span>
        </div>
        <p class="activity-feed-message">{{ notification.message }}</p>
        <div class="activity-feed-entry-footer">
          <p class="metadata-card-copy">{{ notification.occurredAt ?? 'Timestamp unavailable' }}</p>
        </div>
      </article>
    </div>

    <p v-else class="metadata-card-copy">No delegated request notifications are currently visible in this scope.</p>
  </article>
</template>
