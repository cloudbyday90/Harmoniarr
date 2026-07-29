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
  canStartMediaInspectionRun,
  formatRunStatus,
  formatTimestamp,
  getRunStatusClass,
} from '../lib/import-candidate-presentation.js';
import {
  formatElapsedDuration,
  formatOperationTimestampShort,
} from '../lib/operation-run-presentation.js';
import ImportCandidateMediaInspectionDiagnostics from './ImportCandidateMediaInspectionDiagnostics.vue';
import ImportCandidateRunFailureNotice from './ImportCandidateRunFailureNotice.vue';

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

defineEmits(['open-candidate', 'refresh', 'select-run', 'start']);
</script>

<template>
  <article class="panel-light review-panel">
    <div class="section-header">
      <div>
        <p class="eyebrow">Media checks</p>
        <h3>Check selected matches</h3>
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
          :disabled="!canStartMediaInspectionRun(currentRun, selectedCandidateCount) || isStarting"
          @click="$emit('start')"
        >
          {{ isStarting ? 'Starting...' : 'Start media inspection' }}
        </button>
      </div>
    </div>

    <p class="review-summary-copy">Checks files for selected matches and records warnings before downloads or library additions continue.</p>
    <p class="review-summary-copy" v-if="summary">{{ summary.message }}</p>

    <article class="panel-light error-panel" v-if="errorMessage" role="alert">
      <h3>Media inspection unavailable</h3>
      <p>{{ errorMessage }}</p>
    </article>

    <p class="error-copy" role="alert" v-if="runDetailErrorMessage">{{ runDetailErrorMessage }}</p>
    <p class="error-copy" role="alert" v-if="actionErrorMessage">{{ actionErrorMessage }}</p>

    <article class="panel-light review-empty-state" v-else-if="isLoading && !currentRun">
      <h3>Loading media inspection run</h3>
      <p>Loading media inspection run…</p>
    </article>

    <article class="panel-light review-empty-state" v-else-if="!currentRun">
      <h3>No media inspection run yet</h3>
      <p>Select matches from the list above, then start a media check to validate their files.</p>
    </article>

    <template v-else>
      <article class="onboarding-step-card" v-if="recentRuns.length">
        <div class="review-detail-header">
          <div>
            <p>Recent media inspection history</p>
            <strong>The last {{ recentRuns.length }} media inspection run{{ recentRuns.length === 1 ? '' : 's' }}.</strong>
          </div>
        </div>
        <table class="hx-table media-inspection-runs-subtable">
          <thead>
            <tr>
              <th>Run</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Matches</th>
              <th>Files</th>
              <th>Warnings</th>
              <th>Unavailable</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="run in recentRuns"
              :key="run.id"
              class="media-inspection-runs-subtable-row"
              :aria-selected="run.id === (selectedRunId || currentRun?.id) ? 'true' : 'false'"
              :class="{ 'is-selected': run.id === (selectedRunId || currentRun?.id) }"
            >
              <td><span class="media-inspection-run-id">{{ run.id }}</span></td>
              <td>
                <span class="review-status-pill" :class="getRunStatusClass(run.status)">
                  {{ formatRunStatus(run.status) }}
                </span>
              </td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatOperationTimestampShort(run.startedAt) }}</span></td>
              <td><span class="hx-text-muted" style="font-size: var(--hx-text-xs);">{{ formatElapsedDuration(run.startedAt, run.finishedAt) }}</span></td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.requestedCandidateCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.inspectedFileCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.warningCount ?? 0 }}</td>
              <td class="hx-table-num hx-text-muted" style="font-size: var(--hx-text-xs);">{{ run.inspectionUnavailableCount ?? 0 }}</td>
              <td class="media-inspection-run-detail-cell">
                <button
                  type="button"
                  class="hx-btn media-inspection-run-detail-btn"
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
          <dt>Matches checked</dt>
          <dd>{{ currentRun.inspectedCandidateCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Inspected files</dt>
          <dd>{{ currentRun.inspectedFileCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Warnings</dt>
          <dd>{{ currentRun.warningCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Inspection unavailable</dt>
          <dd>{{ currentRun.inspectionUnavailableCount ?? 0 }}</dd>
        </div>
        <div>
          <dt>Blocked matches</dt>
          <dd>{{ currentRun.blockedCandidateCount ?? 0 }}</dd>
        </div>
      </dl>

      <ImportCandidateMediaInspectionDiagnostics
        :diagnostics="currentRun.inspectionDiagnostics ?? []"
        @open-candidate="$emit('open-candidate', $event)"
      />
    </template>
  </article>
</template>

<style scoped>
.media-inspection-runs-subtable {
  margin: 0;
  background: var(--hx-bg-surface-sunken);
}

.media-inspection-runs-subtable thead,
.media-inspection-runs-subtable tbody,
.media-inspection-runs-subtable thead tr,
.media-inspection-runs-subtable tbody tr {
  background: var(--hx-bg-surface-sunken);
}

.media-inspection-runs-subtable thead th,
.media-inspection-runs-subtable tbody td {
  background: var(--hx-bg-surface-sunken);
}

.media-inspection-runs-subtable thead tr:hover > th,
.media-inspection-runs-subtable tbody tr:hover > td {
  background: var(--hx-bg-surface-sunken);
}

.media-inspection-runs-subtable-row {
  cursor: default;
}

.media-inspection-run-id {
  font-family: var(--hx-font-mono, ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace);
  font-size: var(--hx-text-xs);
  color: var(--hx-text-muted);
  white-space: nowrap;
}

.media-inspection-runs-subtable tbody tr.is-selected > td {
  background: var(--hx-bg-surface) !important;
  border-top-color: rgba(94, 173, 255, 0.22);
  border-bottom-color: rgba(94, 173, 255, 0.22);
}

.media-inspection-runs-subtable tbody tr.is-selected > td:first-child {
  border-left: 3px solid var(--hx-accent);
  padding-left: 9px;
}

.media-inspection-run-detail-cell {
  text-align: right;
  white-space: nowrap;
}

.media-inspection-run-detail-btn {
  min-height: 28px;
  padding: 4px 10px;
  font-size: var(--hx-text-xs);
}

.media-inspection-run-detail-btn[aria-pressed='true'] {
  background: var(--hx-accent-soft);
  border-color: rgba(94, 173, 255, 0.32);
  color: var(--hx-accent-strong);
}
</style>
