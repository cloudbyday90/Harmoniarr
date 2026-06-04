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
import { fetchOperationHistory } from '../lib/operations-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';
import OperationStatusBadge from '../components/OperationStatusBadge.vue';
import {
  formatElapsedDuration,
  formatOperationTimestampShort,
} from '../lib/operation-run-presentation.js';
import { getOperationRunDescriptor } from '../lib/operation-run-link-targets.js';

const {
  data: history,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => fetchOperationHistory({ limit: 50 }),
  project: (payload) => ({
    runs: Array.isArray(payload?.runs) ? payload.runs : [],
    checkedAt: payload?.checkedAt ?? null,
  }),
  initialData: { runs: [], checkedAt: null },
  fallbackErrorMessage: 'Failed to load operation history',
});

const runs = computed(() => history.value?.runs ?? []);
const checkedAt = computed(() => history.value?.checkedAt ?? null);

const activeRuns = computed(() => runs.value.filter((run) => {
  const status = run.status;
  return status === 'pending' || status === 'in_progress' || status === 'queued' || status === 'claimed';
}));

const recentRuns = computed(() => runs.value.slice(0, 25));
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Queue</h2>
        <p class="hx-page-subtitle">
          {{ activeRuns.length }} active · {{ recentRuns.length }} recent operation runs
          <span v-if="checkedAt"> · checked {{ formatOperationTimestampShort(checkedAt) }}</span>
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
        <div v-if="isLoading && !recentRuns.length" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!recentRuns.length" class="hx-empty">
          <p class="hx-empty-title">No operation history</p>
          <p class="hx-empty-copy">Scheduled tasks such as library scans and metadata refreshes will appear here once started.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Status</th>
                <th class="hx-table-num">Attempts</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in recentRuns" :key="run.id">
                <td>{{ getOperationRunDescriptor(run.operationType).title }}</td>
                <td>
                  <OperationStatusBadge :status="run.status" variant="queue" />
                </td>
                <td class="hx-table-num">
                  {{ run.attemptCount ?? 0 }}<span v-if="run.maxAttempts">/{{ run.maxAttempts }}</span>
                </td>
                <td>{{ formatOperationTimestampShort(run.startedAt) }}</td>
                <td>{{ formatElapsedDuration(run.startedAt, run.finishedAt) }}</td>
                <td>{{ run.errorMessage ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
