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
import { computed, nextTick, onMounted, ref, watch } from 'vue';
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
  getOperationRunStatusLabel,
} from '../lib/operation-run-status.js';
import {
  buildOperationFilterOptions,
  buildOperationSummaryEntries,
  formatLeaseStateLabel,
  formatLeaseStateTone,
  formatOperationGroupTone,
  formatOperationRunStatusTone,
  formatOperationSummaryLabel,
  formatOperationSummaryValue,
  formatOperationTimestamp,
  formatOperationTimestampShort,
  getOperationRunDurationLabel,
  getOperationRunNextStep,
  getOperationRunOperatorSummary,
  groupOperationRunsForDisplay,
} from '../lib/operation-run-presentation.js';

const route = useRoute();
const router = useRouter();
const operationDetailHash = '#operation-run-detail-panel';

const activeFilter = ref(null);

const {
  cancellationErrorMessage,
  detailErrorMessage,
  errorMessage,
  hasActiveRuns,
  isCancellingRun,
  isLoadingDetail,
  isLoadingHistory,
  isPollingActive,
  isRetryingRun,
  lastRefreshedAt,
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

const filterOptions = computed(() => buildOperationFilterOptions(runs.value));

const displayGroups = computed(() => {
  if (!activeFilter.value) return groupedRuns.value;
  return groupedRuns.value.filter((g) => g.id === activeFilter.value);
});

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
  if (typeof document === 'undefined') return;
  document.getElementById('operation-run-detail-panel')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function runLinkTarget(run) {
  return buildOperationRunLinkTarget({
    operationType: run?.operationType,
    runId: run?.id,
  });
}

function runDuration(run) {
  return getOperationRunDurationLabel(run);
}

async function handleSelectRun(runId) {
  await selectOperationRun({ runId });
  await replaceOperationsRouteState({ runId }, { hash: operationDetailHash });
  await nextTick();
  scrollDetailIntoView();
}

async function handleRequestCancellation() {
  if (!selectedRun.value?.id) return;
  await requestCancellation({ runId: selectedRun.value.id });
}

async function handleRequestRetry() {
  if (!selectedRun.value?.id) return;
  await requestRetry({ runId: selectedRun.value.id });
}

onMounted(() => {
  void loadOperationHistory({ preferredRunId: operationsRouteState.value.runId || null });
});

watch(
  () => operationsRouteState.value.runId,
  (nextRunId, previousRunId) => {
    if (nextRunId === previousRunId) return;

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
  <section class="hx-page">
    <header class="hx-page-header">
      <div>
        <h2 class="hx-page-title">Background Jobs</h2>
        <p class="hx-page-subtitle">Automated tasks — scans, discovery, imports, and metadata refreshes.</p>
      </div>
      <div class="hx-page-actions ops-header-actions">
        <span v-if="lastRefreshedAt" class="ops-refresh-indicator">
          <span v-if="isPollingActive" class="ops-refresh-dot" aria-label="Live auto-refresh active"></span>
          <span class="ops-refresh-label">
            {{ isPollingActive ? 'Live' : `Refreshed ${formatOperationTimestampShort(lastRefreshedAt)}` }}
          </span>
        </span>
        <button
          type="button"
          class="hx-btn"
          @click="loadOperationHistory({ preferredRunId: selectedRunId || null })"
          :disabled="isLoadingHistory"
        >
          {{ isLoadingHistory ? 'Refreshing…' : 'Refresh' }}
        </button>
      </div>
    </header>

    <div class="operations-grid">

      <!-- Job queue -->
      <article class="hx-card">
        <header class="hx-card-header ops-monitor-header">
          <h3 class="hx-card-title">Job queue</h3>
          <div class="ops-filter-bar" v-if="filterOptions.length > 2">
            <button
              v-for="option in filterOptions"
              :key="String(option.id)"
              type="button"
              class="ops-filter-tab"
              :data-active="activeFilter === option.id || undefined"
              @click="activeFilter = option.id"
            >
              {{ option.label }}
              <span class="ops-filter-count">{{ option.count }}</span>
            </button>
          </div>
        </header>

        <div v-if="errorMessage" class="hx-card-body">
          <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
        </div>

        <div v-else-if="isLoadingHistory" class="hx-card-body">
          <p class="hx-text-muted">Loading background jobs…</p>
        </div>

        <div v-else-if="!runs.length" class="hx-card-body">
          <div class="hx-empty">
            <p class="hx-empty-title">No jobs recorded yet</p>
            <p class="hx-empty-copy">Background jobs appear here when triggered — library scans, discovery, imports, metadata refreshes, and more.</p>
          </div>
        </div>

        <div v-else class="hx-card-body is-flush">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in displayGroups" :key="group.id">
                <tr v-if="displayGroups.length > 1" class="ops-group-row">
                  <td colspan="4">
                    <span v-if="formatOperationGroupTone(group.id)" class="hx-pill" :data-tone="formatOperationGroupTone(group.id)">{{ group.title }}</span>
                    <span v-else class="ops-group-label">{{ group.title }}</span>
                  </td>
                </tr>
                <tr
                  v-for="run in group.runs"
                  :key="run.id"
                  class="ops-run-row"
                  :class="{ 'ops-run-row--selected': run.id === selectedRunId }"
                  @click="handleSelectRun(run.id)"
                >
                  <td class="ops-run-name">
                    {{ operationTitle(run.operationType) }}
                    <span v-if="run.attemptCount > 1" class="hx-text-muted"> · attempt {{ run.attemptCount }}</span>
                  </td>
                  <td>
                    <span class="hx-pill" :data-tone="formatOperationRunStatusTone(run.status)">
                      {{ getOperationRunStatusLabel(run.status, { defaultLabel: 'Unknown' }) }}
                    </span>
                  </td>
                  <td class="ops-time-cell">
                    <span>{{ formatOperationTimestampShort(run.startedAt) }}</span>
                    <span v-if="runDuration(run)" class="ops-duration">{{ runDuration(run) }}</span>
                  </td>
                  <td class="ops-run-actions">
                    <RouterLink
                      v-if="runLinkTarget(run) && run.id !== selectedRunId"
                      class="hx-btn"
                      :to="runLinkTarget(run).to"
                      @click.stop
                    >
                      {{ runLinkTarget(run).label }}
                    </RouterLink>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </article>

      <!-- Job detail -->
      <article id="operation-run-detail-panel" class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Job detail</h3>
            <p class="hx-card-subtitle" v-if="!selectedRun && !isLoadingDetail">Select a job to see what happened and what to do next.</p>
          </div>
          <div class="hx-card-actions" v-if="selectedRun">
            <button
              v-if="canRequestCancellation"
              type="button"
              class="hx-btn"
              @click="handleRequestCancellation"
              :disabled="isCancellingRun"
            >
              {{ isCancellingRun ? 'Cancelling…' : 'Cancel run' }}
            </button>
            <button
              v-if="canRequestRetry"
              type="button"
              class="hx-btn"
              @click="handleRequestRetry"
              :disabled="isRetryingRun"
            >
              {{ isRetryingRun ? 'Retrying…' : 'Retry' }}
            </button>
            <RouterLink v-if="selectedRunWorkflowTarget" class="hx-btn" :to="selectedRunWorkflowTarget.to">
              {{ selectedRunWorkflowTarget.label }}
            </RouterLink>
          </div>
        </header>

        <div class="hx-card-body">
          <div v-if="cancellationErrorMessage || retryErrorMessage || detailErrorMessage" class="ops-error-strip">
            <span v-if="cancellationErrorMessage" class="hx-pill" data-tone="danger">{{ cancellationErrorMessage }}</span>
            <span v-if="retryErrorMessage" class="hx-pill" data-tone="danger">{{ retryErrorMessage }}</span>
            <span v-if="detailErrorMessage" class="hx-pill" data-tone="danger">{{ detailErrorMessage }}</span>
          </div>

          <p v-if="isLoadingDetail" class="hx-text-muted">Loading run detail and timeline…</p>

          <template v-else-if="selectedRun">
            <div class="ops-run-detail-header">
              <div>
                <strong class="ops-run-detail-name">{{ operationTitle(selectedRun.operationType) }}</strong>
                <p class="hx-text-muted">
                  Started {{ formatOperationTimestampShort(selectedRun.startedAt) }}<template v-if="runDuration(selectedRun)"> · {{ runDuration(selectedRun) }}</template><template v-if="selectedRun.triggeredByUserId"> · by {{ selectedRun.triggeredByUserId }}</template>
                </p>
              </div>
              <span class="hx-pill" :data-tone="formatOperationRunStatusTone(selectedRun.status)">
                {{ getOperationRunStatusLabel(selectedRun.status, { defaultLabel: 'Unknown' }) }}
              </span>
            </div>

            <div class="operations-insight-grid">
              <article class="operations-insight-card" v-if="selectedRun.errorMessage">
                <p class="ops-section-label">Error detail</p>
                <strong>{{ selectedRun.errorMessage }}</strong>
              </article>
              <article class="operations-insight-card" v-if="!selectedRun.errorMessage">
                <p class="ops-section-label">What happened</p>
                <strong>{{ getOperationRunOperatorSummary(selectedRun) }}</strong>
              </article>
              <article class="operations-insight-card">
                <p class="ops-section-label">What to do next</p>
                <strong>{{ getOperationRunNextStep(selectedRun) }}</strong>
              </article>
            </div>

            <div class="ops-timeline" v-if="selectedRunDetail?.auditEvents?.length">
              <p class="ops-section-label">Run timeline</p>
              <div class="ops-timeline-list">
                <div class="ops-timeline-event" v-for="event in selectedRunDetail.auditEvents" :key="event.id">
                    <span class="ops-timeline-time">{{ formatOperationTimestampShort(event.occurredAt) }}</span>
                  <span class="ops-timeline-dot"></span>
                  <div class="ops-timeline-body">
                    <strong>{{ event.summary }}</strong>
                  </div>
                </div>
              </div>
            </div>

            <details class="ops-technical-details">
              <summary>Technical detail</summary>
              <dl class="ops-meta-dl">
                <div>
                  <dt>Operation type</dt>
                  <dd>{{ operationTitle(selectedRun.operationType) }}</dd>
                </div>
                <div>
                  <dt>Run ID</dt>
                  <dd class="ops-run-id">{{ selectedRun.id }}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{{ formatOperationTimestamp(selectedRun.startedAt) }}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{{ formatOperationTimestamp(selectedRun.finishedAt) }}</dd>
                </div>
                <div v-if="selectedRun.attemptCount || selectedRun.maxAttempts">
                  <dt>Attempts</dt>
                  <dd>{{ selectedRun.attemptCount ?? 0 }} of {{ selectedRun.maxAttempts ?? 1 }}</dd>
                </div>
                <div v-if="selectedRun.nextAttemptAt">
                  <dt>Next attempt</dt>
                  <dd>{{ formatOperationTimestamp(selectedRun.nextAttemptAt) }}</dd>
                </div>
                <div v-if="selectedRun.cancelRequestedAt">
                  <dt>Cancellation requested</dt>
                  <dd>{{ formatOperationTimestamp(selectedRun.cancelRequestedAt) }}</dd>
                </div>
                <div v-if="selectedRun.cancelRequestedByUserId">
                  <dt>Cancelled by</dt>
                  <dd>{{ selectedRun.cancelRequestedByUserId }}</dd>
                </div>
                <div v-if="selectedRun.claimedAt">
                  <dt>Processing started</dt>
                  <dd>{{ formatOperationTimestamp(selectedRun.claimedAt) }}</dd>
                </div>
                <div v-if="selectedRun.claimedByInstanceId">
                  <dt>Worker instance</dt>
                  <dd>{{ selectedRun.claimedByInstanceId }}</dd>
                </div>
                <div v-if="selectedRunLease">
                  <dt>Lock state</dt>
                  <dd>
                    <span class="hx-pill" :data-tone="formatLeaseStateTone(selectedRunLease.state)">
                      {{ formatLeaseStateLabel(selectedRunLease.state) }}
                    </span>
                  </dd>
                </div>
                <div v-if="selectedRunLease">
                  <dt>Lock held by</dt>
                  <dd>{{ selectedRunLease.ownerInstanceId }}</dd>
                </div>
                <div v-if="selectedRunLease">
                  <dt>Last check-in</dt>
                  <dd>{{ formatOperationTimestamp(selectedRunLease.heartbeatAt) }}</dd>
                </div>
                <div v-if="selectedRunLease">
                  <dt>Lock expiry</dt>
                  <dd>{{ formatOperationTimestamp(selectedRunLease.expiresAt) }}</dd>
                </div>
              </dl>

              <div v-if="buildOperationSummaryEntries(selectedRun.summary).length" class="ops-sub-section">
                <p class="ops-section-label">Recorded outcome</p>
                <dl class="ops-meta-dl">
                  <div v-for="entry in buildOperationSummaryEntries(selectedRun.summary)" :key="entry.key">
                    <dt>{{ formatOperationSummaryLabel(entry.key) }}</dt>
                    <dd>{{ formatOperationSummaryValue(entry.value) }}</dd>
                  </div>
                </dl>
              </div>

              <div v-if="Object.keys(selectedRun.summary ?? {}).length && !buildOperationSummaryEntries(selectedRun.summary).length" class="ops-sub-section">
                <p class="ops-section-label">Raw JSON</p>
                <pre class="ops-pre">{{ JSON.stringify(selectedRun.summary, null, 2) }}</pre>
              </div>
            </details>
          </template>

          <p v-else class="hx-text-muted">Select a job from the queue to see what happened, what to do next, and the full run detail.</p>
        </div>
      </article>

    </div>
  </section>
</template>
