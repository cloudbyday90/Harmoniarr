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
import { computed, nextTick, onMounted, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useOperationHistory } from '../composables/useOperationHistory.js';
import {
  buildOperationsRouteQuery,
  getOperationsRouteStateKey,
  normalizeOperationsRouteState,
} from '../lib/operations-route-state.js';
import {
  buildOperationRunLinkTarget,
  canRequestOperationRunCancellation,
  canRequestOperationRunRetry,
  getOperationRunDescriptor,
} from '../lib/operation-run-link-targets.js';
import {
  getOperationRunStatusClass,
  getOperationRunStatusLabel,
} from '../lib/operation-run-status.js';
import {
  getOperationRunAttentionLabel,
  getOperationRunNextStep,
  getOperationRunOperatorSummary,
  groupOperationRunsForDisplay,
} from '../lib/operation-run-presentation.js';

const route = useRoute();
const router = useRouter();
const operationDetailHash = '#operation-run-detail-panel';

const {
  cancellationErrorMessage,
  detailErrorMessage,
  errorMessage,
  isCancellingRun,
  isLoadingDetail,
  isLoadingHistory,
  isRetryingRun,
  loadOperationHistory,
  requestCancellation,
  requestRetry,
  retryErrorMessage,
  runs,
  selectedRunDetail,
  selectedRunId,
  selectOperationRun,
} = useOperationHistory();

const operationsRouteState = computed(() => normalizeOperationsRouteState(route.query));
const selectedRun = computed(() => selectedRunDetail.value?.run ?? null);
const selectedRunLease = computed(() => selectedRun.value?.lease ?? null);
const canRequestCancellation = computed(() => canRequestOperationRunCancellation(selectedRun.value));
const canRequestRetry = computed(() => canRequestOperationRunRetry(selectedRun.value));
const groupedRuns = computed(() => groupOperationRunsForDisplay(runs.value));
const selectedRunWorkflowTarget = computed(() => buildOperationRunLinkTarget({
  operationType: selectedRun.value?.operationType,
  runId: selectedRun.value?.id,
}));

function buildMergedOperationsRouteQuery(nextState) {
  const query = { ...route.query };
  delete query.runId;

  return {
    ...query,
    ...buildOperationsRouteQuery({
      ...operationsRouteState.value,
      ...nextState,
    }),
  };
}

async function replaceOperationsRouteState(nextState, { hash = route.hash } = {}) {
  const normalizedNextState = normalizeOperationsRouteState({
    ...operationsRouteState.value,
    ...nextState,
  });

  if (
    getOperationsRouteStateKey(normalizedNextState) === getOperationsRouteStateKey(operationsRouteState.value)
    && hash === route.hash
  ) {
    return;
  }

  await router.replace({
    hash,
    query: buildMergedOperationsRouteQuery(normalizedNextState),
  });
}

function scrollDetailIntoView() {
  if (typeof document === 'undefined') {
    return;
  }

  document.getElementById('operation-run-detail-panel')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function formatTimestamp(value) {
  if (!value) {
    return 'Not yet recorded';
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function leaseStateLabel(state) {
  switch (state) {
    case 'active':
      return 'Active';
    case 'expired':
      return 'Expired';
    case 'released':
      return 'Released';
    default:
      return 'Unknown';
  }
}

function leaseStateClass(state) {
  switch (state) {
    case 'active':
      return 'review-status-pending';
    case 'expired':
      return 'review-status-failed';
    case 'released':
      return 'review-status-selected';
    default:
      return 'review-status-held';
  }
}

function runLinkTarget(run) {
  return buildOperationRunLinkTarget({
    operationType: run?.operationType,
    runId: run?.id,
  });
}

function summaryEntries(summary) {
  return Object.entries(summary ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value }))
    .slice(0, 12);
}

function formatSummaryLabel(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatSummaryValue(value) {
  if (Array.isArray(value)) {
    return `${value.length} record${value.length === 1 ? '' : 's'}`;
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'object') {
    return 'Structured data recorded';
  }

  return String(value);
}

async function handleSelectRun(runId) {
  await selectOperationRun({ runId });
  await replaceOperationsRouteState({ runId }, { hash: operationDetailHash });
  await nextTick();
  scrollDetailIntoView();
}

async function handleRequestCancellation() {
  if (!selectedRun.value?.id) {
    return;
  }

  await requestCancellation({ runId: selectedRun.value.id });
}

async function handleRequestRetry() {
  if (!selectedRun.value?.id) {
    return;
  }

  await requestRetry({ runId: selectedRun.value.id });
}

onMounted(() => {
  void loadOperationHistory({ preferredRunId: operationsRouteState.value.runId || null });
});

watch(
  () => operationsRouteState.value.runId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) {
      return;
    }

    if (!nextRunId) {
      void loadOperationHistory({ preferredRunId: null });
      return;
    }

    if (nextRunId !== selectedRunId.value) {
      void selectOperationRun({ runId: nextRunId });
    }

    void nextTick().then(scrollDetailIntoView);
  },
);
</script>

<template>
  <section class="page-stack operations-layout">
    <article class="panel-dark hero-card compact">
      <p class="eyebrow">Background work</p>
      <h2>Queued, active, and completed automation</h2>
      <p>
        Start with the runs that need attention, monitor work that is still moving, and open technical detail only when you need deeper diagnostics.
      </p>
    </article>

    <div class="operations-grid">
      <article class="panel-light">
        <div class="section-header">
          <div>
            <p class="eyebrow">Recent jobs</p>
            <h3>Run monitor</h3>
          </div>
          <button type="button" class="secondary-button" @click="loadOperationHistory({ preferredRunId: selectedRunId || null })" :disabled="isLoadingHistory">
            {{ isLoadingHistory ? 'Refreshing...' : 'Refresh jobs' }}
          </button>
        </div>

        <article class="error-panel panel-light" v-if="errorMessage">
          <h3>Operation history unavailable</h3>
          <p>{{ errorMessage }}</p>
        </article>

        <p v-else-if="isLoadingHistory">Loading queued, active, and completed background work.</p>

        <p class="metadata-card-copy" v-else-if="!runs.length">No background work has been recorded yet.</p>

        <div class="operations-group-list" v-else>
          <section class="operations-group" v-for="group in groupedRuns" :key="group.id">
            <div class="section-header">
              <div>
                <p class="eyebrow">{{ group.title }}</p>
                <p class="metadata-card-copy">{{ group.description }}</p>
              </div>
            </div>

            <div class="session-list">
              <article class="session-row" v-for="run in group.runs" :key="run.id">
                <div>
                  <p class="eyebrow">{{ getOperationRunAttentionLabel(run) }}</p>
                  <strong>{{ operationTitle(run.operationType) }}</strong>
                  <p class="metadata-card-copy">{{ getOperationRunOperatorSummary(run) }}</p>
                  <p class="muted-copy">Run ID {{ run.id }}</p>
                  <p class="muted-copy">Started {{ formatTimestamp(run.startedAt) }}</p>
                  <p class="muted-copy" v-if="run.finishedAt">Finished {{ formatTimestamp(run.finishedAt) }}</p>
                  <p class="muted-copy" v-if="run.maxAttempts || run.attemptCount">
                    Attempt {{ run.attemptCount ?? 0 }} of {{ run.maxAttempts ?? 1 }}
                  </p>
                  <p class="muted-copy" v-if="run.cancelRequestedAt">
                    Cancellation requested {{ formatTimestamp(run.cancelRequestedAt) }}
                  </p>
                  <p class="muted-copy" v-if="run.status === 'pending' && run.nextAttemptAt">
                    Next attempt {{ formatTimestamp(run.nextAttemptAt) }}
                  </p>
                  <p class="muted-copy" v-if="run.errorMessage && (run.status === 'failed' || run.status === 'cancelled')">
                    Exact failure detail is available in the selected run panel.
                  </p>
                </div>
                <div class="session-actions operations-actions">
                  <span class="review-status-pill" :class="getOperationRunStatusClass(run.status)">
                    {{ getOperationRunStatusLabel(run.status, { defaultLabel: 'Unknown' }) }}
                  </span>
                  <button type="button" class="secondary-button" @click="handleSelectRun(run.id)">
                    View detail
                  </button>
                  <RouterLink v-if="runLinkTarget(run)" class="secondary-button" :to="runLinkTarget(run).to">
                    {{ runLinkTarget(run).label }}
                  </RouterLink>
                </div>
              </article>
            </div>
          </section>
        </div>
      </article>

      <article id="operation-run-detail-panel" class="panel-light">
        <div class="section-header">
          <div>
            <p class="eyebrow">Selected job</p>
            <h3>Run detail</h3>
          </div>
          <div class="operations-actions">
            <button
              v-if="canRequestCancellation"
              type="button"
              class="secondary-button"
              @click="handleRequestCancellation"
              :disabled="isCancellingRun"
            >
              {{ isCancellingRun ? 'Requesting cancel...' : 'Request cancel' }}
            </button>
            <button
              v-if="canRequestRetry"
              type="button"
              class="secondary-button"
              @click="handleRequestRetry"
              :disabled="isRetryingRun"
            >
              {{ isRetryingRun ? 'Scheduling retry...' : 'Retry run' }}
            </button>
            <RouterLink v-if="selectedRunWorkflowTarget" class="secondary-button" :to="selectedRunWorkflowTarget.to">
              {{ selectedRunWorkflowTarget.label }}
            </RouterLink>
          </div>
        </div>

        <p class="error-copy" v-if="cancellationErrorMessage">{{ cancellationErrorMessage }}</p>
        <p class="error-copy" v-if="retryErrorMessage">{{ retryErrorMessage }}</p>
        <p class="error-copy" v-if="detailErrorMessage">{{ detailErrorMessage }}</p>

        <p v-else-if="isLoadingDetail">Loading the selected run and its timeline.</p>

        <p class="metadata-card-copy" v-else-if="!selectedRun">Select a run to review what happened, what to do next, and the technical detail behind it.</p>

        <template v-else>
          <div class="review-detail-header">
            <div>
              <p class="eyebrow">{{ getOperationRunAttentionLabel(selectedRun) }}</p>
              <h3>{{ operationTitle(selectedRun.operationType) }}</h3>
              <p class="metadata-card-copy">Run ID {{ selectedRun.id }}</p>
              <p class="metadata-card-copy">Triggered by {{ selectedRun.triggeredByUserId || 'system or unknown actor' }}</p>
            </div>
            <span class="review-status-pill" :class="getOperationRunStatusClass(selectedRun.status)">
              {{ getOperationRunStatusLabel(selectedRun.status, { defaultLabel: 'Unknown' }) }}
            </span>
          </div>

          <div class="operations-insight-grid">
            <article class="operations-insight-card">
              <p class="eyebrow">What happened</p>
              <strong>{{ getOperationRunOperatorSummary(selectedRun) }}</strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">What to do next</p>
              <strong>{{ getOperationRunNextStep(selectedRun) }}</strong>
            </article>
            <article class="operations-insight-card">
              <p class="eyebrow">Owning workflow</p>
              <RouterLink v-if="selectedRunWorkflowTarget" class="secondary-button" :to="selectedRunWorkflowTarget.to">
                {{ selectedRunWorkflowTarget.label }}
              </RouterLink>
              <strong v-else>No linked workflow surface is registered for this run yet.</strong>
            </article>
          </div>

          <article class="operations-detail-card" v-if="selectedRun.errorMessage">
            <p class="eyebrow">Latest issue</p>
            <strong>{{ selectedRun.errorMessage }}</strong>
          </article>

          <dl class="review-meta-grid onboarding-meta-grid">
            <div>
              <dt>Started</dt>
              <dd>{{ formatTimestamp(selectedRun.startedAt) }}</dd>
            </div>
            <div>
              <dt>Finished</dt>
              <dd>{{ formatTimestamp(selectedRun.finishedAt) }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ getOperationRunStatusLabel(selectedRun.status, { defaultLabel: 'Unknown' }) }}</dd>
            </div>
            <div v-if="selectedRun.maxAttempts || selectedRun.attemptCount">
              <dt>Attempts</dt>
              <dd>{{ selectedRun.attemptCount ?? 0 }} of {{ selectedRun.maxAttempts ?? 1 }}</dd>
            </div>
            <div v-if="selectedRun.nextAttemptAt">
              <dt>Next attempt</dt>
              <dd>{{ formatTimestamp(selectedRun.nextAttemptAt) }}</dd>
            </div>
            <div v-if="selectedRun.cancelRequestedAt">
              <dt>Cancel requested</dt>
              <dd>{{ formatTimestamp(selectedRun.cancelRequestedAt) }}</dd>
            </div>
            <div v-if="selectedRun.cancelRequestedByUserId">
              <dt>Cancel requested by</dt>
              <dd>{{ selectedRun.cancelRequestedByUserId }}</dd>
            </div>
          </dl>

          <p class="metadata-card-copy" v-if="!selectedRunLease">
            No active worker lease is currently recorded for this run.
          </p>

          <article class="operations-detail-card" v-if="summaryEntries(selectedRun.summary).length">
            <h3>Recorded outcome</h3>
            <dl class="review-meta-grid operation-summary-grid">
              <div v-for="entry in summaryEntries(selectedRun.summary)" :key="entry.key">
                <dt>{{ formatSummaryLabel(entry.key) }}</dt>
                <dd>{{ formatSummaryValue(entry.value) }}</dd>
              </div>
            </dl>
          </article>

          <details class="operation-summary-raw" v-if="Object.keys(selectedRun.summary ?? {}).length">
            <summary>Recorded summary JSON</summary>
            <pre>{{ JSON.stringify(selectedRun.summary, null, 2) }}</pre>
          </details>

          <details class="operation-summary-raw" v-if="selectedRun.claimedAt || selectedRun.claimedByInstanceId || selectedRunLease">
            <summary>Worker and technical detail</summary>
            <dl class="review-meta-grid onboarding-meta-grid">
              <div>
                <dt>Operation type</dt>
                <dd>{{ selectedRun.operationType }}</dd>
              </div>
              <div v-if="selectedRun.claimedAt">
                <dt>Queue claimed</dt>
                <dd>{{ formatTimestamp(selectedRun.claimedAt) }}</dd>
              </div>
              <div v-if="selectedRun.claimedByInstanceId">
                <dt>Claimed by</dt>
                <dd>{{ selectedRun.claimedByInstanceId }}</dd>
              </div>
              <div v-if="selectedRunLease">
                <dt>Lease state</dt>
                <dd>
                  <span class="review-status-pill" :class="leaseStateClass(selectedRunLease.state)">
                    {{ leaseStateLabel(selectedRunLease.state) }}
                  </span>
                </dd>
              </div>
              <div v-if="selectedRunLease">
                <dt>Lease owner</dt>
                <dd>{{ selectedRunLease.ownerInstanceId }}</dd>
              </div>
              <div v-if="selectedRunLease">
                <dt>Last heartbeat</dt>
                <dd>{{ formatTimestamp(selectedRunLease.heartbeatAt) }}</dd>
              </div>
              <div v-if="selectedRunLease">
                <dt>Lease expiry</dt>
                <dd>{{ formatTimestamp(selectedRunLease.expiresAt) }}</dd>
              </div>
            </dl>
          </details>

          <article class="operations-detail-card">
            <h3>Run timeline</h3>
            <p class="metadata-card-copy" v-if="!selectedRunDetail?.auditEvents?.length">No timeline events were recorded for this run.</p>
            <div class="session-list" v-else>
              <article class="session-row" v-for="event in selectedRunDetail.auditEvents" :key="event.id">
                <div>
                  <p class="eyebrow">{{ formatTimestamp(event.occurredAt) }}</p>
                  <strong>{{ event.summary }}</strong>
                  <p class="muted-copy">{{ event.eventType }}</p>
                </div>
              </article>
            </div>
          </article>
        </template>
      </article>
    </div>
  </section>
</template>