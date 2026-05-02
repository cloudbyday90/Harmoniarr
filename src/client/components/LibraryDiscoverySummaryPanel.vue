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
  getOperationRunStatusClass,
  getOperationRunStatusLabel,
} from '../lib/operation-run-status.js';

const props = defineProps({
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
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  summaryPayload: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(['refresh', 'start']);

function summaryClass(status) {
  switch (status) {
    case 'ready':
      return 'review-status-selected';
    case 'cooldown':
      return 'review-status-pending';
    case 'blocked':
      return 'review-status-held';
    default:
      return 'review-status-held';
  }
}

function summaryLabel(status) {
  switch (status) {
    case 'ready':
      return 'Ready';
    case 'cooldown':
      return 'Cooling down';
    case 'blocked':
      return 'Blocked';
    default:
      return 'Empty';
  }
}

function triggerSourceLabel(value) {
  switch (value) {
    case 'heartbeat':
      return 'Heartbeat';
    case 'manual':
      return 'Manual';
    default:
      return 'Unavailable';
  }
}

function heartbeatOutcomeLabel(state) {
  switch (state?.lastOutcome) {
    case 'started':
      return 'Started automatic run';
    case 'error':
      return 'Automatic run errored';
    case 'skipped':
      return 'Skipped automatic run';
    default:
      return 'Not yet recorded';
  }
}

function heartbeatSkipReasonLabel(reason) {
  switch (reason) {
    case 'not_due':
      return 'Not due';
    case 'run_in_progress':
      return 'Run in progress';
    case 'tick_in_progress':
      return 'Tick already running';
    case 'error':
      return 'Error';
    default:
      return 'None';
  }
}

function canStartDispatch(summaryPayload) {
  if (!summaryPayload) {
    return false;
  }

  if ((summaryPayload.requestCounts?.totalRequests ?? 0) === 0) {
    return false;
  }

  return !['pending', 'running'].includes(summaryPayload.latestRun?.status);
}
</script>

<template>
  <article class="panel-light library-scan-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Discovery intent</p>
        <h3>Search eligibility queue</h3>
        <p class="metadata-card-copy" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <div class="library-scan-actions">
        <button
          v-if="canStartDispatch(summaryPayload)"
          type="button"
          class="library-scan-start-button"
          :disabled="isStarting"
          @click="emit('start')"
        >
          {{ isStarting ? 'Dispatching…' : 'Dispatch now' }}
        </button>
        <button type="button" class="review-reset-button" @click="emit('refresh')">Refresh</button>
      </div>
    </div>

    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>
    <p class="error-copy" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>

    <article class="error-panel panel-light" v-if="errorMessage">
      <h3>Discovery summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p v-else-if="isLoading">Loading release-date and cooldown eligibility for discovery requests.</p>

    <template v-else-if="summaryPayload">
      <div class="pill-row onboarding-pill-row">
        <div class="pill">
          <span>Queue state</span>
          <strong>{{ summaryLabel(summaryPayload.summary.status) }}</strong>
        </div>
        <div class="pill">
          <span>Displayed run</span>
          <strong>{{ getOperationRunStatusLabel(currentRun?.status) }}</strong>
        </div>
      </div>

      <article class="onboarding-step-card">
        <div class="review-detail-header">
          <div>
            <p>Current discovery state</p>
            <strong>{{ summaryPayload.summary.message }}</strong>
          </div>
          <span class="review-status-pill" :class="summaryClass(summaryPayload.summary.status)">
            {{ summaryLabel(summaryPayload.summary.status) }}
          </span>
        </div>
        <dl class="review-meta-grid onboarding-meta-grid">
          <div>
            <dt>Total requests</dt>
            <dd>{{ summaryPayload.requestCounts.totalRequests }}</dd>
          </div>
          <div>
            <dt>Ready now</dt>
            <dd>{{ summaryPayload.requestCounts.ready }}</dd>
          </div>
          <div>
            <dt>Cooling down</dt>
            <dd>{{ summaryPayload.requestCounts.cooldown }}</dd>
          </div>
          <div>
            <dt>Blocked by date</dt>
            <dd>{{ summaryPayload.requestCounts.blocked }}</dd>
          </div>
          <div>
            <dt>Next eligible</dt>
            <dd>{{ summaryPayload.nextEligibleAt ?? 'Ready now or unavailable' }}</dd>
          </div>
          <div>
            <dt>Automatic cadence</dt>
            <dd>{{ summaryPayload.heartbeat?.intervalLabel ?? 'Unavailable' }}</dd>
          </div>
          <div>
            <dt>Config source</dt>
            <dd>{{ summaryPayload.heartbeat?.source ?? 'Unavailable' }}</dd>
          </div>
          <div>
            <dt>Last evaluated</dt>
            <dd>{{ summaryPayload.lastEvaluatedAt ?? 'Not yet recorded' }}</dd>
          </div>
          <div>
            <dt>Last automatic outcome</dt>
            <dd>{{ heartbeatOutcomeLabel(summaryPayload.heartbeat?.state) }}</dd>
          </div>
          <div>
            <dt>Last automatic check</dt>
            <dd>{{ summaryPayload.heartbeat?.state?.lastTickAt ?? 'Not yet recorded' }}</dd>
          </div>
          <div>
            <dt>Last skip reason</dt>
            <dd>{{ heartbeatSkipReasonLabel(summaryPayload.heartbeat?.state?.lastSkipReason) }}</dd>
          </div>
        </dl>
      </article>

      <article class="onboarding-step-card">
        <div class="review-detail-header">
          <div>
            <p>Displayed dispatch run</p>
            <strong>
              {{ currentRun
                ? `${currentRun.dispatchedCount ?? 0} search dispatches completed in the displayed run.`
                : 'No discovery dispatch has been recorded yet.' }}
            </strong>
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
            <dt>Searches dispatched</dt>
            <dd>{{ currentRun?.dispatchedCount ?? 'Unavailable' }}</dd>
          </div>
          <div>
            <dt>Import candidates</dt>
            <dd>{{ currentRun?.candidateCount ?? 'Unavailable' }}</dd>
          </div>
          <div>
            <dt>Triggered by</dt>
            <dd>{{ triggerSourceLabel(currentRun?.triggerSource) }}</dd>
          </div>
        </dl>
      </article>
    </template>
  </article>
</template>