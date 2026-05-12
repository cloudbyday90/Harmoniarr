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
import {
  canStartDiscoveryDispatch,
  getDiscoveryHeartbeatOutcomeLabel,
  getDiscoveryHeartbeatSkipReasonLabel,
  getDiscoveryQueueStatusClass,
  getDiscoveryQueueStatusLabel,
  getTriggerSourceLabel,
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
</script>

<template>
  <article id="library-discovery-panel" class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Discovery queue</h3>
        <p class="hx-card-subtitle" v-if="summaryPayload">{{ summaryPayload.summary.message }}</p>
      </div>
      <div class="hx-card-actions">
        <button
          v-if="canStartDiscoveryDispatch(summaryPayload)"
          type="button"
          class="library-scan-start-button"
          :disabled="isStarting"
          @click="emit('start')"
        >
          {{ isStarting ? 'Dispatching…' : 'Dispatch now' }}
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
      <p class="hx-text-muted">Loading discovery queue state and cooldown eligibility.</p>
    </div>

    <div class="hx-card-body" v-else-if="summaryPayload">
      <div class="pill-row onboarding-pill-row">
        <div class="pill">
          <span>Queue state</span>
          <strong>{{ getDiscoveryQueueStatusLabel(summaryPayload.summary.status) }}</strong>
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
          <span class="review-status-pill" :class="getDiscoveryQueueStatusClass(summaryPayload.summary.status)">
            {{ getDiscoveryQueueStatusLabel(summaryPayload.summary.status) }}
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
            <dd>{{ getDiscoveryHeartbeatOutcomeLabel(summaryPayload.heartbeat?.state) }}</dd>
          </div>
          <div>
            <dt>Last automatic check</dt>
            <dd>{{ summaryPayload.heartbeat?.state?.lastTickAt ?? 'Not yet recorded' }}</dd>
          </div>
          <div>
            <dt>Last skip reason</dt>
            <dd>{{ getDiscoveryHeartbeatSkipReasonLabel(summaryPayload.heartbeat?.state?.lastSkipReason) }}</dd>
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
            <dd>{{ getTriggerSourceLabel(currentRun?.triggerSource) }}</dd>
          </div>
        </dl>
      </article>
    </div>
  </article>
</template>
