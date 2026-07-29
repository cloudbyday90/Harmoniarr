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
import {
  candidateStatusLabel,
  formatBytes,
  formatTimestamp,
  formatUploaderReviewState,
  formatUploaderReviewTone,
} from '../lib/import-candidate-presentation.js';

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
</script>

<template>
  <article class="review-panel import-candidate-queue-list">
    <div class="section-header">
      <div>
        <p class="eyebrow">Available matches</p>
        <h3>Matching results</h3>
      </div>
      <button type="button" class="secondary-button" @click="$emit('refresh')">Refresh</button>
    </div>

  <p class="review-summary-copy">{{ totalCandidates }} matching {{ totalCandidates === 1 ? 'result' : 'results' }}</p>
  <p class="review-summary-copy">Last refreshed {{ formatTimestamp(lastLoadedAt, 'Not yet refreshed') }}</p>

    <article class="error-panel" v-if="listError" role="alert">
      <h3>Results unavailable</h3>
      <p>{{ listError }}</p>
    </article>

    <article class="review-empty-state" v-else-if="isLoadingQueue && !candidates.length">
      <h3>Loading matches</h3>
      <p>Loading matches…</p>
    </article>

    <article class="review-empty-state" v-else-if="!candidates.length">
      <h3>No matches fit these filters</h3>
      <p>Try another source, folder, or status.</p>
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
            <div class="eyebrow-row">
              <p class="eyebrow">{{ candidate.username }}</p>
              <span
                v-if="candidate.uploaderReputation"
                class="review-status-pill"
                :class="`review-reputation-${formatUploaderReviewTone(candidate.uploaderReputation.reviewState)}`"
              >{{ formatUploaderReviewState(candidate.uploaderReputation.reviewState) }}</span>
            </div>
            <h3>{{ candidate.folderPath || 'Root-level files' }}</h3>
          </div>
          <span class="review-status-pill" :class="`review-status-${candidate.status}`">
            {{ candidateStatusLabel(candidate.status) }}
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

<style scoped>
.import-candidate-queue-list {
  padding-top: var(--hx-space-4);
  border-top: 1px solid var(--hx-border-subtle);
}

.import-candidate-queue-list .error-panel {
  padding: var(--hx-space-4);
  border: 1px solid var(--hx-danger);
  border-radius: var(--hx-radius-sm);
  background: var(--hx-danger-soft);
}
</style>
