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
  canStartExecutionRun,
  formatLiveTransferStatus,
  formatPath,
  formatPercent,
  formatRunStatus,
  formatTimestamp,
  getExecutionItemStatusClass,
  getExecutionItemStatusLabel,
  getHeartbeatOutcomeLabel,
  getHeartbeatSkipReasonLabel,
  getLatestTransferSummary,
  getLiveTransferStatusClass,
  getPersistedMissingTransfer,
  getPersistedTransferObservation,
  getRunStatusClass,
} from '../lib/import-candidate-presentation.js';
import {
  formatElapsedDuration,
  formatOperationTimestampShort,
} from '../lib/operation-run-presentation.js';

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
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Download run</p>
        <h3>Queue selected for download</h3>
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

    <p class="review-summary-copy">Queues your selected candidates for download. Each file is sent to the download queue and the outcome is recorded so you can track progress.</p>
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

    <article class="panel-light error-panel" v-if="errorMessage">
      <h3>Download run unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading download run</h3>
      <p>Loading download run…</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No download run yet</h3>
      <p>Select candidates from the list above, then start a download run to queue them.</p>
    </article>

    <template v-else>
      <article class="onboarding-step-card" v-if="recentRuns.length">
        <div class="review-detail-header">
          <div>
            <p>Recent download history</p>
            <strong>The last {{ recentRuns.length }} import execution run{{ recentRuns.length === 1 ? '' : 's' }}.</strong>
          </div>
        </div>
        <table class="hx-table execution-runs-subtable">
          <thead>
            <tr>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Requested</th>
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
          <dt>Requested</dt>
          <dd>{{ currentRun.requestedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Processed</dt>
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
                  </div>
                  <span class="review-status-pill" :class="getLiveTransferStatusClass({ status: transfer.exception ? 'failed' : (String(transfer.state || '').includes('Completed, Succeeded') ? 'completed' : (String(transfer.state || '').includes('Queued') ? 'queued' : 'active')) })">
                    {{ transfer.placeInQueue != null ? `Queue ${transfer.placeInQueue}` : formatPercent(Number(transfer.size) > 0 ? Math.round(((Number(transfer.bytesTransferred) || 0) / Number(transfer.size)) * 100) : null) }}
                  </span>
                </div>
                <p class="metadata-card-copy" v-if="transfer.exception">{{ transfer.exception }}</p>
              </article>
            </div>

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
</style>
