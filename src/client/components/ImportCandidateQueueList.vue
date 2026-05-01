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
defineProps({
  candidates: {
    type: Array,
    required: true,
  },
  isLoadingQueue: {
    type: Boolean,
    default: false,
  },
  listError: {
    type: String,
    default: '',
  },
  lastLoadedAt: {
    type: String,
    default: null,
  },
  selectedCandidateId: {
    type: String,
    default: null,
  },
  totalCandidates: {
    type: Number,
    default: 0,
  },
});

defineEmits(['refresh', 'select-candidate']);

function formatBytes(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
    return 'Unknown size';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function statusLabel(status) {
  switch (status) {
    case 'held':
      return 'Held';
    case 'rejected':
      return 'Rejected';
    case 'selected':
      return 'Selected';
    case 'downloading':
      return 'Downloading';
    case 'import_pending':
      return 'Import pending';
    case 'applied':
      return 'Applied';
    case 'failed':
      return 'Failed';
    default:
      return 'Pending';
  }
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not yet refreshed';
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Operator queue</p>
        <h3>Candidate list</h3>
      </div>
      <button type="button" class="secondary-button" @click="$emit('refresh')">Refresh</button>
    </div>

  <p class="review-summary-copy">{{ totalCandidates }} matching candidates</p>
  <p class="review-summary-copy">Last refreshed {{ formatTimestamp(lastLoadedAt) }}</p>

    <article class="panel-light error-panel" v-if="listError">
      <h3>Queue unavailable</h3>
      <p>{{ listError }}</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="isLoadingQueue && !candidates.length">
      <h3>Loading review queue</h3>
      <p>Fetching persisted import candidates from the current filters.</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!candidates.length">
      <h3>No candidates match the current filters</h3>
      <p>Persisted slskd responses will appear here once they enter the review queue.</p>
    </article>

    <div class="review-queue-stack" v-else>
      <button
        v-for="candidate in candidates"
        :key="candidate.id"
        type="button"
        class="review-list-item"
        :class="{ 'is-selected': candidate.id === selectedCandidateId }"
        @click="$emit('select-candidate', candidate.id)"
      >
        <div class="review-list-header">
          <div>
            <p class="eyebrow">{{ candidate.username }}</p>
            <h3>{{ candidate.folderPath || 'Root-level files' }}</h3>
          </div>
          <span class="review-status-pill" :class="`review-status-${candidate.status}`">
            {{ statusLabel(candidate.status) }}
          </span>
        </div>

        <dl class="review-meta-grid">
          <div>
            <dt>Files</dt>
            <dd>{{ candidate.fileCount }}</dd>
          </div>
          <div>
            <dt>Locked</dt>
            <dd>{{ candidate.lockedFileCount }}</dd>
          </div>
          <div>
            <dt>Total size</dt>
            <dd>{{ formatBytes(candidate.totalSizeBytes) }}</dd>
          </div>
          <div>
            <dt>Formats</dt>
            <dd>{{ candidate.normalizedPayload?.extensions?.join(', ') || 'Unknown' }}</dd>
          </div>
        </dl>
      </button>
    </div>
  </article>
</template>