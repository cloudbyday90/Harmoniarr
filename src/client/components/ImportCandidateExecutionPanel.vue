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
import {
  canStartExecutionRun,
  buildImportExecutionRefreshNotice,
  formatLiveTransferStatus,
  formatPath,
  formatPercent,
  formatRunStatus,
  formatTimestamp,
  buildLiveTransferSyncNotice,
  getExecutionItemStatusClass,
  getExecutionItemStatusLabel,
  getHeartbeatOutcomeLabel,
  getHeartbeatSkipReasonLabel,
  getLatestTransferSummary,
  getLiveTransferStatusClass,
  getPersistedMissingTransfer,
  getPersistedTransferObservation,
  getRunStatusClass,
  isTransferSnapshotDegraded,
} from '../lib/import-candidate-presentation.js';
import {
  formatElapsedDuration,
  formatOperationTimestampShort,
} from '../lib/operation-run-presentation.js';
import { buildDownloaderTransferLocation } from '../lib/downloader-transfer-route.js';
import ImportCandidateRunFailureNotice from './ImportCandidateRunFailureNotice.vue';

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
  isReconciling: {
    type: Boolean,
    default: false,
  },
  isStarting: {
    type: Boolean,
    default: false,
  },
  recentRuns: {
    type: Array,
    default: () => [],
  },
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  selectedCandidateCount: {
    type: Number,
    default: 0,
  },
  selectedRunId: {
    type: String,
    default: null,
  },
  summary: {
    type: Object,
    default: null,
  },
});

defineEmits(['reconcile', 'refresh', 'select-run', 'start']);

const refreshNotice = computed(() => buildImportExecutionRefreshNotice({
  currentRun: props.currentRun,
  isLoading: props.isLoading,
  isReconciling: props.isReconciling,
  summary: props.summary,
}));

function downloaderTransferLocation(transfer) {
  return buildDownloaderTransferLocation(transfer);
}

function getDownloadAcceptanceDiagnostic(item) {
  return item?.planningSnapshot?.execution?.diagnostics?.downloadAcceptance
    ?? item?.diagnostics?.downloadAcceptance
    ?? null;
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Downloads</p>
        <h3>Send selected matches to downloads</h3>
      </div>
      <div class="review-filter-actions">
        <button
          type="button"
          :disabled="isLoading"
          class="secondary-button"
          @click="$emit('refresh')"
        >
          {{ isLoading ? 'Refreshing...' : 'Refresh' }}
        </button>
        <button
          type="button"
          class="secondary-button"
          :disabled="isReconciling || isLoading"
          @click="$emit('reconcile')"
        >
          {{ isReconciling ? 'Syncing...' : 'Sync transfer state' }}
        </button>
        <button
          type="button"
          :disabled="!canStartExecutionRun(currentRun, selectedCandidateCount) || isStarting"
          @click="$emit('start')"
        >
          {{ isStarting ? 'Starting...' : 'Start download run' }}
        </button>
      </div>
    </div>

    <p class="review-summary-copy">Sends selected matches to the download service. Each file is recorded so you can follow progress and recovery.</p>
    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <dl class="review-meta-grid review-meta-grid-wide" v-if="summary?.heartbeat">
      <div>
        <dt>Auto-sync interval</dt>
        <dd>{{ summary.heartbeat.intervalLabel ?? 'Unavailable' }}</dd>
      </div>
      <div>
        <dt>Interval source</dt>
        <dd>{{ summary.heartbeat.source ?? 'Unavailable' }}</dd>
      </div>
      <div>
        <dt>Last heartbeat</dt>
        <dd>{{ getHeartbeatOutcomeLabel(summary.heartbeat) }}</dd>
      </div>
      <div>
        <dt>Last tick</dt>
        <dd>{{ formatTimestamp(summary.heartbeat.state?.lastTickAt) }}</dd>
      </div>
      <div>
        <dt>Last skip reason</dt>
        <dd>{{ getHeartbeatSkipReasonLabel(summary.heartbeat.state?.lastSkipReason) }}</dd>
      </div>
      <div>
        <dt>Last transitions</dt>
        <dd>{{ summary.heartbeat.state?.lastTransitionCount ?? 0 }}</dd>
      </div>
      <div v-if="summary?.missingTransferPolicy">
        <dt>Missing transfer grace</dt>
        <dd>{{ summary.missingTransferPolicy.gracePeriodLabel ?? 'Unavailable' }}</dd>
      </div>
    </dl>

    <article class="panel-light error-panel" v-if="errorMessage" role="alert">
      <h3>Download run unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" role="alert" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    <p class="error-copy" role="alert" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading download run</h3>
      <p>Loading download run…</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No download run yet</h3>
      <p>Select matches from the list above, then send them to downloads.</p>
    </article>

    <template v-else>
      <article class="onboarding-step-card" v-if="recentRuns.length">
        <div class="review-detail-header">
          <div>
            <p>Recent download history</p>
            <strong>The last {{ recentRuns.length }} download run{{ recentRuns.length === 1 ? '' : 's' }}.</strong>
          </div>
        </div>
        <table class="hx-table execution-runs-subtable">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Matches</th>
              <th>Queued</th>
              <th>Warnings</th>
              <th>Failed</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in recentRuns"
              :key="run.id"
              class="execution-runs-subtable-row"
              :aria-selected="run.id === (selectedRunId || currentRun?.id) ? 'true' : 'false'"
              :class="{ 'is-selected': run.id === (selectedRunId || currentRun?.id) }"
            >
              <td><span class="execution-run-id">{{ run.id }}</span></td>
              <td>
                <span class="review-status-pill" :class="getRunStatusClass(run.status)">
                  {{ formatRunStatus(run.status) }}
                </span>
              </td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatOperationTimestampShort(run.startedAt) }}</span></td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatElapsedDuration(run.startedAt, run.finishedAt) }}</span></td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.requestedCandidateCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.queuedCount ?? run.readyCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.queuedWithWarningsCount ?? run.readyWithWarningsCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.queueFailedCount ?? 0 }}</td>
              <td class="execution-run-detail-cell">
                <button
                  type="button"
                  class="hx-btn execution-run-detail-btn"
                  :aria-pressed="run.id === (selectedRunId || currentRun?.id) ? 'true' : 'false'"
                  @click="$emit('select-run', run.id)"
                >
                  {{ run.id === (selectedRunId || currentRun?.id) ? 'Selected' : 'View' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </article>

      <div class="review-detail-header">
        <div>
          <p>Selected run</p>
          <strong>Run {{ currentRun.id }}</strong>
          <p class="metadata-card-copy">{{ currentRun.currentStep || 'No current step reported' }}</p>
        </div>
        <span class="review-status-pill" :class="getRunStatusClass(currentRun.status)">
          {{ formatRunStatus(currentRun.status) }}
        </span>
      </div>

      <ImportCandidateRunFailureNotice :message="currentRun.errorMessage" />

      <div
        v-if="refreshNotice"
        class="execution-refresh-notice"
        :data-tone="refreshNotice.tone"
        role="status"
        aria-live="polite"
      >
        <span class="hx-pill" :data-tone="refreshNotice.tone">
          Progress
        </span>
        <div>
          <strong>{{ refreshNotice.title }}</strong>
          <p>{{ refreshNotice.message }}</p>
        </div>
      </div>

      <div class="execution-degraded-notice" v-if="isTransferSnapshotDegraded(currentRun)" role="status">
        <span class="status-chip" data-status="degraded">Degraded</span>
        <p>Live transfer data is temporarily unavailable. Persisted observations from the last successful sync are shown below. Data will refresh automatically when the connection recovers.</p>
      </div>

      <dl class="review-meta-grid review-meta-grid-wide">
        <div>
          <dt>Started</dt>
          <dd>{{ formatTimestamp(currentRun.startedAt) }}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{{ formatTimestamp(currentRun.finishedAt) }}</dd>
        </div>
        <div>
          <dt>Matches</dt>
          <dd>{{ currentRun.requestedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Prepared</dt>
          <dd>{{ currentRun.processedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Queued</dt>
          <dd>{{ currentRun.queuedCount ?? currentRun.readyCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Queued with warnings</dt>
          <dd>{{ currentRun.queuedWithWarningsCount ?? currentRun.readyWithWarningsCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Queue failed</dt>
          <dd>{{ currentRun.queueFailedCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Blocked</dt>
          <dd>{{ currentRun.blockedCount ?? 0 }}</dd>
        </div>
      </dl>

      <div class="review-queue-stack" v-if="currentRun.items?.length">
        <article class="review-file-item" v-for="item in currentRun.items" :key="item.id">
          <div class="review-file-header">
            <div>
              <p class="eyebrow">{{ item.planningSnapshot?.candidate?.username || 'unknown user' }}</p>
              <strong>{{ item.planningSnapshot?.candidate?.folderPath || 'Root-level files' }}</strong>
              <p class="metadata-card-copy">{{ item.statusMessage }}</p>
            </div>
            <span class="review-status-pill" :class="getExecutionItemStatusClass(item.itemStatus)">
              {{ getExecutionItemStatusLabel(item.itemStatus) }}
            </span>
          </div>

          <div class="metadata-card-grid review-preview-grid">
            <article class="path-card">
              <p>Translated source</p>
              <strong>{{ formatPath(item.planningSnapshot?.planning?.sourceFolderPath) }}</strong>
            </article>
            <article class="path-card">
              <p>Staging preview</p>
              <strong>{{ formatPath(item.planningSnapshot?.planning?.stagingFolderPath) }}</strong>
            </article>
            <article class="path-card">
              <p>Library preview</p>
              <strong>{{ formatPath(item.planningSnapshot?.planning?.libraryFolderPath) }}</strong>
            </article>
          </div>

          <article
            v-if="getDownloadAcceptanceDiagnostic(item)"
            class="execution-diagnostic-panel"
            :data-tone="getDownloadAcceptanceDiagnostic(item).tone"
          >
            <div class="review-file-header">
              <div>
                <p class="eyebrow">Download acceptance diagnostic</p>
                <strong>{{ getDownloadAcceptanceDiagnostic(item).title }}</strong>
                <p class="metadata-card-copy">{{ getDownloadAcceptanceDiagnostic(item).message }}</p>
                <p class="metadata-card-copy">{{ getDownloadAcceptanceDiagnostic(item).operatorAction }}</p>
              </div>
            </div>
            <dl class="review-meta-grid review-meta-grid-wide">
              <div>
                <dt>Requested files</dt>
                <dd>{{ getDownloadAcceptanceDiagnostic(item).counts?.requestedFiles ?? 0 }}</dd>
              </div>
              <div>
                <dt>Accepted transfers</dt>
                <dd>{{ getDownloadAcceptanceDiagnostic(item).counts?.enqueuedTransfers ?? 0 }}</dd>
              </div>
              <div>
                <dt>Rejected files</dt>
                <dd>{{ getDownloadAcceptanceDiagnostic(item).counts?.failedFiles ?? 0 }}</dd>
              </div>
            </dl>
          </article>

          <article class="panel-light" v-if="item.liveTransferSummary || item.liveTransfers?.length">
            <div class="review-file-header">
              <div>
                <p class="eyebrow">Live transfer status</p>
                <strong>{{ item.liveTransferSummary?.message || 'No live slskd transfer summary is available yet.' }}</strong>
              </div>
              <span class="review-status-pill" :class="getLiveTransferStatusClass(item.liveTransferSummary)">
                {{ formatLiveTransferStatus(item.liveTransferSummary) }}
              </span>
            </div>

            <dl class="review-meta-grid review-meta-grid-wide" v-if="item.liveTransferSummary">
              <div>
                <dt>Transfers</dt>
                <dd>{{ item.liveTransferSummary.total ?? 0 }}</dd>
              </div>
              <div>
                <dt>Active</dt>
                <dd>{{ item.liveTransferSummary.active ?? 0 }}</dd>
              </div>
              <div>
                <dt>Completed</dt>
                <dd>{{ item.liveTransferSummary.completed ?? 0 }}</dd>
              </div>
              <div>
                <dt>Failed</dt>
                <dd>{{ item.liveTransferSummary.failed ?? 0 }}</dd>
              </div>
              <div>
                <dt>Progress</dt>
                <dd>{{ formatPercent(item.liveTransferSummary.percentComplete) }}</dd>
              </div>
            </dl>

            <div class="review-queue-stack" v-if="item.liveTransfers?.length">
              <article class="review-file-item" v-for="transfer in item.liveTransfers" :key="transfer.id || transfer.filename">
                <div class="review-file-header">
                  <div>
                    <p class="eyebrow">{{ transfer.username || 'unknown user' }}</p>
                    <strong>{{ transfer.filename || 'Unknown transfer' }}</strong>
                    <p class="metadata-card-copy">{{ transfer.state || 'Unknown state' }}</p>
                    <RouterLink
                      v-if="downloaderTransferLocation(transfer)"
                      class="execution-transfer-downloader-link"
                      :to="downloaderTransferLocation(transfer)"
                    >
                      Open in Downloader
                    </RouterLink>
                  </div>
                  <span class="review-status-pill" :class="getLiveTransferStatusClass({ status: transfer.exception ? 'failed' : (String(transfer.state || '').includes('Completed, Succeeded') ? 'completed' : (String(transfer.state || '').includes('Queued') ? 'queued' : 'active')) })">
                    {{ transfer.placeInQueue != null ? `Queue ${transfer.placeInQueue}` : formatPercent(Number(transfer.size) > 0 ? Math.round(((Number(transfer.bytesTransferred) || 0) / Number(transfer.size)) * 100) : null) }}
                  </span>
                </div>
                <p class="metadata-card-copy" v-if="transfer.exception">{{ transfer.exception }}</p>
              </article>
            </div>

            <article
              v-if="buildLiveTransferSyncNotice(item)"
              class="execution-transfer-sync-notice"
              :data-tone="buildLiveTransferSyncNotice(item).tone"
              role="status"
              aria-live="polite"
            >
              <strong>{{ buildLiveTransferSyncNotice(item).title }}</strong>
              <p>{{ buildLiveTransferSyncNotice(item).message }}</p>
            </article>

            <article
              class="panel-light review-empty-state"
              v-if="item.liveTransferSummary?.status === 'not_found' && (getLatestTransferSummary(item) || getPersistedMissingTransfer(item))"
            >
              <div class="review-file-header">
                <div>
                  <p class="eyebrow">Last durable transfer observation</p>
                  <strong>{{ getLatestTransferSummary(item)?.message || getPersistedMissingTransfer(item)?.message || 'A previous transfer observation or missing-transfer check was persisted.' }}</strong>
                </div>
                <span class="review-status-pill" :class="getLiveTransferStatusClass(getLatestTransferSummary(item) || item.liveTransferSummary)">
                  {{ formatLiveTransferStatus(getLatestTransferSummary(item) || item.liveTransferSummary) }}
                </span>
              </div>

              <dl class="review-meta-grid review-meta-grid-wide">
                <div>
                  <dt>Last reconciled</dt>
                  <dd>{{ formatTimestamp(getPersistedTransferObservation(item)?.lastReconciledAt) }}</dd>
                </div>
                <div>
                  <dt>Transfers</dt>
                  <dd>{{ getLatestTransferSummary(item)?.total ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{{ getLatestTransferSummary(item)?.completed ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{{ getLatestTransferSummary(item)?.failed ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{{ formatPercent(getLatestTransferSummary(item)?.percentComplete) }}</dd>
                </div>
                <div>
                  <dt>Missing since</dt>
                  <dd>{{ formatTimestamp(getPersistedMissingTransfer(item)?.missingSince || item.liveTransferSummary?.missingTransfer?.missingSince) }}</dd>
                </div>
                <div>
                  <dt>Last missing check</dt>
                  <dd>{{ formatTimestamp(getPersistedMissingTransfer(item)?.lastCheckedAt) }}</dd>
                </div>
                <div>
                  <dt>Grace deadline</dt>
                  <dd>{{ formatTimestamp(getPersistedMissingTransfer(item)?.graceDeadlineAt || item.liveTransferSummary?.missingTransfer?.graceDeadlineAt) }}</dd>
                </div>
              </dl>
            </article>
          </article>
        </article>
      </div>
      <article class="panel-light review-empty-state" v-else>
        <h3>No download items yet</h3>
        <p>No items have been recorded for this run yet.</p>
      </article>
    </template>
  </article>
</template>

<style scoped>
.execution-runs-subtable {
  margin: 0;
  background: var(--hx-bg-surface-sunken);
}

.execution-runs-subtable thead,
.execution-runs-subtable tbody,
.execution-runs-subtable thead tr,
.execution-runs-subtable tbody tr {
  background: var(--hx-bg-surface-sunken);
}

.execution-runs-subtable thead th,
.execution-runs-subtable tbody td {
  background: var(--hx-bg-surface-sunken);
}

.execution-runs-subtable thead tr:hover > th,
.execution-runs-subtable tbody tr:hover > td {
  background: var(--hx-bg-surface-sunken);
}

.execution-runs-subtable-row {
  cursor: default;
}

.execution-run-id {
  font-family: var(--hx-font-mono, ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace);
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
  white-space: nowrap;
}

.execution-runs-subtable tbody tr.is-selected > td {
  background: var(--hx-bg-surface) !important;
  border-top-color: rgba(94, 173, 255, 0.22);
  border-bottom-color: rgba(94, 173, 255, 0.22);
}

.execution-runs-subtable tbody tr.is-selected > td:first-child {
  border-left: 3px solid var(--hx-accent);
  padding-left: 9px;
}

.execution-run-detail-cell {
  text-align: right;
  white-space: nowrap;
}

.execution-run-detail-btn {
  min-height: 28px;
  padding: 4px 10px;
  font-size: var(--hx-text-xs);
}

.execution-run-detail-btn[aria-pressed='true'] {
  background: var(--hx-accent-soft);
  border-color: rgba(94, 173, 255, 0.32);
  color: var(--hx-accent-strong);
}

.execution-transfer-downloader-link {
  display: inline-block;
  width: fit-content;
  margin-top: var(--hx-space-1);
  color: var(--hx-accent);
  font-size: var(--hx-text-xs);
  font-weight: 700;
  text-decoration: none;
}

.execution-transfer-downloader-link:hover,
.execution-transfer-downloader-link:focus-visible {
  text-decoration: underline;
}

.execution-degraded-notice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--hx-space-3);
  align-items: start;
  padding: var(--hx-space-3) var(--hx-space-4);
  background: var(--hx-warning-soft);
  border: 1px solid rgba(192, 138, 22, 0.28);
  border-radius: var(--hx-radius-md);
}

.execution-degraded-notice p {
  margin: 0;
  font-size: var(--hx-text-sm);
  color: var(--hx-text);
}

.execution-refresh-notice {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--hx-space-3);
  align-items: start;
  padding: var(--hx-space-3) var(--hx-space-4);
  background: var(--hx-bg-surface-sunken);
  border: 1px solid var(--hx-border-muted);
  border-radius: var(--hx-radius-md);
}

.execution-refresh-notice[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: rgba(18, 134, 88, 0.32);
}

.execution-refresh-notice[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: rgba(192, 138, 22, 0.32);
}

.execution-refresh-notice[data-tone='danger'] {
  background: var(--hx-danger-soft);
  border-color: rgba(218, 68, 83, 0.32);
}

.execution-refresh-notice strong {
  display: block;
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.execution-refresh-notice p {
  margin: var(--hx-space-1) 0 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}

.execution-diagnostic-panel {
  display: grid;
  gap: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  border: 1px solid var(--hx-border-muted);
  border-radius: var(--hx-radius-md);
  background: var(--hx-bg-surface-sunken);
}

.execution-diagnostic-panel[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: rgba(18, 134, 88, 0.32);
}

.execution-diagnostic-panel[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: rgba(192, 138, 22, 0.32);
}

.execution-diagnostic-panel[data-tone='danger'] {
  background: var(--hx-danger-soft);
  border-color: rgba(218, 68, 83, 0.32);
}

.execution-transfer-sync-notice {
  display: grid;
  gap: var(--hx-space-1);
  margin-top: var(--hx-space-3);
  padding: var(--hx-space-3) var(--hx-space-4);
  background: var(--hx-bg-surface-sunken);
  border: 1px solid var(--hx-border-muted);
  border-radius: var(--hx-radius-md);
}

.execution-transfer-sync-notice[data-tone='success'] {
  background: var(--hx-success-soft);
  border-color: rgba(18, 134, 88, 0.32);
}

.execution-transfer-sync-notice[data-tone='warning'] {
  background: var(--hx-warning-soft);
  border-color: rgba(192, 138, 22, 0.32);
}

.execution-transfer-sync-notice[data-tone='danger'] {
  background: var(--hx-danger-soft);
  border-color: rgba(218, 68, 83, 0.32);
}

.execution-transfer-sync-notice strong {
  color: var(--hx-text);
  font-size: var(--hx-text-sm);
}

.execution-transfer-sync-notice p {
  margin: 0;
  color: var(--hx-text-muted);
  font-size: var(--hx-text-sm);
}
</style>
