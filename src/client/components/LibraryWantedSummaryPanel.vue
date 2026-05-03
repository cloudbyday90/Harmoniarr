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
      return 'review-status-pending';
    case 'wanted':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function summaryLabel(status) {
  switch (status) {
    case 'complete':
      return 'Satisfied';
    case 'partial':
      return 'Partially missing';
    case 'wanted':
      return 'Wanted';
    default:
      return 'Empty';
  }
}
</script>

<template>
  <article class="panel-light library-scan-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Wanted reconciliation</p>
        <h3>Monitored release gaps</h3>
        <p class="metadata-card-copy" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <button type="button" class="review-reset-button" @click="emit('refresh')">Refresh</button>
    </div>

    <article class="error-panel panel-light" v-if="errorMessage">
      <h3>Wanted summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p v-else-if="isLoading">Loading monitored release gaps from canonical monitoring and library coverage.</p>

    <template v-else-if="summaryPayload">
      <article class="onboarding-step-card">
        <div class="review-detail-header">
          <div>
            <p>Current wanted state</p>
            <strong>{{ summaryPayload.summary.message }}</strong>
          </div>
          <span class="review-status-pill" :class="summaryClass(summaryPayload.summary.status)">
            {{ summaryLabel(summaryPayload.summary.status) }}
          </span>
        </div>
        <dl class="review-meta-grid onboarding-meta-grid">
          <div>
            <dt>Monitored artists</dt>
            <dd>{{ summaryPayload.monitoredArtistCount }}</dd>
          </div>
          <div>
            <dt>Total wanted releases</dt>
            <dd>{{ summaryPayload.releaseCounts.totalWanted }}</dd>
          </div>
          <div>
            <dt>Missing releases</dt>
            <dd>{{ summaryPayload.releaseCounts.missing }}</dd>
          </div>
          <div>
            <dt>Partial releases</dt>
            <dd>{{ summaryPayload.releaseCounts.partial }}</dd>
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
