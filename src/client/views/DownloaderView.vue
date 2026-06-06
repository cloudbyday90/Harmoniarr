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
import { computed, ref } from 'vue';
import {
  buildDownloadActivityCounts,
  calculateTransferProgress,
  flattenDownloadGroups,
  formatDownloadActivitySummary,
  formatTransferFilename,
  formatTransferStateLabel,
  formatTransferStateTone,
  isActiveTransferState,
  isCompletedTransferState,
  isFailedTransferState,
  isQueuedTransferState,
} from '../lib/activity-downloads-presentation.js';
import { formatBytes, formatSpeed } from '../lib/search-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import { fetchSlskdDownloads } from '../lib/slskd-search-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const POLL_INTERVAL_MS = 5000;

const filterOptions = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'queued', label: 'Queued' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
]);

const selectedFilter = ref('all');

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

const allFiles = computed(() => flattenDownloadGroups(groups.value));
const counts = computed(() => buildDownloadActivityCounts(allFiles.value));

const activitySummary = computed(() => formatDownloadActivitySummary(counts.value));

const statusCards = computed(() => [
  { key: 'active', label: 'Active', value: counts.value.active, tone: counts.value.active > 0 ? 'warning' : 'info' },
  { key: 'queued', label: 'Queued', value: counts.value.queued, tone: counts.value.queued > 0 ? 'warning' : 'info' },
  { key: 'completed', label: 'Complete', value: counts.value.completed, tone: 'success' },
  { key: 'failed', label: 'Failed', value: counts.value.failed, tone: counts.value.failed > 0 ? 'danger' : 'info' },
]);

function matchesFilter(file) {
  switch (selectedFilter.value) {
    case 'active':
      return isActiveTransferState(file.state) && !isQueuedTransferState(file.state);
    case 'queued':
      return isQueuedTransferState(file.state);
    case 'completed':
      return isCompletedTransferState(file.state);
    case 'failed':
      return isFailedTransferState(file.state);
    default:
      return true;
  }
}

const visibleFiles = computed(() =>
  allFiles.value
    .filter(matchesFilter)
    .map((file) => ({ ...file, progress: calculateTransferProgress(file) })),
);

function progressLabel(file) {
  if (file.progress !== null) return `${file.progress}%`;
  if (isActiveTransferState(file.state)) return 'Waiting for progress';
  return '—';
}
</script>

<template>
  <section class="hx-page downloader-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Downloader</h1>
        <p class="hx-page-subtitle">
          Live transfer queue, active downloads, and recent outcomes from your download client.
          {{ activitySummary }}.
          <span v-if="lastRefreshedAt">Refreshed {{ formatOperationTimestampShort(lastRefreshedAt) }}.</span>
        </p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <section class="hx-stat-grid" aria-label="Downloader transfer summary">
      <article v-for="card in statusCards" :key="card.key" class="hx-stat">
        <span class="hx-stat-label">{{ card.label }}</span>
        <span class="hx-stat-value">{{ card.value }}</span>
        <span class="hx-pill downloader-stat-pill" :data-tone="card.tone">{{ card.label }}</span>
      </article>
    </section>

    <article v-if="errorMessage" class="hx-card" role="status" aria-live="polite">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article class="hx-card">
      <div class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Transfer Queue</h2>
          <p class="hx-card-subtitle">
            Showing {{ visibleFiles.length }} of {{ counts.total }} transfer{{ counts.total === 1 ? '' : 's' }}.
          </p>
        </div>
        <div class="hx-card-actions">
          <div class="ops-filter-bar" role="group" aria-label="Filter transfers">
            <button
              v-for="option in filterOptions"
              :key="option.value"
              type="button"
              class="ops-filter-tab"
              :data-active="selectedFilter === option.value || undefined"
              :aria-pressed="selectedFilter === option.value"
              @click="selectedFilter = option.value"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

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
          <p class="hx-empty-copy">Files queued from Search or import review will appear here.</p>
        </div>
        <div v-else-if="!visibleFiles.length" class="hx-empty">
          <p class="hx-empty-title">No transfers match this filter</p>
          <p class="hx-empty-copy">Switch filters to review other transfer states.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Source User</th>
                <th>State</th>
                <th class="hx-table-num">Progress</th>
                <th class="hx-table-num">Size</th>
                <th class="hx-table-num">Speed</th>
                <th class="hx-table-num">Queue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in visibleFiles" :key="`${file.username}::${file.id}`">
                <td>
                  <span class="downloader-file" :title="file.filename">{{ formatTransferFilename(file.filename) }}</span>
                  <span v-if="file.directory" class="downloader-file-directory">{{ file.directory }}</span>
                </td>
                <td>{{ file.username }}</td>
                <td>
                  <span class="hx-pill" :data-tone="formatTransferStateTone(file.state)">
                    {{ formatTransferStateLabel(file.state) }}
                  </span>
                </td>
                <td class="hx-table-num">
                  <div class="downloader-progress-cell">
                    <progress
                      v-if="file.progress !== null"
                      class="downloader-progress"
                      :value="file.progress"
                      max="100"
                    >{{ file.progress }}%</progress>
                    <progress
                      v-else-if="isActiveTransferState(file.state)"
                      class="downloader-progress"
                      max="100"
                    >Waiting for progress</progress>
                    <span>{{ progressLabel(file) }}</span>
                  </div>
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

<style scoped>
.downloader-page {
  max-width: 1600px;
}

.downloader-stat-pill {
  justify-self: start;
}

.downloader-file {
  display: block;
  max-width: 440px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.downloader-file-directory {
  display: block;
  max-width: 440px;
  margin-top: 2px;
  color: var(--hx-text-faint);
  font-size: var(--hx-text-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.downloader-progress-cell {
  display: inline-grid;
  min-width: 150px;
  gap: 4px;
  justify-items: end;
}

.downloader-progress {
  width: 150px;
  height: 8px;
  accent-color: var(--hx-accent);
}
</style>
