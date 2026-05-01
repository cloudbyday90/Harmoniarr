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

const props = defineProps({
  actionErrorMessage: {
    type: String,
    default: '',
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
  scanSummary: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'start']);

function readinessLabel(status) {
  return status === 'ready' ? 'Ready' : 'Blocked';
}

function readinessClass(status) {
  return status === 'ready'
    ? 'review-status-selected'
    : 'review-status-held';
}

function runStatusLabel(status) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'running':
      return 'Running';
    case 'pending':
      return 'Queued';
    case 'cancelled':
      return 'Cancelled';
    case 'failed':
      return 'Failed';
    default:
      return 'Not started';
  }
}

function runStatusClass(status) {
  switch (status) {
    case 'completed':
      return 'review-status-selected';
    case 'running':
    case 'pending':
      return 'review-status-pending';
    case 'cancelled':
    case 'failed':
      return 'review-status-failed';
    default:
      return 'review-status-held';
  }
}

function canStartScan(scanSummary) {
  if (!scanSummary || scanSummary.readiness?.status !== 'ready') {
    return false;
  }

  return !['pending', 'running'].includes(scanSummary.latestRun?.status);
}

function startLabel(scanSummary) {
  return scanSummary?.latestRun ? 'Run again' : 'Start scan';
}
</script>

<template>
  <article class="panel-light library-scan-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">{{ isSetupMode ? 'First library scan' : 'Library scan status' }}</p>
        <h3>Existing library readiness</h3>
        <p class="metadata-card-copy" v-if="scanSummary">{{ scanSummary.summary.message }}</p>
      </div>
      <div class="library-scan-actions">
        <button
          v-if="canStartScan(scanSummary)"
          type="button"
          class="library-scan-start-button"
          :disabled="isStarting"
          @click="emit('start')"
        >
          {{ isStarting ? 'Starting…' : startLabel(scanSummary) }}
        </button>
        <button type="button" class="review-reset-button" @click="emit('refresh')">Refresh</button>
      </div>
    </div>

    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="error-panel panel-light" v-if="errorMessage">
      <h3>Library scan summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p v-else-if="isLoading">Checking whether the configured library root is ready and whether any prior scan has been recorded.</p>

    <template v-else-if="scanSummary">
      <div class="pill-row onboarding-pill-row">
        <div class="pill">
          <span>Readiness</span>
          <strong>{{ readinessLabel(scanSummary.readiness.status) }}</strong>
        </div>
        <div class="pill">
          <span>Latest run</span>
          <strong>{{ runStatusLabel(scanSummary.latestRun?.status) }}</strong>
        </div>
      </div>

      <div class="library-scan-summary-grid">
        <article class="onboarding-step-card">
          <div class="review-detail-header">
            <div>
              <p>Path readiness</p>
              <strong>{{ scanSummary.readiness.message }}</strong>
            </div>
            <span class="review-status-pill" :class="readinessClass(scanSummary.readiness.status)">
              {{ readinessLabel(scanSummary.readiness.status) }}
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
              <p>Latest recorded run</p>
              <strong>{{ scanSummary.summary.message }}</strong>
            </div>
            <span class="review-status-pill" :class="runStatusClass(scanSummary.latestRun?.status)">
              {{ runStatusLabel(scanSummary.latestRun?.status) }}
            </span>
          </div>
          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Started</dt>
              <dd>{{ scanSummary.latestRun?.startedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{{ scanSummary.latestRun?.finishedAt ?? 'Not yet recorded' }}</dd>
            </div>
            <div>
              <dt>Files seen</dt>
              <dd>{{ scanSummary.latestRun?.filesSeen ?? 'Unavailable' }}</dd>
            </div>
            <div>
              <dt>Files matched</dt>
              <dd>{{ scanSummary.latestRun?.filesMatched ?? 'Unavailable' }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </template>
  </article>
</template>