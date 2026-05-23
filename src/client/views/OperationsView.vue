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
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useToast } from '../composables/useToast.js';
import { useOperationHistory } from '../composables/useOperationHistory.js';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import OperationRunDrilldownPanel from '../components/OperationRunDrilldownPanel.vue';
import {
  buildOperationsRouteQuery,
  getOperationsRouteStateKey,
  normalizeOperationsRouteState,
} from '../lib/operations-route-state.js';
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
  formatElapsedDuration,
  formatLeaseStateLabel,
  formatLeaseStateTone,
  formatOperationRunStatusTone,
  formatOperationSummaryLabel,
  formatOperationSummaryValue,
  formatOperationTimestamp,
  formatOperationTimestampShort,
  formatQueueRunStatusLabel,
  formatQueueRunStatusTone,
  getOperationRunDurationLabel,
  getOperationRunNextStep,
  getOperationRunOperatorSummary,
} from '../lib/operation-run-presentation.js';
import {
  triggerArtworkCleanup,
  triggerImportApply,
  triggerImportExecution,
  triggerImportMediaInspection,
  triggerImportTranscode,
  triggerLibraryDiscovery,
  triggerLibraryOrganize,
  triggerLibraryScan,
  triggerNotificationFanout,
} from '../lib/operations-api.js';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const {
  attachVisibilityListener,
  cancellationErrorMessage,
  detailErrorMessage,
  destroy: destroyOperationHistory,
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
} = useOperationHistory({ revalidateOnFocus: true });

const operationsRouteState = computed(() => normalizeOperationsRouteState(route.query));
const selectedRun = computed(() => selectedRunDetail.value?.run ?? null);
const selectedRunLease = computed(() => selectedRun.value?.lease ?? null);
const selectedRunSummaryEntries = computed(() => {
  const hiddenKeys = new Set(getOperationRunDrilldownSummaryKeys(selectedRun.value));
  return buildOperationSummaryEntries(selectedRun.value?.summary)
    .filter((entry) => !hiddenKeys.has(entry.key));
});
const canRequestCancellation = computed(() => canRequestOperationRunCancellation(selectedRun.value));
const canRequestRetry = computed(() => canRequestOperationRunRetry(selectedRun.value));
const selectedRunWorkflowTarget = computed(() => buildOperationRunLinkTarget({
  operationType: selectedRun.value?.operationType,
  runId: selectedRun.value?.id,
}));

const JOB_CATALOG_DEFS = [
  {
    operationType: 'artwork_cleanup',
    title: 'Artwork cleanup',
    triggerFn: triggerArtworkCleanup,
    formatRunResult: (run) => {
      const { scannedAssetCount, deletedAssetCount } = run.summary ?? {};
      if (scannedAssetCount == null) return null;
      return `${scannedAssetCount} scanned / ${deletedAssetCount ?? 0} deleted`;
    },
  },
  { operationType: 'import_candidate_apply',                   title: 'Import apply',             triggerFn: triggerImportApply,            formatRunResult: null },
  { operationType: 'import_candidate_execution_planning',      title: 'Import execution',         triggerFn: triggerImportExecution,        formatRunResult: null },
  { operationType: 'import_candidate_media_inspection',        title: 'Import media inspection',  triggerFn: triggerImportMediaInspection,  formatRunResult: null },
  { operationType: 'import_candidate_transcode_orchestration', title: 'Import transcode',         triggerFn: triggerImportTranscode,        formatRunResult: null },
  { operationType: 'library_discovery_dispatch',               title: 'Library discovery',        triggerFn: triggerLibraryDiscovery,       formatRunResult: null },
  { operationType: 'library_organize_apply',                   title: 'Library organize apply',   triggerFn: triggerLibraryOrganize,        formatRunResult: null },
  { operationType: 'library_scan',                             title: 'Library scan',             triggerFn: triggerLibraryScan,            formatRunResult: null },
  { operationType: 'operator_notification_fanout',             title: 'Notification fan-out',     triggerFn: triggerNotificationFanout,     formatRunResult: null },
];

const DESTRUCTIVE_OPERATIONS = Object.freeze({
  import_candidate_apply: {
    confirmLevel: 'type_to_confirm',
    confirmText: 'start import apply',
    gateLabel: 'I understand this will move files from staging into the music library. This cannot be undone.',
  },
  library_organize_apply: {
    confirmLevel: 'type_to_confirm',
    confirmText: 'start library organize',
    gateLabel: 'I understand this will rename and move library files to canonical paths. This cannot be undone.',
  },
  import_candidate_transcode_orchestration: {
    confirmLevel: 'checkbox',
    confirmText: '',
    gateLabel: 'I understand this will run ffmpeg preflight validation on selected candidates.',
  },
});

const triggeringJobs = reactive({});
const triggerErrors = reactive({});
const expandedJobType = ref(null);

const confirmDialogOpen = ref(false);
const confirmOperationType = ref(null);
const confirmTyped = ref('');
const confirmAcknowledged = ref(false);

const pendingConfirmJob = computed(() => {
  if (!confirmOperationType.value) return null;
  return jobCatalog.value.find((j) => j.operationType === confirmOperationType.value) ?? null;
});

const destructiveConfig = computed(() => {
  if (!confirmOperationType.value) return null;
  return DESTRUCTIVE_OPERATIONS[confirmOperationType.value] ?? null;
});

const jobCatalog = computed(() =>
  JOB_CATALOG_DEFS.map((def) => {
    const jobRuns = runs.value
      .filter((r) => r.operationType === def.operationType)
      .sort((a, b) => new Date(b.startedAt ?? b.createdAt ?? 0) - new Date(a.startedAt ?? a.createdAt ?? 0));
    const latestRun = jobRuns[0] ?? null;
    return {
      operationType: def.operationType,
      title: def.title,
      triggerFn: def.triggerFn,
      formatRunResult: def.formatRunResult ?? null,
      latestRun,
      recentRuns: jobRuns.slice(0, 5),
      isActive: latestRun?.status === 'pending' || latestRun?.status === 'running',
      isTriggering: !!triggeringJobs[def.operationType],
      triggerError: triggerErrors[def.operationType] ?? null,
    };
  }),
);

const triggerErrorEntries = computed(() =>
  JOB_CATALOG_DEFS
    .filter((def) => typeof triggerErrors[def.operationType] === 'string' && triggerErrors[def.operationType].trim())
    .map((def) => ({
      operationType: def.operationType,
      title: def.title,
      message: triggerErrors[def.operationType],
    })),
);

function handleToggleJob(operationType) {
  expandedJobType.value = expandedJobType.value === operationType ? null : operationType;
}

function clearTriggerError(operationType) {
  delete triggerErrors[operationType];
}

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

function operationTitle(operationType) {
  return getOperationRunDescriptor(operationType).title;
}

function runDuration(run) {
  return getOperationRunDurationLabel(run);
}

async function handleSelectRun(runId) {
  await selectOperationRun({ runId });
  await replaceOperationsRouteState({ runId });
}

async function handleRequestCancellation() {
  if (!selectedRun.value?.id) return;
  await requestCancellation({ runId: selectedRun.value.id });
}

async function handleRequestRetry() {
  if (!selectedRun.value?.id) return;
  await requestRetry({ runId: selectedRun.value.id });
}

async function handleTriggerJob(operationType, triggerFn) {
  if (triggeringJobs[operationType]) return;

  const destructive = DESTRUCTIVE_OPERATIONS[operationType];
  if (destructive) {
    confirmOperationType.value = operationType;
    confirmTyped.value = '';
    confirmAcknowledged.value = false;
    confirmDialogOpen.value = true;
    return;
  }

  await executeJobTrigger(operationType, triggerFn);
}

async function executeJobTrigger(operationType, triggerFn) {
  if (triggeringJobs[operationType]) return;
  triggeringJobs[operationType] = true;
  delete triggerErrors[operationType];
  try {
    await triggerFn();
    await loadOperationHistory({ preferredRunId: selectedRunId.value || null });
  } catch (error) {
    const message = error?.message ?? 'Failed to start job';
    triggerErrors[operationType] = message;
    toast.error(`${operationTitle(operationType)}: ${message}`);
  } finally {
    delete triggeringJobs[operationType];
  }
}

async function onConfirmJobExecute() {
  if (!confirmOperationType.value) return;
  const job = pendingConfirmJob.value;
  const config = destructiveConfig.value;
  if (!job || !config) return;

  confirmDialogOpen.value = false;
  await executeJobTrigger(confirmOperationType.value, job.triggerFn);
}

function closeConfirmDialog() {
  confirmDialogOpen.value = false;
  confirmOperationType.value = null;
}

onMounted(() => {
  attachVisibilityListener();
  void loadOperationHistory({ preferredRunId: operationsRouteState.value.runId || null });
});

onBeforeUnmount(() => {
  destroyOperationHistory();
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
        <span v-if="!isLoadingHistory" class="hx-pill" :data-tone="hasActiveRuns ? 'info' : null">
          {{ hasActiveRuns ? 'Active jobs' : 'Idle' }}
        </span>
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

      <!-- Job catalog -->
      <article class="hx-card">
        <header class="hx-card-header ops-monitor-header">
          <h3 class="hx-card-title">Jobs</h3>
        </header>

        <div v-if="errorMessage" class="hx-card-body">
          <span class="hx-pill" data-tone="danger">{{ errorMessage }}</span>
        </div>

        <div v-else-if="isLoadingHistory" class="hx-card-body">
          <p class="hx-text-muted">Loading background jobs…</p>
        </div>

        <template v-else>
          <div v-if="triggerErrorEntries.length" class="hx-card-body ops-trigger-errors">
            <div
              v-for="entry in triggerErrorEntries"
              :key="entry.operationType"
              class="ops-trigger-error"
              role="alert"
            >
              <div class="ops-trigger-error-copy">
                <strong>{{ entry.title }}</strong>
                <p>{{ entry.message }}</p>
              </div>
              <button
                type="button"
                class="secondary-button ops-trigger-error-dismiss"
                @click="clearTriggerError(entry.operationType)"
              >
                Dismiss
              </button>
            </div>
          </div>

          <div class="hx-card-body is-flush">
            <table class="hx-table ops-catalog-table">
            <thead>
              <tr>
                <th class="ops-job-col">Job</th>
                <th class="ops-status-col">Status</th>
                <th class="ops-last-run-col">Last run</th>
                <th class="ops-action-col"></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="job in jobCatalog" :key="job.operationType">
                <tr
                  class="ops-run-row"
                  :class="{ 'ops-run-row--no-run': !job.latestRun, 'ops-run-row--expanded': expandedJobType === job.operationType }"
                  @click="job.latestRun ? handleToggleJob(job.operationType) : undefined"
                >
                  <td class="ops-run-name">
                    <span v-if="job.latestRun" class="ops-expand-chevron" :class="{ 'is-open': expandedJobType === job.operationType }" aria-hidden="true"></span>
                    {{ job.title }}
                  </td>
                  <td>
                    <span v-if="job.latestRun" class="hx-pill" :data-tone="formatOperationRunStatusTone(job.latestRun.status)">
                      {{ getOperationRunStatusLabel(job.latestRun.status, { defaultLabel: 'Unknown' }) }}
                    </span>
                    <span v-else class="hx-pill">Never run</span>
                  </td>
                  <td class="ops-time-cell">
                    <span v-if="job.latestRun" class="hx-text-muted">{{ formatOperationTimestampShort(job.latestRun.startedAt) }}</span>
                    <span v-else class="hx-text-muted" style="font-style: italic;">—</span>
                  </td>
                  <td class="ops-run-actions">
                    <button
                      type="button"
                      class="hx-btn"
                      :disabled="job.isActive || job.isTriggering"
                      @click.stop="handleTriggerJob(job.operationType, job.triggerFn)"
                    >
                      {{ job.isTriggering ? 'Starting…' : job.isActive ? 'Running…' : 'Run' }}
                    </button>
                  </td>
                </tr>
                <tr v-if="expandedJobType === job.operationType && job.recentRuns.length" class="ops-runs-expanded-row">
                  <td colspan="4" class="ops-runs-expanded-cell">
                    <table class="hx-table ops-runs-subtable">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Started</th>
                          <th>Duration</th>
                          <th v-if="job.formatRunResult">Result</th>
                          <th>Attempts</th>
                          <th>Error</th>
                          <th>Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr
                          v-for="run in job.recentRuns"
                          :key="run.id"
                          class="ops-runs-subtable-row"
                          :aria-selected="run.id === selectedRunId ? 'true' : 'false'"
                          :class="{ 'ops-run-row--selected': run.id === selectedRunId }"
                        >
                          <td>
                            <span class="hx-pill" :data-tone="formatQueueRunStatusTone(run.status)">{{ formatQueueRunStatusLabel(run.status) }}</span>
                          </td>
                          <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatOperationTimestampShort(run.startedAt) }}</span></td>
                          <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatElapsedDuration(run.startedAt, run.finishedAt) }}</span></td>
                          <td v-if="job.formatRunResult" style="font-size: var(--hx-text-xs);"><span class="hx-text-muted">{{ job.formatRunResult(run) ?? '' }}</span></td>
                          <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.attemptCount ?? 0 }}<span v-if="run.maxAttempts">/{{ run.maxAttempts }}</span></td>
                          <td style="font-size: var(--hx-text-xs); color: var(--hx-text-danger, #c0392b);">{{ run.errorMessage ?? '' }}</td>
                          <td class="ops-run-detail-cell">
                            <button
                              type="button"
                              class="hx-btn ops-run-detail-btn"
                              :aria-pressed="run.id === selectedRunId ? 'true' : 'false'"
                              @click.stop="handleSelectRun(run.id)"
                            >
                              {{ run.id === selectedRunId ? 'Selected' : 'View' }}
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          </div>
        </template>
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

            <OperationRunDrilldownPanel :run="selectedRun" />

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

              <div v-if="selectedRunSummaryEntries.length" class="ops-sub-section">
                <p class="ops-section-label">Recorded outcome</p>
                <dl class="ops-meta-dl">
                  <div v-for="entry in selectedRunSummaryEntries" :key="entry.key">
                    <dt>{{ formatOperationSummaryLabel(entry.key) }}</dt>
                    <dd>{{ formatOperationSummaryValue(entry.value) }}</dd>
                  </div>
                </dl>
              </div>

              <div v-if="Object.keys(selectedRun.summary ?? {}).length && !selectedRunSummaryEntries.length && !getOperationRunDrilldownSummaryKeys(selectedRun).length" class="ops-sub-section">
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

  <ConfirmDialog
    :is-open="confirmDialogOpen"
    :is-confirming="true"
    :is-executing="false"
    :is-done="false"
    :title="pendingConfirmJob ? `Start ${pendingConfirmJob.title}?` : 'Confirm'"
    :confirm-level="destructiveConfig?.confirmLevel ?? 'checkbox'"
    :confirm-text="destructiveConfig?.confirmText ?? ''"
    :gate-label="destructiveConfig?.gateLabel ?? ''"
    :typed="confirmTyped"
    :acknowledged="confirmAcknowledged"
    :matches="destructiveConfig?.confirmText ? confirmTyped === destructiveConfig.confirmText : true"
    :can-confirm="destructiveConfig?.confirmLevel === 'type_to_confirm' ? confirmAcknowledged && confirmTyped === (destructiveConfig?.confirmText ?? '') : confirmAcknowledged"
    :button-enabled="destructiveConfig?.confirmLevel === 'type_to_confirm' ? confirmAcknowledged && confirmTyped === (destructiveConfig?.confirmText ?? '') : confirmAcknowledged"
    :error="''"
    @close="closeConfirmDialog"
    @execute="onConfirmJobExecute"
    @update:typed="confirmTyped = $event"
    @update:acknowledged="confirmAcknowledged = $event"
  />
</template>

<style scoped>
.ops-run-row--no-run {
  cursor: default;
}

.ops-trigger-errors {
  display: grid;
  gap: var(--hx-space-3);
  border-bottom: 1px solid var(--hx-border-subtle);
}

.ops-trigger-error {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3);
  border: 1px solid rgba(197, 69, 69, 0.24);
  border-radius: var(--hx-radius-md);
  background: var(--hx-danger-soft);
}

.ops-trigger-error-copy {
  min-width: 0;
}

.ops-trigger-error-copy strong {
  display: block;
  margin-bottom: 4px;
  color: var(--hx-danger);
  font-size: var(--hx-text-sm);
}

.ops-trigger-error-copy p {
  margin: 0;
  color: var(--hx-text);
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.ops-trigger-error-dismiss {
  flex-shrink: 0;
}

.ops-runs-expanded-row > td {
  padding: 0;
  border-bottom: 2px solid var(--hx-border-subtle);
}

.ops-runs-expanded-cell {
  background: var(--hx-bg-surface-sunken);
}

.ops-runs-subtable {
  margin: 0;
  background: var(--hx-bg-surface-sunken);
}

.ops-runs-subtable thead,
.ops-runs-subtable tbody,
.ops-runs-subtable thead tr,
.ops-runs-subtable tbody tr {
  background: var(--hx-bg-surface-sunken);
}

.ops-runs-subtable thead tr:hover > th {
  background: var(--hx-bg-surface-sunken);
}

.ops-runs-subtable thead th {
  background: var(--hx-bg-surface-sunken);
  font-size: var(--hx-text-xs);
  padding-left: 24px;
}

.ops-runs-subtable tbody td {
  padding-left: 24px;
  border-bottom-color: var(--hx-border-subtle);
  background: var(--hx-bg-surface-sunken);
  transition: background-color 120ms ease, box-shadow 120ms ease;
}

.ops-runs-subtable tbody tr:last-child td {
  border-bottom: none;
}

.ops-runs-subtable-row {
  cursor: default;
}

.ops-runs-subtable tbody tr.ops-run-row--selected > td {
  background: var(--hx-bg-surface) !important;
  border-top-color: rgba(94, 173, 255, 0.22);
  border-bottom-color: rgba(94, 173, 255, 0.22);
}

.ops-runs-subtable tbody tr.ops-run-row--selected > td:first-child {
  border-left: 3px solid var(--hx-accent);
  padding-left: 21px;
}

.ops-run-detail-cell {
  text-align: right;
  white-space: nowrap;
}

.ops-run-detail-btn {
  min-height: 28px;
  padding: 4px 10px;
  font-size: var(--hx-text-xs);
}

.ops-run-detail-btn[aria-pressed='true'] {
  background: var(--hx-accent-soft);
  border-color: rgba(94, 173, 255, 0.32);
  color: var(--hx-accent-strong);
}

.ops-expand-chevron {
  display: inline-block;
  width: 0;
  height: 0;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-left: 6px solid var(--hx-text-muted);
  margin-right: 6px;
  vertical-align: middle;
  transition: transform 150ms ease;
}

.ops-expand-chevron.is-open {
  transform: rotate(90deg);
}

@media (max-width: 720px) {
  .ops-trigger-error {
    flex-direction: column;
    align-items: stretch;
  }

  .ops-trigger-error-dismiss {
    align-self: flex-start;
  }
}
</style>
