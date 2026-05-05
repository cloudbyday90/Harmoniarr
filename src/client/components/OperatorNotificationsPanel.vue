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
import { RouterLink } from 'vue-router';

defineProps({
  checkedAt: {
    type: String,
    default: null,
  },
  counts: {
    type: Object,
    default: () => ({
      actionable: 0,
      byCategory: {
        failure: 0,
        manual_intervention: 0,
        queued_work: 0,
        recovery: 0,
      },
      total: 0,
    }),
  },
  notifications: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['refresh']);

function severityClass(severity) {
  switch (severity) {
    case 'error':
      return 'review-status-failed';
    case 'success':
      return 'review-status-selected';
    case 'warning':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

function severityLabel(severity) {
  switch (severity) {
    case 'error':
      return 'Failure';
    case 'success':
      return 'Recovered';
    case 'warning':
      return 'Needs review';
    default:
      return 'Queued';
  }
}

function notificationLink(notification) {
  if (notification?.reference?.type === 'operation_run' && notification.reference.runId) {
    return {
      label: 'Open run detail',
      to: {
        hash: '#operation-run-detail-panel',
        name: 'activity-operations',
        query: {
          runId: notification.reference.runId,
        },
      },
    };
  }

  if (notification?.reference?.type === 'heartbeat') {
    return {
      label: 'Open dashboard',
      to: {
        hash: '#library-discovery-panel',
        name: 'dashboard',
      },
    };
  }

  return null;
}
</script>

<template>
  <article class="panel-light">
    <div class="section-header">
      <div>
        <p class="eyebrow">Operator notifications</p>
        <h3>Actionable runtime signals</h3>
        <p class="metadata-card-copy">
          {{ checkedAt ? `Evaluated ${checkedAt}.` : 'No notification snapshot is available yet.' }}
        </p>
      </div>
      <button type="button" @click="$emit('refresh')">Refresh</button>
    </div>

    <div class="pill-row" v-if="counts.total > 0">
      <div class="pill">
        <span>Total</span>
        <strong>{{ counts.total }}</strong>
      </div>
      <div class="pill">
        <span>Actionable</span>
        <strong>{{ counts.actionable }}</strong>
      </div>
      <div class="pill">
        <span>Failures</span>
        <strong>{{ counts.byCategory?.failure ?? 0 }}</strong>
      </div>
      <div class="pill">
        <span>Manual intervention</span>
        <strong>{{ counts.byCategory?.manual_intervention ?? 0 }}</strong>
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
          <RouterLink
            v-if="notificationLink(notification)"
            class="secondary-button"
            :to="notificationLink(notification).to"
          >
            {{ notificationLink(notification).label }}
          </RouterLink>
        </div>
      </article>
    </div>

    <p v-else class="metadata-card-copy">No actionable operator notifications are currently active.</p>
  </article>
</template>