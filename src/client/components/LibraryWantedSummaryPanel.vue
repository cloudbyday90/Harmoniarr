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
  getWantedReconciliationStatusClass,
  getWantedReconciliationStatusLabel,
} from '../lib/library-status-presentation.js';

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
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Monitored release gaps</h3>
        <p class="hx-card-subtitle" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <button type="button" @click="emit('refresh')">Refresh</button>
    </header>

    <div class="hx-card-body" v-if="errorMessage">
      <p class="error-copy">{{ errorMessage }}</p>
    </div>

    <div class="hx-card-body" v-else-if="isLoading">
      <p class="hx-text-muted">Loading monitored release gaps from canonical monitoring and library coverage.</p>
    </div>

    <div class="hx-card-body" v-else-if="summaryPayload">
      <article class="onboarding-step-card">
        <div class="review-detail-header">
          <div>
            <p>Current wanted state</p>
            <strong>{{ summaryPayload.summary.message }}</strong>
          </div>
          <span class="review-status-pill" :class="getWantedReconciliationStatusClass(summaryPayload.summary.status)">
            {{ getWantedReconciliationStatusLabel(summaryPayload.summary.status) }}
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
    </div>
  </article>
</template>
