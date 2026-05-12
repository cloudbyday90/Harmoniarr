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
  formatActivityEntryCountLabel,
  formatActivityEntryStatusLabel,
  formatActivityEntryStatusTone,
  formatActivityEntryTypeLabel,
} from '../lib/activity-history-presentation.js';
import { formatOperationTimestamp } from '../lib/operation-run-presentation.js';
import { fetchSystemActivityFeed } from '../lib/system-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const {
  data: entries,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => fetchSystemActivityFeed({ limit: 100 }),
  project: (payload) => (Array.isArray(payload?.entries) ? payload.entries : []),
  initialData: [],
  fallbackErrorMessage: 'Failed to load activity feed',
});

const entryCount = computed(() => entries.value?.length ?? 0);
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">History</h2>
        <p class="hx-page-subtitle">Recent system activity ({{ formatActivityEntryCountLabel(entryCount) }}).</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <article v-if="errorMessage" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article class="hx-card">
      <div class="hx-card-body is-flush">
        <div v-if="isLoading && !entryCount" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!entryCount" class="hx-empty">
          <p class="hx-empty-title">No recent activity</p>
          <p class="hx-empty-copy">Activity events will appear here as the system performs work.</p>
        </div>
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
