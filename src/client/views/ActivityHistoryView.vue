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
import { onMounted, ref } from 'vue';
import ActivityResourceState from '../components/activity/ActivityResourceState.vue';
import {
  formatActivityEntryCountLabel,
  formatActivityEntryStatusLabel,
  formatActivityEntryStatusTone,
  formatActivityEntryTypeLabel,
} from '../lib/activity-history-presentation.js';
import { formatOperationTimestamp } from '../lib/operation-run-presentation.js';
import { useActivityHistory } from '../composables/useActivityHistory.js';

const {
  entries,
  entryCount,
  errorMessage,
  isLoading,
  isRevalidating,
  load,
} = useActivityHistory({
  limit: 100,
  pollIntervalMs: 30000,
  revalidateOnFocus: true,
});

const isInitialLoadPending = ref(true);

onMounted(() => {
  void load().finally(() => {
    isInitialLoadPending.value = false;
  });
});
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">History</h2>
        <p class="hx-page-subtitle">
          Recent system activity ({{ formatActivityEntryCountLabel(entryCount) }}).
          <span v-if="isRevalidating" class="history-revalidating" aria-label="Refreshing">↻</span>
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <ActivityResourceState
      v-if="errorMessage"
      state="error"
      title="Could not load history"
      description="History may be temporarily unavailable. Try again to refresh it."
      action-label="Try again"
      :compact="entryCount > 0"
      @action="load"
    />

    <article v-if="!errorMessage || entryCount > 0" class="hx-card">
      <div class="hx-card-body is-flush">
        <ActivityResourceState
          v-if="(isLoading || isInitialLoadPending) && !entryCount"
          state="loading"
          title="Loading history..."
          :skeleton-lines="5"
        />
        <ActivityResourceState
          v-else-if="!entryCount"
          state="empty"
          title="No recent activity"
          description="Activity events will appear here as the system performs work."
        />
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Status</th>
                <th>Message</th>
                <th>Occurred</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in entries" :key="entry.id">
                <td>{{ formatActivityEntryTypeLabel(entry.entryType) }}</td>
                <td>{{ entry.title ?? '—' }}</td>
                <td>
                  <span v-if="entry.status" class="hx-pill" :data-tone="formatActivityEntryStatusTone(entry.status)">{{ formatActivityEntryStatusLabel(entry.status) }}</span>
                  <span v-else>—</span>
                </td>
                <td>{{ entry.message ?? '' }}</td>
                <td>{{ formatOperationTimestamp(entry.occurredAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>

<style scoped>
.history-revalidating {
  display: inline-block;
  animation: hx-spin 1s linear infinite;
}

@keyframes hx-spin {
  to { transform: rotate(360deg); }
}
</style>
