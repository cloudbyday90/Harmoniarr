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
const props = defineProps({
  errorMessage: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  summaryPayload: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh']);

function summaryClass(status) {
  switch (status) {
    case 'complete':
      return 'review-status-selected';
    case 'partial':
    case 'incomplete':
      return 'review-status-pending';
    case 'review_required':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function summaryLabel(status) {
  switch (status) {
    case 'complete':
      return 'Complete';
    case 'partial':
      return 'Partial';
    case 'review_required':
      return 'Review required';
    case 'incomplete':
      return 'Incomplete';
    default:
      return 'Empty';
  }
}
</script>

<template>
  <article class="panel-light library-scan-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Library reconciliation</p>
        <h3>Current library coverage</h3>
        <p class="metadata-card-copy" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <button type="button" class="review-reset-button" @click="emit('refresh')">Refresh</button>
    </div>

    <article class="error-panel panel-light" v-if="errorMessage">
      <h3>Library reconciliation summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p v-else-if="isLoading">Loading current file and release reconciliation counts.</p>

    <template v-else-if="summaryPayload">
      <article class="onboarding-step-card">
        <div class="review-detail-header">
          <div>
            <p>Current reconciliation state</p>
            <strong>{{ summaryPayload.summary.message }}</strong>
          </div>
          <span class="review-status-pill" :class="summaryClass(summaryPayload.summary.status)">
            {{ summaryLabel(summaryPayload.summary.status) }}
          </span>
        </div>
        <dl class="review-meta-grid onboarding-meta-grid">
          <div>
            <dt>Observed files</dt>
            <dd>{{ summaryPayload.fileCounts.observed }}</dd>
          </div>
          <div>
            <dt>Matched files</dt>
            <dd>{{ summaryPayload.fileCounts.matched }}</dd>
          </div>
          <div>
            <dt>Ambiguous files</dt>
            <dd>{{ summaryPayload.fileCounts.ambiguous }}</dd>
          </div>
          <div>
            <dt>Unmatched files</dt>
            <dd>{{ summaryPayload.fileCounts.unmatched }}</dd>
          </div>
          <div>
            <dt>Complete releases</dt>
            <dd>{{ summaryPayload.releaseCounts.complete }}</dd>
          </div>
          <div>
            <dt>Partial releases</dt>
            <dd>{{ summaryPayload.releaseCounts.partial }}</dd>
          </div>
          <div>
            <dt>Duplicate releases</dt>
            <dd>{{ summaryPayload.releaseCounts.duplicate }}</dd>
          </div>
          <div>
            <dt>Last reconciled</dt>
            <dd>{{ summaryPayload.lastReconciledAt ?? 'Not yet recorded' }}</dd>
          </div>
        </dl>
      </article>
    </template>
  </article>
</template>