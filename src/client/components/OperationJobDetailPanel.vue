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
import { RouterLink } from 'vue-router';
import OperationRunDrilldownPanel from './OperationRunDrilldownPanel.vue';
import {
  getOperationRunDrilldownSummaryKeys,
} from '../lib/operation-run-drilldown-presentation.js';
import {
  buildOperationRunLinkTarget,
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
  getOperationRunDescriptor,
} from '../lib/operation-run-link-targets.js';
import {
  getOperationRunStatusLabel,
} from '../lib/operation-run-status.js';
import {
  buildOperationSummaryEntries,
  formatLeaseStateLabel,
  formatLeaseStateTone,
  formatOperationRunStatusTone,
  formatOperationSummaryLabel,
  formatOperationSummaryValue,
  formatOperationTimestamp,
  formatOperationTimestampShort,
  getOperationRunDurationLabel,
  getOperationRunNextStep,
  getOperationRunOperatorSummary,
} from '../lib/operation-run-presentation.js';

const props = defineProps({
  run: {
    type: Object,
    default: null,
  },
  detail: {
    type: Object,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
  isCancelling: {
    type: Boolean,
    default: false,
  },
  isRetrying: {
    type: Boolean,
    default: false,
  },
  cancellationError: {
    type: String,
    default: '',
  },
  retryError: {
    type: String,
    default: '',
  },
  detailError: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['request-cancel', 'request-retry']);

const lease = computed(() => props.run?.lease ?? null);
const canCancel = computed(() => canRequestOperationRunCancellation(props.run));
const canRetry = computed(() => canRequestOperationRunRetry(props.run));
const workflowTarget = computed(() => buildOperationRunLinkTarget({
  operationType: props.run?.operationType,
  runId: props.run?.id,
}));
const summaryEntries = computed(() => {
  const hiddenKeys = new Set(getOperationRunDrilldownSummaryKeys(props.run));
  return buildOperationSummaryEntries(props.run?.summary)
    .filter((entry) => !hiddenKeys.has(entry.key));
});
const hasRawSummary = computed(() => Object.keys(props.run?.summary ?? {}).length > 0
  && summaryEntries.value.length === 0
  && getOperationRunDrilldownSummaryKeys(props.run).length === 0);

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function runDuration(run) {
  return getOperationRunDurationLabel(run);
}
</script>

<template>
  <article id="operation-run-detail-panel" class="hx-card">
    <header class="hx-card-header">
      <div>
        <h3 class="hx-card-title">Job detail</h3>
        <p class="hx-card-subtitle" v-if="!run && !isLoading">Select a job to see what happened and what to do next.</p>
      </div>
      <div class="hx-card-actions" v-if="run">
        <button
          v-if="canCancel"
          type="button"
          class="hx-btn"
          :title="isCancelling ? 'Cancellation in progress' : 'Request cancellation of this run'"
          @click="emit('request-cancel')"
          :disabled="isCancelling"
        >
          {{ isCancelling ? 'Cancelling…' : 'Cancel run' }}
        </button>
        <button
          v-if="canRetry"
          type="button"
          class="hx-btn"
          :title="isRetrying ? 'Retry in progress' : 'Queue a fresh attempt for this run'"
          @click="emit('request-retry')"
          :disabled="isRetrying"
        >
          {{ isRetrying ? 'Retrying…' : 'Retry' }}
        </button>
        <RouterLink v-if="workflowTarget" class="hx-btn" :to="workflowTarget.to">
          {{ workflowTarget.label }}
        </RouterLink>
      </div>
    </header>

    <div class="hx-card-body">
      <div v-if="cancellationError || retryError || detailError" class="ops-error-strip">
        <span v-if="cancellationError" class="hx-pill" data-tone="danger">{{ cancellationError }}</span>
        <span v-if="retryError" class="hx-pill" data-tone="danger">{{ retryError }}</span>
        <span v-if="detailError" class="hx-pill" data-tone="danger">{{ detailError }}</span>
      </div>

      <p v-if="isLoading" class="hx-text-muted" aria-live="polite" aria-busy="true">Loading run detail and timeline…</p>

      <template v-else-if="run">
        <div class="ops-run-detail-header">
          <div>
            <strong class="ops-run-detail-name">{{ operationTitle(run.operationType) }}</strong>
            <p class="hx-text-muted">
              Started {{ formatOperationTimestampShort(run.startedAt) }}<template v-if="runDuration(run)"> · {{ runDuration(run) }}</template><template v-if="run.triggeredByUserId"> · by {{ run.triggeredByUserId }}</template>
            </p>
          </div>
          <span class="hx-pill" :data-tone="formatOperationRunStatusTone(run.status)">
            {{ getOperationRunStatusLabel(run.status, { defaultLabel: 'Unknown' }) }}
          </span>
        </div>

        <div class="operations-insight-grid">
          <article class="operations-insight-card" v-if="run.errorMessage">
            <p class="ops-section-label">Error detail</p>
            <strong>{{ run.errorMessage }}</strong>
          </article>
          <article class="operations-insight-card" v-if="!run.errorMessage">
            <p class="ops-section-label">What happened</p>
            <strong>{{ getOperationRunOperatorSummary(run) }}</strong>
          </article>
          <article class="operations-insight-card">
            <p class="ops-section-label">What to do next</p>
            <strong>{{ getOperationRunNextStep(run) }}</strong>
          </article>
        </div>

        <div class="ops-timeline" v-if="detail?.auditEvents?.length">
          <p class="ops-section-label">Run timeline</p>
          <div class="ops-timeline-list">
            <div class="ops-timeline-event" v-for="event in detail.auditEvents" :key="event.id">
                <span class="ops-timeline-time">{{ formatOperationTimestampShort(event.occurredAt) }}</span>
              <span class="ops-timeline-dot"></span>
              <div class="ops-timeline-body">
                <strong>{{ event.summary }}</strong>
              </div>
            </div>
          </div>
        </div>

        <OperationRunDrilldownPanel :run="run" />

        <details class="ops-technical-details">
          <summary>Technical detail</summary>
          <dl class="ops-meta-dl">
            <div>
              <dt>Operation type</dt>
              <dd>{{ operationTitle(run.operationType) }}</dd>
            </div>
            <div>
              <dt>Run ID</dt>
              <dd class="ops-run-id">{{ run.id }}</dd>
            </div>
            <div>
              <dt>Started</dt>
              <dd>{{ formatOperationTimestamp(run.startedAt) }}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{{ formatOperationTimestamp(run.finishedAt) }}</dd>
            </div>
            <div v-if="run.attemptCount || run.maxAttempts">
              <dt>Attempts</dt>
              <dd>{{ run.attemptCount ?? 0 }} of {{ run.maxAttempts ?? 1 }}</dd>
            </div>
            <div v-if="run.nextAttemptAt">
              <dt>Next attempt</dt>
              <dd>{{ formatOperationTimestamp(run.nextAttemptAt) }}</dd>
            </div>
            <div v-if="run.cancelRequestedAt">
              <dt>Cancellation requested</dt>
              <dd>{{ formatOperationTimestamp(run.cancelRequestedAt) }}</dd>
            </div>
            <div v-if="run.cancelRequestedByUserId">
              <dt>Cancelled by</dt>
              <dd>{{ run.cancelRequestedByUserId }}</dd>
            </div>
            <div v-if="run.claimedAt">
              <dt>Processing started</dt>
              <dd>{{ formatOperationTimestamp(run.claimedAt) }}</dd>
            </div>
            <div v-if="run.claimedByInstanceId">
              <dt>Worker instance</dt>
              <dd>{{ run.claimedByInstanceId }}</dd>
            </div>
            <div v-if="lease">
              <dt>Lock state</dt>
              <dd>
                <span class="hx-pill" :data-tone="formatLeaseStateTone(lease.state)">
                  {{ formatLeaseStateLabel(lease.state) }}
                </span>
              </dd>
            </div>
            <div v-if="lease">
              <dt>Lock held by</dt>
              <dd>{{ lease.ownerInstanceId }}</dd>
            </div>
            <div v-if="lease">
              <dt>Last check-in</dt>
              <dd>{{ formatOperationTimestamp(lease.heartbeatAt) }}</dd>
            </div>
            <div v-if="lease">
              <dt>Lock expiry</dt>
              <dd>{{ formatOperationTimestamp(lease.expiresAt) }}</dd>
            </div>
          </dl>

          <div v-if="summaryEntries.length" class="ops-sub-section">
            <p class="ops-section-label">Recorded outcome</p>
            <dl class="ops-meta-dl">
              <div v-for="entry in summaryEntries" :key="entry.key">
                <dt>{{ formatOperationSummaryLabel(entry.key) }}</dt>
                <dd>{{ formatOperationSummaryValue(entry.value) }}</dd>
              </div>
            </dl>
          </div>

          <div v-if="hasRawSummary" class="ops-sub-section">
            <p class="ops-section-label">Raw JSON</p>
            <pre class="ops-pre">{{ JSON.stringify(run.summary, null, 2) }}</pre>
          </div>
        </details>
      </template>

      <p v-else class="hx-text-muted">Select a job from the queue to see what happened, what to do next, and the full run detail.</p>
    </div>
  </article>
</template>
