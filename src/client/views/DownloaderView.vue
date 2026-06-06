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
import DownloaderTransferDetailDrawer from '../components/downloader/DownloaderTransferDetailDrawer.vue';
import {
  formatTransferFilename,
} from '../lib/activity-downloads-presentation.js';
import { formatBytes, formatSpeed } from '../lib/search-presentation.js';
import { formatOperationTimestampShort } from '../lib/operation-run-presentation.js';
import { fetchDownloaderQueue } from '../lib/downloader-api.js';
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
const selectedTransferKey = ref(null);

const {
  data: downloaderQueue,
  errorMessage,
  isLoading,
  lastRefreshedAt,
  load,
} = useAsyncResource({
  fetcher: () => fetchDownloaderQueue({ includeRemoved: false }),
  project: (payload) => (payload && typeof payload === 'object' ? payload : null),
  initialData: null,
  pollIntervalMs: POLL_INTERVAL_MS,
  fallbackErrorMessage: 'Failed to load downloads',
});

const emptyCounts = Object.freeze({
  active: 0,
  completed: 0,
  failed: 0,
  other: 0,
  queued: 0,
  total: 0,
});

const allFiles = computed(() => (
  Array.isArray(downloaderQueue.value?.transfers)
    ? downloaderQueue.value.transfers
    : []
));
const counts = computed(() => downloaderQueue.value?.queueHealth?.counts ?? emptyCounts);

const activitySummary = computed(() =>
  downloaderQueue.value?.queueHealth?.message ?? 'No transfers are currently visible.',
);

const statusCards = computed(() => [
  { key: 'active', label: 'Active', value: counts.value.active, tone: counts.value.active > 0 ? 'warning' : 'info' },
  { key: 'queued', label: 'Queued', value: counts.value.queued, tone: counts.value.queued > 0 ? 'warning' : 'info' },
  { key: 'completed', label: 'Complete', value: counts.value.completed, tone: 'success' },
  { key: 'failed', label: 'Failed', value: counts.value.failed, tone: counts.value.failed > 0 ? 'danger' : 'info' },
]);

function matchesFilter(file) {
  const stateCode = file?.state?.code;
  switch (selectedFilter.value) {
    case 'active':
      return stateCode === 'active';
    case 'queued':
      return stateCode === 'queued';
    case 'completed':
      return stateCode === 'completed';
    case 'failed':
      return stateCode === 'failed';
    default:
      return true;
  }
}

const visibleFiles = computed(() =>
  allFiles.value
    .filter(matchesFilter),
);

const selectedTransfer = computed(() => (
  selectedTransferKey.value
    ? allFiles.value.find((file) => file.transferKey === selectedTransferKey.value) ?? null
    : null
));

function progressLabel(file) {
  if (file.progress?.percentComplete !== null && file.progress?.percentComplete !== undefined) {
    return `${file.progress.percentComplete}%`;
  }
  if (file.state?.code === 'active' || file.state?.code === 'queued') return 'Waiting for progress';
  return '—';
}

function shouldShowIndeterminateProgress(file) {
  return file?.state?.code === 'active' || file?.state?.code === 'queued';
}

function openTransferDetail(file) {
  if (!file?.transferKey) return;
  selectedTransferKey.value = file.transferKey;
}

function closeTransferDetail() {
  selectedTransferKey.value = null;
}
</script>

<template>
  <section class="hx-page downloader-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Downloader</h1>
        <p class="hx-page-subtitle">
          Live transfer queue, active downloads, and recent outcomes from your download client.
          {{ activitySummary }}
          <span v-if="downloaderQueue?.observedAt">Observed {{ formatOperationTimestampShort(downloaderQueue.observedAt) }}.</span>
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
                <th class="hx-table-num">Diagnostics</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in visibleFiles" :key="file.transferKey">
                <td>
                  <span class="downloader-file" :title="file.filename">{{ formatTransferFilename(file.filename) }}</span>
                  <span v-if="file.directory" class="downloader-file-directory">{{ file.directory }}</span>
                </td>
                <td>{{ file.sourceUser ?? '—' }}</td>
                <td>
                  <span class="hx-pill" :data-tone="file.state?.tone ?? 'info'">
                    {{ file.state?.label ?? 'Unknown' }}
                  </span>
                </td>
                <td class="hx-table-num">
                  <div class="downloader-progress-cell">
                    <progress
                      v-if="file.progress?.percentComplete !== null && file.progress?.percentComplete !== undefined"
                      class="downloader-progress"
                      :value="file.progress.percentComplete"
                      max="100"
                    >{{ file.progress.percentComplete }}%</progress>
                    <progress
                      v-else-if="shouldShowIndeterminateProgress(file)"
                      class="downloader-progress"
                      max="100"
                    >Waiting for progress</progress>
                    <span>{{ progressLabel(file) }}</span>
                  </div>
                </td>
                <td class="hx-table-num">{{ formatBytes(file.progress?.size) }}</td>
                <td class="hx-table-num">{{ formatSpeed(file.averageSpeed) }}</td>
                <td class="hx-table-num">
                  <span v-if="file.placeInQueue !== null && file.placeInQueue !== undefined">{{ file.placeInQueue }}</span>
                  <span v-else>—</span>
                </td>
                <td class="hx-table-num">
                  <button
                    type="button"
                    class="hx-btn downloader-detail-button"
                    @click="openTransferDetail(file)"
                  >
                    Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>

    <DownloaderTransferDetailDrawer
      :open="Boolean(selectedTransfer)"
      :observed-at="downloaderQueue?.observedAt ?? null"
      :transfer="selectedTransfer"
      @close="closeTransferDetail"
    />
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

.downloader-detail-button {
  min-height: 32px;
  padding: 0 var(--hx-space-3);
}
</style>
