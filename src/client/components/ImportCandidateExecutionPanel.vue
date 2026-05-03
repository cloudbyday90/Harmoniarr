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
  runDetailErrorMessage: {
    type: String,
    default: '',
  },
  selectedCandidateCount: {
    type: Number,
    default: 0,
  },
  summary: {
    type: Object,
    default: null,
  },
});

defineEmits(['reconcile', 'refresh', 'start']);

function formatTimestamp(value) {
  if (!value) {
    return 'Unknown';
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toLocaleString();
}

function formatPath(value) {
  return value || 'Unavailable';
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value}%` : 'Unavailable';
}

function formatRunStatus(status) {
  switch (status) {
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'completed':
      return 'Completed';
    default:
      return 'Pending';
  }
}

function formatExecutionMode(mode) {
  switch (mode) {
    case 'download_enqueue':
      return 'Download enqueue';
    default:
      return mode || 'Execution';
  }
}

function statusClass(status) {
  switch (status) {
    case 'running':
      return 'review-status-selected';
    case 'failed':
      return 'review-status-failed';
    case 'completed':
      return 'review-status-held';
    default:
      return 'review-status-pending';
  }
}

function itemStatusClass(status) {
  switch (status) {
    case 'blocked':
      return 'review-status-failed';
    case 'queue_failed':
      return 'review-status-failed';
    case 'queued_with_warnings':
      return 'review-status-held';
    case 'queued':
      return 'review-status-selected';
    case 'ready_with_warnings':
      return 'review-status-held';
    default:
      return 'review-status-selected';
  }
}

function itemStatusLabel(status) {
  switch (status) {
    case 'blocked':
      return 'Blocked';
    case 'queue_failed':
      return 'Queue failed';
    case 'queued_with_warnings':
      return 'Queued with warnings';
    case 'queued':
      return 'Queued';
    case 'ready_with_warnings':
      return 'Ready with warnings';
    default:
      return 'Ready';
  }
}


function formatLiveTransferStatus(summary) {
  if (!summary) {
    return 'Not reconciled';
  }

  switch (summary.status) {
    case 'active':
      return 'Active';
    case 'queued':
      return 'Queued remotely';
    case 'completed':
      return 'Completed';
    case 'failed':
      return 'Failed';
    case 'not_found':
      return summary.missingTransfer?.isPastGracePeriod ? 'Orphaned' : 'Missing remotely';
    default:
      return 'Missing';
  }
}

function liveTransferStatusClass(summary) {
  switch (summary?.status) {
    case 'active':
      return 'review-status-selected';
    case 'queued':
      return 'review-status-pending';
    case 'completed':
      return 'review-status-held';
    case 'failed':
      return 'review-status-failed';
    case 'not_found':
      return summary?.missingTransfer?.isPastGracePeriod ? 'review-status-failed' : 'review-status-pending';
    default:
      return 'review-status-pending';
  }
}

function persistedTransferObservation(item) {
  return item?.persistedTransferObservation ?? null;
}

function latestTransferSummary(item) {
  return persistedTransferObservation(item)?.summary ?? null;
}

function persistedMissingTransfer(item) {
  return item?.persistedMissingTransfer ?? null;
}

function heartbeatOutcomeLabel(heartbeat) {
  switch (heartbeat?.state?.lastOutcome) {
    case 'started':
      return 'Reconciled automatically';
    case 'error':
      return 'Heartbeat error';
    case 'skipped':
      return 'Skipped';
    default:
      return 'Not yet recorded';
  }
}

function heartbeatSkipReasonLabel(reason) {
  switch (reason) {
    case 'not_due':
      return 'No actionable transfer updates were visible.';
    case 'tick_in_progress':
      return 'A previous reconciliation tick was still running.';
    case 'error':
      return 'The last heartbeat tick failed.';
    default:
      return 'None';
  }
}

function canStartRun(currentRun, selectedCandidateCount) {
  return !currentRun || (currentRun.status !== 'pending' && currentRun.status !== 'running' && selectedCandidateCount > 0);
}
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Execution queue</p>
        <h3>Durable run state</h3>
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
          {{ isReconciling ? 'Reconciling...' : 'Persist transfer state' }}
        </button>
        <button
          type="button"
          :disabled="!canStartRun(currentRun, selectedCandidateCount) || isStarting"
          @click="$emit('start')"
        >
          {{ isStarting ? 'Starting...' : 'Start download run' }}
        </button>
      </div>
    </div>

    <p class="review-summary-copy">This run snapshots selected candidates, enqueues eligible files into slskd, and persists per-candidate queue outcomes without applying imports.</p>
    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <dl class="review-meta-grid review-meta-grid-wide" v-if="summary?.heartbeat">
      <div>
        <dt>Auto reconcile cadence</dt>
        <dd>{{ summary.heartbeat.intervalLabel ?? 'Unavailable' }}</dd>
      </div>
      <div>
        <dt>Cadence source</dt>
        <dd>{{ summary.heartbeat.source ?? 'Unavailable' }}</dd>
      </div>
      <div>
        <dt>Last heartbeat</dt>
        <dd>{{ heartbeatOutcomeLabel(summary.heartbeat) }}</dd>
      </div>
      <div>
        <dt>Last tick</dt>
        <dd>{{ formatTimestamp(summary.heartbeat.state?.lastTickAt) }}</dd>
      </div>
      <div>
        <dt>Last skip reason</dt>
        <dd>{{ heartbeatSkipReasonLabel(summary.heartbeat.state?.lastSkipReason) }}</dd>
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
      <h3>Execution summary unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    <p class="error-copy" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading execution summary</h3>
      <p>Resolving the latest durable execution run and its item outcomes.</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No execution run yet</h3>
      <p>Start a download run to persist selected-candidate enqueue outcomes as durable execution items.</p>
    </article>

    <template v-else>
      <div class="review-detail-header">
        <div>
          <p class="eyebrow">{{ formatExecutionMode(currentRun.executionMode) }}</p>
          <h3>Run {{ currentRun.id }}</h3>
          <p class="metadata-card-copy">{{ currentRun.currentStep || 'No current step reported' }}</p>
        </div>
        <span class="review-status-pill" :class="statusClass(currentRun.status)">
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
            <span class="review-status-pill" :class="itemStatusClass(item.itemStatus)">
              {{ itemStatusLabel(item.itemStatus) }}
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
              <span class="review-status-pill" :class="liveTransferStatusClass(item.liveTransferSummary)">
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
                  <span class="review-status-pill" :class="liveTransferStatusClass({ status: transfer.exception ? 'failed' : (String(transfer.state || '').includes('Completed, Succeeded') ? 'completed' : (String(transfer.state || '').includes('Queued') ? 'queued' : 'active')) })">
                    {{ transfer.placeInQueue != null ? `Queue ${transfer.placeInQueue}` : formatPercent(Number(transfer.size) > 0 ? Math.round(((Number(transfer.bytesTransferred) || 0) / Number(transfer.size)) * 100) : null) }}
                  </span>
                </div>
                <p class="metadata-card-copy" v-if="transfer.exception">{{ transfer.exception }}</p>
              </article>
            </div>

            <article
              class="panel-light review-empty-state"
              v-if="item.liveTransferSummary?.status === 'not_found' && (latestTransferSummary(item) || persistedMissingTransfer(item))"
            >
              <div class="review-file-header">
                <div>
                  <p class="eyebrow">Last durable transfer observation</p>
                  <strong>{{ latestTransferSummary(item)?.message || persistedMissingTransfer(item)?.message || 'A previous transfer observation or missing-transfer check was persisted.' }}</strong>
                </div>
                <span class="review-status-pill" :class="liveTransferStatusClass(latestTransferSummary(item) || item.liveTransferSummary)">
                  {{ formatLiveTransferStatus(latestTransferSummary(item) || item.liveTransferSummary) }}
                </span>
              </div>

              <dl class="review-meta-grid review-meta-grid-wide">
                <div>
                  <dt>Last reconciled</dt>
                  <dd>{{ formatTimestamp(persistedTransferObservation(item)?.lastReconciledAt) }}</dd>
                </div>
                <div>
                  <dt>Transfers</dt>
                  <dd>{{ latestTransferSummary(item)?.total ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Completed</dt>
                  <dd>{{ latestTransferSummary(item)?.completed ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Failed</dt>
                  <dd>{{ latestTransferSummary(item)?.failed ?? 0 }}</dd>
                </div>
                <div>
                  <dt>Progress</dt>
                  <dd>{{ formatPercent(latestTransferSummary(item)?.percentComplete) }}</dd>
                </div>
                <div>
                  <dt>Missing since</dt>
                  <dd>{{ formatTimestamp(persistedMissingTransfer(item)?.missingSince || item.liveTransferSummary?.missingTransfer?.missingSince) }}</dd>
                </div>
                <div>
                  <dt>Last missing check</dt>
                  <dd>{{ formatTimestamp(persistedMissingTransfer(item)?.lastCheckedAt) }}</dd>
                </div>
                <div>
                  <dt>Grace deadline</dt>
                  <dd>{{ formatTimestamp(persistedMissingTransfer(item)?.graceDeadlineAt || item.liveTransferSummary?.missingTransfer?.graceDeadlineAt) }}</dd>
                </div>
              </dl>
            </article>
          </article>
        </article>
      </div>
      <article class="panel-light review-empty-state" v-else>
        <h3>No persisted execution items</h3>
        <p>This run has not recorded per-candidate execution items yet.</p>
      </article>
    </template>
  </article>
</template>
