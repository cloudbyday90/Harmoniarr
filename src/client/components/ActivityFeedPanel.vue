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
import { buildActivityFeedEntryLinkTarget } from '../lib/activity-feed-link-targets.js';
import {
  formatActivityFeedEntryTypeLabel,
  getActivityFeedStatusClass,
  getActivityFeedStatusLabel,
} from '../lib/activity-feed-presentation.js';

defineProps({
  checkedAt: {
    type: String,
    default: null,
  },
  entries: {
    type: Array,
    default: () => [],
  },
  errorMessage: {
    type: String,
    default: '',
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
  isLoadingMore: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['load-more', 'refresh']);
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Recent activity</h3>
        <p class="hx-card-subtitle">
          {{ checkedAt ? `Feed generated ${checkedAt}.` : 'Feed timing is unavailable.' }}
        </p>
      </div>
      <button type="button" @click="emit('refresh')">Refresh</button>
    </header>

    <div class="hx-card-body" v-if="errorMessage">
      <p class="error-copy activity-feed-error">{{ errorMessage }}</p>
    </div>

    <div class="hx-card-body" v-if="entries.length">
      <ul class="activity-feed-list">
        <li v-for="entry in entries" :key="entry.id" class="activity-feed-entry">
          <div class="activity-feed-entry-header">
            <div>
              <p class="hx-text-muted">{{ formatActivityFeedEntryTypeLabel(entry.entryType) }}</p>
              <strong>{{ entry.title }}</strong>
            </div>
            <span class="review-status-pill" :class="getActivityFeedStatusClass(entry.status)">
              {{ getActivityFeedStatusLabel(entry.status) }}
            </span>
          </div>
          <p class="activity-feed-message">{{ entry.message }}</p>
          <div class="activity-feed-entry-footer">
            <p class="hx-text-muted">{{ entry.occurredAt ?? 'Timestamp unavailable' }}</p>
            <RouterLink
              v-if="buildActivityFeedEntryLinkTarget(entry)"
              class="secondary-button"
              :to="buildActivityFeedEntryLinkTarget(entry).to"
            >
              {{ buildActivityFeedEntryLinkTarget(entry).label }}
            </RouterLink>
          </div>
        </li>
      </ul>
    </div>

    <div class="hx-card-body" v-else>
      <p class="hx-text-muted">No recent background activity has been recorded yet.</p>
    </div>

    <div v-if="hasMore" class="activity-feed-actions">
      <button type="button" class="secondary-button" :disabled="isLoadingMore" @click="emit('load-more')">
        {{ isLoadingMore ? 'Loading more...' : 'Load more activity' }}
      </button>
    </div>
  </article>
</template>

<style scoped>
.activity-feed-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.activity-feed-entry-footer {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
}

.activity-feed-error {
  margin-top: 1rem;
}

.activity-feed-list {
  display: grid;
  gap: 0.9rem;
  list-style: none;
  margin: 1.2rem 0 0;
  padding: 0;
}

.activity-feed-entry {
  border: 1px solid rgba(15, 23, 42, 0.08);
  border-radius: 0.9rem;
  padding: 1rem;
}

.activity-feed-entry-header {
  align-items: flex-start;
  display: flex;
  gap: 1rem;
  justify-content: space-between;
}

.activity-feed-message {
  margin: 0.65rem 0 0.35rem;
}
</style>