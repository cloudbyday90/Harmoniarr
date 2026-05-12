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
import {
  buildNotificationLink,
  formatNotificationCategoryLabel,
  getNotificationSeverityClass,
  getNotificationSeverityLabel,
} from '../lib/operator-notifications-presentation.js';

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

const emit = defineEmits(['refresh']);
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Notifications</h3>
        <p class="hx-card-subtitle">
          {{ checkedAt ? `Evaluated ${checkedAt}.` : 'No notification snapshot is available yet.' }}
        </p>
      </div>
      <button type="button" @click="emit('refresh')">Refresh</button>
    </header>

    <div class="hx-card-body" v-if="counts.total > 0">
      <div class="pill-row">
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
    </div>

    <div class="hx-card-body" v-if="notifications.length">
      <article class="activity-feed-entry" v-for="notification in notifications" :key="notification.id">
        <div class="activity-feed-entry-header">
          <div>
            <p class="hx-text-muted">{{ formatNotificationCategoryLabel(notification.category) }}</p>
            <strong>{{ notification.title }}</strong>
          </div>
          <span class="review-status-pill" :class="getNotificationSeverityClass(notification.severity)">
            {{ getNotificationSeverityLabel(notification.severity) }}
          </span>
        </div>
        <p class="activity-feed-message">{{ notification.message }}</p>
        <div class="activity-feed-entry-footer">
          <p class="hx-text-muted">{{ notification.occurredAt ?? 'Timestamp unavailable' }}</p>
          <RouterLink
            v-if="buildNotificationLink(notification)"
            class="secondary-button"
            :to="buildNotificationLink(notification).to"
          >
            {{ buildNotificationLink(notification).label }}
          </RouterLink>
        </div>
      </article>
    </div>

    <div class="hx-card-body" v-else>
      <p class="hx-text-muted">No actionable operator notifications are currently active.</p>
    </div>
  </article>
</template>