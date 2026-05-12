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
import { RouterLink } from 'vue-router';
import {
  getOperationRunStatusClass,
  getOperationRunStatusLabel,
} from '../lib/operation-run-status.js';
import {
  canStartLibraryScan,
  getLibraryScanReadinessClass,
  getLibraryScanReadinessLabel,
  getLibraryScanStartLabel,
} from '../lib/library-status-presentation.js';

defineProps({
  actionErrorMessage: {
    type: String,
    default: '',
  },
  currentRun: {
    type: Object,
    default: null,
  },
  errorMessage: {
    type: String,
    default: '',
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isStarting: {
    type: Boolean,
    default: false,
  },
  isSetupMode: {
    type: Boolean,
    default: false,
  },
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  scanSummary: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'start']);
</script>

<template>
  <article class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">{{ isSetupMode ? 'Initial library scan' : 'Library scan' }}</h3>
        <p class="hx-card-subtitle" v-if="scanSummary">{{ scanSummary.summary.message }}</p>
      </div>
      <div class="hx-card-actions">
        <button
          v-if="canStartLibraryScan(scanSummary)"
          type="button"
          class="library-scan-start-button"
          :disabled="isStarting"
          @click="emit('start')"
        >
          {{ isStarting ? 'Starting…' : getLibraryScanStartLabel(scanSummary) }}
        </button>
        <button type="button" @click="emit('refresh')">Refresh</button>
      </div>
    </header>

    <div class="hx-card-body" v-if="actionErrorMessage || runDetailErrorMessage">
      <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>
      <p class="error-copy" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    </div>

    <div class="hx-card-body" v-if="errorMessage">
      <p class="error-copy">{{ errorMessage }}</p>
    </div>

    <div class="hx-card-body" v-else-if="isLoading">
      <p class="hx-text-muted">Checking whether the configured library root is ready and whether any prior scan has been recorded.</p>
    </div>

    <div class="hx-card-body" v-else-if="scanSummary">
      <div class="pill-row onboarding-pill-row">
        <div class="pill">
          <span>Readiness</span>
          <strong>{{ getLibraryScanReadinessLabel(scanSummary.readiness.status) }}</strong>
        </div>
        <div class="pill">
          <span>Displayed run</span>
          <strong>{{ getOperationRunStatusLabel(currentRun?.status) }}</strong>
        </div>
      </div>

      <div class="library-scan-summary-grid">
        <article class="onboarding-step-card">
          <div class="review-detail-header">
            <div>
              <p>Path readiness</p>
              <strong>{{ scanSummary.readiness.message }}</strong>
            </div>
            <span class="review-status-pill" :class="getLibraryScanReadinessClass(scanSummary.readiness.status)">
              {{ getLibraryScanReadinessLabel(scanSummary.readiness.status) }}
            </span>
          </div>
          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Library root</dt>
              <dd>{{ scanSummary.libraryRoot ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Checked</dt>
              <dd>{{ scanSummary.checkedAt }}</dd>
            </div>
          </dl>
          <RouterLink
            v-if="scanSummary.nextAction"
            :to="scanSummary.nextAction.to"
            class="onboarding-action-link"
          >
            {{ scanSummary.nextAction.label }}
          </RouterLink>
        </article>

        <article class="onboarding-step-card">
          <div class="review-detail-header">
            <div>
              <p>Displayed recorded run</p>
              <strong>{{ scanSummary.summary.message }}</strong>
            </div>
            <span class="review-status-pill" :class="getOperationRunStatusClass(currentRun?.status)">
              {{ getOperationRunStatusLabel(currentRun?.status) }}
            </span>
          </div>
          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Started</dt>
              <dd>{{ currentRun?.startedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{{ currentRun?.finishedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Files seen</dt>
              <dd>{{ currentRun?.filesSeen ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Files matched</dt>
              <dd>{{ currentRun?.filesMatched ?? 'Unavailable' }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  </article>
</template>
