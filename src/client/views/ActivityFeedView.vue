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
import { onMounted } from 'vue';
import EmptyState from '../components/EmptyState.vue';
import { useActivityFeed } from '../composables/useActivityFeed.js';
import { getActivityEventLabel, getActivityEventIcon } from '../lib/activity-event-normalization.js';
import { sessionStore } from '../state/session.js';

const { events, isLoading, errorMessage, checkedAt, hasEvents, isEmpty, load } = useActivityFeed({ limit: 100 });

const currentUserId = sessionStore.state.user?.id ?? null;

function formatOccurredAt(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <section class="hx-page activity-feed-view">

    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Household Activity</h1>
        <p class="hx-page-subtitle">
          Recent music requests, monitoring changes, and library additions.
        </p>
      </div>
    </header>

    <!-- Loading -->
    <p
      v-if="isLoading"
      class="activity-feed-loading"
      aria-live="polite"
      aria-busy="true"
    >
      Loading activity…
    </p>

    <!-- Error -->
    <EmptyState
      v-else-if="errorMessage"
      :title="errorMessage"
      body="Check your connection and try refreshing the page."
    />

    <!-- Empty -->
    <EmptyState
      v-else-if="isEmpty"
      title="No activity yet"
      body="Household activity appears here as music requests are submitted, artists are monitored, and releases are added to the library."
    />

    <!-- Event list -->
    <ul
      v-else-if="hasEvents"
      class="activity-feed-list"
      aria-label="Activity events"
    >
      <li
        v-for="event in events"
        :key="event.id"
        class="activity-feed-item"
        :data-event-type="event.eventType"
      >
        <span
          class="activity-feed-icon"
          :aria-label="getActivityEventIcon(event.eventType)"
        />
        <span class="activity-feed-label">
          {{ getActivityEventLabel(event, currentUserId) }}
        </span>
        <time
          v-if="event.occurredAt"
          :datetime="event.occurredAt"
          class="activity-feed-time"
        >
          {{ formatOccurredAt(event.occurredAt) }}
        </time>
      </li>
    </ul>

    <p
      v-if="checkedAt && !isLoading"
      class="activity-feed-checked-at"
      aria-live="polite"
    >
      Last checked: {{ formatOccurredAt(checkedAt) }}
    </p>

  </section>
</template>

<style scoped>
.activity-feed-view {
  container-type: inline-size;
}

.activity-feed-loading {
  color: var(--hx-text-muted, #888);
  padding: 1.5rem 0;
}

.activity-feed-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.activity-feed-item {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  background: var(--hx-surface-raised, #1e1e1e);
}

.activity-feed-icon {
  flex-shrink: 0;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--hx-accent, #6ea8fe);
  align-self: center;
}

.activity-feed-label {
  flex: 1;
  font-size: 0.9rem;
}

.activity-feed-time {
  flex-shrink: 0;
  font-size: 0.8rem;
  color: var(--hx-text-muted, #888);
  white-space: nowrap;
}

.activity-feed-checked-at {
  margin-top: 1.5rem;
  font-size: 0.75rem;
  color: var(--hx-text-muted, #888);
}
</style>
