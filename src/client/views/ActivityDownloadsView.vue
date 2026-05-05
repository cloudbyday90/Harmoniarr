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

const activeFiles = computed(() => allFiles.value.filter((file) => isActiveState(file.state)));
const completedFiles = computed(() => allFiles.value.filter((file) => isCompletedState(file.state)));
const failedFiles = computed(() => allFiles.value.filter((file) => isFailedState(file.state)));

function isActiveState(state) {
  if (typeof state !== 'string') return false;
  return /InProgress|Queued|Initializing|Negotiating/i.test(state);
}

function isCompletedState(state) {
  return typeof state === 'string' && /Completed/i.test(state) && !/Errored|Cancelled|Rejected|TimedOut/i.test(state);
}

function isFailedState(state) {
  return typeof state === 'string' && /Errored|Cancelled|Rejected|TimedOut|Aborted/i.test(state);
}

function stateTone(state) {
  if (isFailedState(state)) return 'danger';
  if (isCompletedState(state)) return 'success';
  if (isActiveState(state)) return 'warning';
  return 'info';
}

function shortState(state) {
  if (typeof state !== 'string') return '\u2014';
  return state.split(',')[0]?.trim() || state;
}

function progress(file) {
  const size = Number(file?.size);
  const transferred = Number(file?.bytesTransferred);
  if (!Number.isFinite(size) || size <= 0) return null;
  if (!Number.isFinite(transferred) || transferred < 0) return 0;
  return Math.min(100, Math.round((transferred / size) * 100));
}

function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '\u2014';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function formatSpeed(bytesPerSecond) {
  const value = Number(bytesPerSecond);
  if (!Number.isFinite(value) || value <= 0) return '\u2014';
  return `${formatBytes(value)}/s`;
}

function basename(filename) {
  if (typeof filename !== 'string') return '\u2014';
  const i = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  return i >= 0 ? filename.slice(i + 1) : filename;
}
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Downloads</h2>
        <p class="hx-page-subtitle">
          Live slskd transfer state.
          {{ activeFiles.length }} active · {{ completedFiles.length }} complete · {{ failedFiles.length }} failed.
          <span v-if="lastRefreshedAt"> · refreshed {{ lastRefreshedAt }}</span>
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
          <p class="hx-empty-copy">Files enqueued through Search or import execution will appear here.</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>File</th>
                <th>Peer</th>
                <th>State</th>
                <th class="hx-table-num">Progress</th>
                <th class="hx-table-num">Size</th>
                <th class="hx-table-num">Speed</th>
                <th class="hx-table-num">Queue</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="file in allFiles" :key="`${file.username}::${file.id}`">
                <td :title="file.filename">{{ basename(file.filename) }}</td>
                <td>{{ file.username }}</td>
                <td>
                  <span class="hx-pill" :data-tone="stateTone(file.state)">{{ shortState(file.state) }}</span>
                </td>
                <td class="hx-table-num">
                  <span v-if="progress(file) !== null">{{ progress(file) }}%</span>
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
