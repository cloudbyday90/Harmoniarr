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

const filterOptions = computed(() => {
  const options = [
    { id: null, label: 'All', count: runs.value.length },
    ...groupedRuns.value.map((g) => ({ id: g.id, label: g.title, count: g.runs.length })),
  ];
  return options.filter((o) => o.id === null || o.count > 0);
});

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

function formatTimestamp(value) {
  if (!value) return 'Not yet recorded';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

function formatTimestampShort(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 60_000) return 'Just now';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString();
}

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function runStatusTone(status) {
  switch (status) {
    case 'failed': return 'danger';
    case 'cancelled': return 'warning';
    case 'running': return 'success';
    default: return null;
  }
}

function groupTone(groupId) {
  switch (groupId) {
    case 'needs-attention': return 'danger';
    case 'in-progress': return 'success';
    default: return null;
  }
}

function leaseStateLabel(state) {
  switch (state) {
    case 'active': return 'Active';
    case 'expired': return 'Expired';
    case 'released': return 'Released';
    default: return 'Unknown';
  }
}

function leaseStateTone(state) {
  switch (state) {
    case 'active': return 'success';
    case 'expired': return 'danger';
    default: return null;
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
  if (Array.isArray(value)) return `${value.length} record${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return 'Structured data recorded';
  return String(value);
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
        <h2 class="hx-page-title">Operations</h2>
        <p class="hx-page-subtitle">Background work — queued, active, and completed runs.</p>
      </div>
      <div class="hx-page-actions">
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

      <!-- Run monitor -->
      <article class="hx-card">
        <header class="hx-card-header ops-monitor-header">
          <h3 class="hx-card-title">Run monitor</h3>
          <div class="ops-filter-bar" v-if="filterOptions.length > 1">
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
          <p class="hx-text-muted">Loading background work history…</p>
        </div>

        <div v-else-if="!runs.length" class="hx-card-body">
          <div class="hx-empty">
            <p class="hx-empty-title">No runs recorded yet</p>
            <p class="hx-empty-copy">Background operations will appear here once triggered from Settings or an activity view.</p>
          </div>
        </div>

        <div v-else class="hx-card-body is-flush">
          <table class="hx-table">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Status</th>
                <th>Started</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="group in displayGroups" :key="group.id">
                <tr v-if="displayGroups.length > 1" class="ops-group-row">
                  <td colspan="4">
                    <span v-if="groupTone(group.id)" class="hx-pill" :data-tone="groupTone(group.id)">{{ group.title }}</span>
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
                    <span class="hx-pill" :data-tone="runStatusTone(run.status)">
                      {{ getOperationRunStatusLabel(run.status, { defaultLabel: 'Unknown' }) }}
                    </span>
                  </td>
                  <td class="hx-text-muted ops-time-cell">{{ formatTimestampShort(run.startedAt) }}</td>
                  <td class="ops-run-actions">
                    <RouterLink
                      v-if="runLinkTarget(run)"
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

      <!-- Run detail -->
      <article id="operation-run-detail-panel" class="hx-card">
        <header class="hx-card-header">
          <div>
            <h3 class="hx-card-title">Run detail</h3>
            <p class="hx-card-subtitle" v-if="!selectedRun && !isLoadingDetail">Select a run to inspect what happened.</p>
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
                  Triggered by {{ selectedRun.triggeredByUserId || 'system' }} · Run {{ selectedRun.id }}
                </p>
              </div>
              <span class="hx-pill" :data-tone="runStatusTone(selectedRun.status)">
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
              <article class="operations-insight-card" v-if="selectedRun.errorMessage">
                <p class="eyebrow">Latest issue</p>
                <strong>{{ selectedRun.errorMessage }}</strong>
              </article>
            </div>

            <div class="ops-timeline" v-if="selectedRunDetail?.auditEvents?.length">
              <p class="ops-section-label">Run timeline</p>
              <div class="ops-timeline-list">
                <div class="ops-timeline-event" v-for="event in selectedRunDetail.auditEvents" :key="event.id">
                  <span class="ops-timeline-time">{{ formatTimestampShort(event.occurredAt) }}</span>
                  <span class="ops-timeline-dot"></span>
                  <div class="ops-timeline-body">
                    <strong>{{ event.summary }}</strong>
                    <span class="hx-text-muted">{{ event.eventType }}</span>
                  </div>
                </div>
              </div>
            </div>

            <details class="ops-technical-details">
              <summary>Technical detail</summary>
              <dl class="ops-meta-dl">
                <div>
                  <dt>Operation type</dt>
                  <dd>{{ selectedRun.operationType }}</dd>
                </div>
                <div>
                  <dt>Started</dt>
                  <dd>{{ formatTimestamp(selectedRun.startedAt) }}</dd>
                </div>
                <div>
                  <dt>Finished</dt>
                  <dd>{{ formatTimestamp(selectedRun.finishedAt) }}</dd>
                </div>
                <div v-if="selectedRun.attemptCount || selectedRun.maxAttempts">
                  <dt>Attempts</dt>
                  <dd>{{ selectedRun.attemptCount ?? 0 }} of {{ selectedRun.maxAttempts ?? 1 }}</dd>
                </div>
                <div v-if="selectedRun.nextAttemptAt">
                  <dt>Next attempt</dt>
                  <dd>{{ formatTimestamp(selectedRun.nextAttemptAt) }}</dd>
                </div>
                <div v-if="selectedRun.cancelRequestedAt">
                  <dt>Cancellation requested</dt>
                  <dd>{{ formatTimestamp(selectedRun.cancelRequestedAt) }}</dd>
                </div>
                <div v-if="selectedRun.cancelRequestedByUserId">
                  <dt>Cancelled by</dt>
                  <dd>{{ selectedRun.cancelRequestedByUserId }}</dd>
                </div>
                <div v-if="selectedRun.claimedAt">
                  <dt>Queue claimed</dt>
                  <dd>{{ formatTimestamp(selectedRun.claimedAt) }}</dd>
                </div>
                <div v-if="selectedRun.claimedByInstanceId">
                  <dt>Claimed by instance</dt>
                  <dd>{{ selectedRun.claimedByInstanceId }}</dd>
                </div>
                <div v-if="selectedRunLease">
                  <dt>Lease state</dt>
                  <dd>
                    <span class="hx-pill" :data-tone="leaseStateTone(selectedRunLease.state)">
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

              <div v-if="summaryEntries(selectedRun.summary).length" class="ops-sub-section">
                <p class="ops-section-label">Recorded outcome</p>
                <dl class="ops-meta-dl">
                  <div v-for="entry in summaryEntries(selectedRun.summary)" :key="entry.key">
                    <dt>{{ formatSummaryLabel(entry.key) }}</dt>
                    <dd>{{ formatSummaryValue(entry.value) }}</dd>
                  </div>
                </dl>
              </div>

              <div v-if="Object.keys(selectedRun.summary ?? {}).length" class="ops-sub-section">
                <p class="ops-section-label">Raw JSON</p>
                <pre class="ops-pre">{{ JSON.stringify(selectedRun.summary, null, 2) }}</pre>
              </div>
            </details>
          </template>

          <p v-else class="hx-text-muted">Select a run from the monitor to see what happened, what to do next, and the technical detail behind it.</p>
        </div>
      </article>

    </div>
  </section>
</template>
