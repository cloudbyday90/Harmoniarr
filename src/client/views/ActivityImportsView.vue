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
import { fetchImportCandidates } from '../lib/import-candidate-api.js';
import { useAsyncResource } from '../composables/useAsyncResource.js';

const props = defineProps({
  status: { type: String, default: 'import_pending' },
  title: { type: String, default: 'Imports' },
  subtitle: { type: String, default: 'Completed downloads waiting for ingestion.' },
  emptyTitle: { type: String, default: 'No import-pending candidates' },
  emptyCopy: { type: String, default: 'Imports awaiting ingestion will appear here once downloads complete.' },
});

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || bytes <= 0) return '\u2014';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}

const {
  data: candidates,
  errorMessage,
  isLoading,
  load,
} = useAsyncResource({
  fetcher: () => fetchImportCandidates({ status: props.status, limit: 100 }),
  project: (payload) => (Array.isArray(payload?.importCandidates) ? payload.importCandidates : []),
  initialData: [],
  fallbackErrorMessage: 'Failed to load import candidates',
});

const candidateCount = computed(() => candidates.value?.length ?? 0);
</script>

<template>
  <section>
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">{{ title }}</h2>
        <p class="hx-page-subtitle">{{ subtitle }} {{ formatCandidateCountLabel(candidateCount) }}.</p>
      </div>
      <div class="hx-page-actions">
        <button type="button" class="hx-btn" @click="load" :disabled="isLoading">
          {{ isLoading ? 'Loading\u2026' : 'Refresh' }}
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
        <div v-if="isLoading && !candidateCount" class="hx-card-body">
          <div class="hx-skeleton-stack">
            <span class="hx-skeleton" data-size="lg"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
            <span class="hx-skeleton"></span>
          </div>
        </div>
        <div v-else-if="!candidateCount" class="hx-empty">
          <p class="hx-empty-title">{{ emptyTitle }}</p>
          <p class="hx-empty-copy">{{ emptyCopy }}</p>
        </div>
        <div v-else class="hx-table-scroll">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Folder</th>
                <th>User</th>
                <th>Source</th>
                <th class="hx-table-num">Size</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="candidate in candidates" :key="candidate.id">
                <td>{{ candidate.folderPath ?? '\u2014' }}</td>
                <td>{{ candidate.username ?? '\u2014' }}</td>
                <td>{{ formatSourceProvider(candidate.sourceProvider) }}</td>
                <td class="hx-table-num">{{ formatBytes(candidate.totalSizeBytes) }}</td>
                <td><span class="hx-pill" :data-tone="candidateStatusTone(candidate.status)">{{ candidateStatusLabel(candidate.status) }}</span></td>
                <td>{{ candidate.importPendingAt ?? candidate.updatedAt ?? candidate.createdAt ? formatOperationTimestamp(candidate.importPendingAt ?? candidate.updatedAt ?? candidate.createdAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </article>
  </section>
</template>
