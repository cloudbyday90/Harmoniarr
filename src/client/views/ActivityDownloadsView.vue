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
  calculateTransferProgress,
  formatDownloadActivitySummary,
  formatTransferFilename,
  formatTransferStateLabel,
  formatTransferStateTone,
  isActiveTransferState,
  isCompletedTransferState,
  isFailedTransferState,
} from '../lib/activity-downloads-presentation.js';
import { formatBytes, formatSpeed } from '../lib/search-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import { fetchSlskdDownloads } from '../lib/slskd-search-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const POLL_INTERVAL_MS = 5000;

const {
  data: groups,
  errorMessage,
  isLoading,
  lastRefreshedAt,
  load,
} = useAsyncResource({
  fetcher: () => fetchSlskdDownloads({ includeRemoved: false }),
  project: (payload) => (Array.isArray(payload) ? payload : []),
  initialData: [],
  pollIntervalMs: POLL_INTERVAL_MS,
  fallbackErrorMessage: 'Failed to load downloads',
});

const allFiles = computed(() => {
  const out = [];
  for (const group of groups.value ?? []) {
    const username = group.username ?? '\u2014';
    for (const directory of group.directories ?? []) {
      for (const file of directory.files ?? []) {
        out.push({ ...file, username, directory: directory.directory ?? file.directory ?? null });
      }
    }
  }
  return out;
});

const activeFiles = computed(() => allFiles.value.filter((file) => isActiveTransferState(file.state)));
const completedFiles = computed(() => allFiles.value.filter((file) => isCompletedTransferState(file.state)));
const failedFiles = computed(() => allFiles.value.filter((file) => isFailedTransferState(file.state)));

const activitySummary = computed(() =>
  formatDownloadActivitySummary({
    active: activeFiles.value.length,
    completed: completedFiles.value.length,
    failed: failedFiles.value.length,
  }),
);

const allFilesWithProgress = computed(() =>
  allFiles.value.map((file) => ({ ...file, progress: calculateTransferProgress(file) })),
);
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Downloads</h2>
        <p class="hx-page-subtitle">
          Live Soulseek transfer activity.
          {{ activitySummary }}.
          <span v-if="lastRefreshedAt"> · Refreshed {{ formatOperationTimestampShort(lastRefreshedAt) }}</span>
        </p>
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
        <div v-if="isLoading && !allFiles.length" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!allFiles.length" class="hx-empty">
          <p class="hx-empty-title">No downloads in flight</p>
          <p class="hx-empty-copy">Files downloaded via Search or library import will appear here.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>File</th>
                <th>User</th>
                <th>State</th>
                <th class="hx-table-num">Progress</th>
                <th class="hx-table-num">Size</th>
                <th class="hx-table-num">Speed</th>
                <th class="hx-table-num">Position</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in allFilesWithProgress" :key="`${file.username}::${file.id}`">
                <td :title="file.filename">{{ formatTransferFilename(file.filename) }}</td>
                <td>{{ file.username }}</td>
                <td>
                  <span class="hx-pill" :data-tone="formatTransferStateTone(file.state)">{{ formatTransferStateLabel(file.state) }}</span>
                </td>
                <td class="hx-table-num">
                  <span v-if="file.progress !== null">{{ file.progress }}%</span>
                  <span v-else>—</span>
                </td>
                <td class="hx-table-num">{{ formatBytes(file.size) }}</td>
                <td class="hx-table-num">{{ formatSpeed(file.averageSpeed) }}</td>
                <td class="hx-table-num">
                  <span v-if="file.placeInQueue !== null && file.placeInQueue !== undefined">{{ file.placeInQueue }}</span>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
