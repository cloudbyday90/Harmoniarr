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
import { computed, onMounted, ref } from 'vue';
import { fetchOperationHistory } from '../lib/operations-api.js';

const isLoading = ref(true);
const errorMessage = ref('');
const runs = ref([]);
const checkedAt = ref(null);

async function load() {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const payload = await fetchOperationHistory({ limit: 50 });
    runs.value = Array.isArray(payload?.runs) ? payload.runs : [];
    checkedAt.value = payload?.checkedAt ?? null;
  } catch (error) {
    errorMessage.value = error?.message ?? 'Failed to load operation history';
    runs.value = [];
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);

const activeRuns = computed(() => runs.value.filter((run) => {
  const status = run.status;
  return status === 'pending' || status === 'in_progress' || status === 'queued' || status === 'claimed';
}));

const recentRuns = computed(() => runs.value.slice(0, 25));

function statusTone(status) {
  if (status === 'succeeded' || status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  if (status === 'pending' || status === 'queued') return 'info';
  if (status === 'in_progress' || status === 'claimed') return 'warning';
  return undefined;
}

function formatDuration(start, end) {
  if (!start) return '—';
  const startMs = Date.parse(start);
  const endMs = end ? Date.parse(end) : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '—';
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  return `${minutes}m ${remSeconds}s`;
}
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Queue</h2>
        <p class="hx-page-subtitle">
          {{ activeRuns.length }} active · {{ recentRuns.length }} recent operation runs
          <span v-if="checkedAt"> · checked {{ checkedAt }}</span>
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
          <p class="hx-empty-copy">Operation runs (scans, reconciliation, import workers) will appear here once dispatched.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Status</th>
                <th class="hx-table-num">Attempt</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="run in recentRuns" :key="run.id">
                <td>{{ run.operationType }}</td>
                <td>
                  <span class="hx-pill" :data-tone="statusTone(run.status)">{{ run.status }}</span>
                </td>
                <td class="hx-table-num">
                  {{ run.attemptCount ?? 0 }}<span v-if="run.maxAttempts">/{{ run.maxAttempts }}</span>
                </td>
                <td>{{ run.startedAt ?? '—' }}</td>
                <td>{{ formatDuration(run.startedAt, run.finishedAt) }}</td>
                <td>{{ run.errorMessage ?? '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
