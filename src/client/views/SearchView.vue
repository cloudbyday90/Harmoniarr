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
import { computed, onBeforeUnmount, ref } from 'vue';
import {
  fetchSlskdSearchResponses,
  fetchSlskdSearchState,
  fetchSlskdStatus,
  startSlskdSearch,
} from '../lib/slskd-search-api.js';

const query = ref('');
const responseLimit = ref(50);
const minimumFileCount = ref(1);
const isSearching = ref(false);
const errorMessage = ref('');
const responses = ref([]);
const searchMeta = ref(null);
const slskdStatus = ref(null);
const isProbingStatus = ref(false);
let pollTimer = null;

async function refreshStatus() {
  isProbingStatus.value = true;
  try {
    slskdStatus.value = await fetchSlskdStatus();
  } catch (error) {
    slskdStatus.value = { state: 'error', message: error?.message ?? 'Unknown error' };
  } finally {
    isProbingStatus.value = false;
  }
}

refreshStatus();

const statusTone = computed(() => {
  const state = slskdStatus.value?.state ?? slskdStatus.value?.connectionState;
  if (state === 'connected' || state === 'ready' || state === 'online') return 'success';
  if (state === 'connecting' || state === 'reconnecting') return 'warning';
  if (!state) return 'info';
  return 'danger';
});

const statusLabel = computed(() => {
  if (isProbingStatus.value && !slskdStatus.value) return 'Probing slskd…';
  const state = slskdStatus.value?.state ?? slskdStatus.value?.connectionState;
  if (!state) return 'Status unknown';
  return state.charAt(0).toUpperCase() + state.slice(1);
});

const totalFiles = computed(() => {
  let total = 0;
  for (const response of responses.value) {
    if (Array.isArray(response.files)) total += response.files.length;
    else if (typeof response.fileCount === 'number') total += response.fileCount;
  }
  return total;
});

const sortedResponses = computed(() => {
  return [...responses.value].sort((a, b) => {
    const speedDelta = (b.uploadSpeed ?? 0) - (a.uploadSpeed ?? 0);
    if (speedDelta !== 0) return speedDelta;
    return (a.queueLength ?? 0) - (b.queueLength ?? 0);
  });
});

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

function formatSpeed(bytesPerSec) {
  if (typeof bytesPerSec !== 'number' || bytesPerSec <= 0) return '—';
  return `${formatBytes(bytesPerSec)}/s`;
}

function totalSizeForResponse(response) {
  if (typeof response.totalSize === 'number') return response.totalSize;
  if (Array.isArray(response.files)) {
    let sum = 0;
    for (const file of response.files) sum += file.size ?? 0;
    return sum;
  }
  return 0;
}

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

async function pollResponses(searchId) {
  try {
    const next = await fetchSlskdSearchResponses({ searchId });
    responses.value = next;
    const state = await fetchSlskdSearchState({ searchId });
    searchMeta.value = state;
    const isComplete = state?.isComplete || state?.state === 'completed' || state?.state === 'cancelled';
    if (!isComplete) {
      pollTimer = setTimeout(() => pollResponses(searchId), 2000);
    } else {
      isSearching.value = false;
    }
  } catch (error) {
    errorMessage.value = error?.message ?? 'Failed to poll search results';
    isSearching.value = false;
  }
}

async function runSearch() {
  const trimmed = query.value.trim();
  if (!trimmed || isSearching.value) return;
  clearPollTimer();
  errorMessage.value = '';
  responses.value = [];
  searchMeta.value = null;
  isSearching.value = true;
  try {
    const search = await startSlskdSearch({
      query: trimmed,
      responseLimit: Number(responseLimit.value) || 50,
      filterResponses: true,
    });
    const searchId = search?.searchId ?? search?.id;
    if (!searchId) {
      throw new Error('slskd did not return a search identifier');
    }
    searchMeta.value = search;
    await pollResponses(searchId);
  } catch (error) {
    errorMessage.value = error?.message ?? 'Failed to start search';
    isSearching.value = false;
  }
}

onBeforeUnmount(() => clearPollTimer());
</script>

<template>
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h1 class="hx-page-title">Search</h1>
        <p class="hx-page-subtitle">Manual Soulseek discovery: query the network and inspect available peers.</p>
      </div>
      <div class="hx-page-actions">
        <span class="hx-pill" :data-tone="statusTone">{{ statusLabel }}</span>
        <button type="button" class="hx-btn" @click="refreshStatus" :disabled="isProbingStatus">Refresh status</button>
      </div>
    </header>

    <article class="hx-card">
      <div class="hx-card-body">
        <form class="hx-form-row" @submit.prevent="runSearch">
          <div class="hx-field" style="flex: 3 1 320px;">
            <label class="hx-field-label" for="search-query">Query</label>
            <input
              id="search-query"
              class="hx-input"
              v-model="query"
              type="search"
              placeholder="artist - album, song title, or filename fragment"
              :disabled="isSearching"
            />
          </div>
          <div class="hx-field" style="flex: 0 1 140px;">
            <label class="hx-field-label" for="search-limit">Response limit</label>
            <input
              id="search-limit"
              class="hx-input"
              v-model.number="responseLimit"
              type="number"
              min="1"
              max="500"
              :disabled="isSearching"
            />
          </div>
          <div class="hx-field" style="flex: 0 1 140px;">
            <label class="hx-field-label" for="search-min-files">Min files</label>
            <input
              id="search-min-files"
              class="hx-input"
              v-model.number="minimumFileCount"
              type="number"
              min="1"
              :disabled="isSearching"
            />
          </div>
          <div class="hx-field" style="flex: 0 0 auto;">
            <button type="submit" class="hx-btn" data-variant="primary" :disabled="isSearching || !query.trim()">
              {{ isSearching ? 'Searching…' : 'Search' }}
            </button>
          </div>
        </form>
      </div>
    </article>

    <article v-if="errorMessage" class="hx-card">
      <div class="hx-card-body">
        <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
      </div>
    </article>

    <article class="hx-card">
      <header class="hx-card-header">
        <div>
          <h2 class="hx-card-title">Results</h2>
          <p class="hx-card-subtitle">
            {{ sortedResponses.length }} peer{{ sortedResponses.length === 1 ? '' : 's' }}
            · {{ totalFiles }} file{{ totalFiles === 1 ? '' : 's' }}
            <span v-if="searchMeta?.state"> · {{ searchMeta.state }}</span>
          </p>
        </div>
        <div class="hx-card-actions" v-if="isSearching">
          <span class="hx-pill" data-tone="warning">Polling…</span>
        </div>
      </header>

      <div class="hx-card-body is-flush">
        <div v-if="!sortedResponses.length && !isSearching" class="hx-empty">
          <p class="hx-empty-title">No results yet</p>
          <p class="hx-empty-copy">Enter a query above and press Search to discover Soulseek peers sharing matching files.</p>
        </div>

        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>User</th>
                <th class="hx-table-num">Files</th>
                <th class="hx-table-num">Total size</th>
                <th class="hx-table-num">Upload speed</th>
                <th class="hx-table-num">Queue</th>
                <th>Slot</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="response in sortedResponses" :key="response.username">
                <td>{{ response.username }}</td>
                <td class="hx-table-num">{{ response.fileCount ?? response.files?.length ?? 0 }}</td>
                <td class="hx-table-num">{{ formatBytes(totalSizeForResponse(response)) }}</td>
                <td class="hx-table-num">{{ formatSpeed(response.uploadSpeed) }}</td>
                <td class="hx-table-num">{{ response.queueLength ?? 0 }}</td>
                <td>
                  <span class="hx-pill" :data-tone="response.hasFreeUploadSlot ? 'success' : 'warning'">
                    {{ response.hasFreeUploadSlot ? 'Free' : 'Busy' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
